import { useState, useEffect, useMemo, useRef } from 'react';
import { MessageCircle, BookPlus, Award, Send, Loader, PenLine } from 'lucide-react';
import type { Book } from '../types';
import type { Profile } from '../contexts/AuthContext';
import { getGroupActivityComments, addBookComment, type BookComment } from '../services/comments';
import { supabase } from '../lib/supabase';

type FeedItem =
  | { kind: 'comment';  data: BookComment; sortKey: string }
  | { kind: 'activity'; type: 'book_added' | 'book_finished' | 'review_added'; book: Book; sortKey: string };

interface Props {
  books:   Book[];
  members: Profile[];
  userId:  string;
}

const PAGE_SIZE     = 5;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function fmtDate(iso: string): string {
  const diffMs  = Date.now() - new Date(iso).getTime();
  const diffHr  = Math.floor(diffMs / 3_600_000);
  if (diffHr < 1)  return '방금 전';
  if (diffHr < 24) return `${diffHr}시간 전`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

export default function ActivityFeed({ books, members, userId }: Props) {
  const [comments, setComments] = useState<BookComment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState(false);

  // 인라인 댓글 상태
  const [commentingBookId, setCommentingBookId]   = useState<string | null>(null);
  const [commentingOwnerId, setCommentingOwnerId] = useState<string>('');
  const [commentText, setCommentText]             = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError]           = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const data = await getGroupActivityComments(100);
    setComments(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel('activity-feed-comments')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'book_comments' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [members.length]);

  const feed = useMemo(() => {
    const cutoff = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();

    const bookItems: FeedItem[] = books
      .filter(b => b.userId !== userId)
      .flatMap(b => {
        const items: FeedItem[] = [];

        if (b.status !== 'want-to-read' && b.createdAt >= cutoff) {
          items.push({ kind: 'activity', type: 'book_added', book: b, sortKey: b.createdAt });
        }

        if (b.status === 'finished' && b.finishDate) {
          const finishISO = `${b.finishDate}T12:00:00.000Z`;
          if (finishISO >= cutoff) {
            items.push({ kind: 'activity', type: 'book_finished', book: b, sortKey: finishISO });
          }
        }

        if (b.review?.trim() && b.reviewCreatedAt && b.reviewCreatedAt >= cutoff) {
          items.push({ kind: 'activity', type: 'review_added', book: b, sortKey: b.reviewCreatedAt });
        }

        return items;
      });

    const commentItems: FeedItem[] = comments
      .filter(c => c.user_id !== userId && c.created_at >= cutoff)
      .map(c => ({ kind: 'comment', data: c, sortKey: c.created_at }));

    return [...bookItems, ...commentItems].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [books, comments, userId]);

  const getMember = (uid: string) => members.find(m => m.id === uid);

  const openComment = (bookId: string, ownerId: string) => {
    if (commentingBookId === bookId) {
      setCommentingBookId(null);
      return;
    }
    setCommentingBookId(bookId);
    setCommentingOwnerId(ownerId);
    setCommentText('');
    setCommentError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !commentingBookId || commentSubmitting) return;
    setCommentSubmitting(true);
    setCommentError(null);
    try {
      const err = await addBookComment(commentingBookId, commentingOwnerId, commentText.trim());
      if (err) {
        setCommentError(err);
      } else {
        setCommentText('');
        setCommentingBookId(null);
        await load();
      }
    } catch {
      setCommentError('댓글 작성 중 오류가 발생했어요.');
    } finally {
      setCommentSubmitting(false);
    }
  };

  if (loading) return (
    <div className="feed-loading"><span className="feed-spinner" /></div>
  );

  if (feed.length === 0) return (
    <div className="feed-empty">
      <span style={{ fontSize: 36 }}>📚</span>
      <p>최근 7일간 가족 활동이 없어요.</p>
    </div>
  );

  const visible = expanded ? feed : feed.slice(0, PAGE_SIZE);
  const hasMore = feed.length > PAGE_SIZE;

  return (
    <div className="activity-feed">
      {visible.map((item, i) => {
        if (item.kind === 'comment') {
          const c      = item.data;
          const member = getMember(c.user_id);
          const name   = member?.display_name ?? c.profiles?.display_name ?? '—';
          const avatar = member?.avatar_url   ?? c.profiles?.avatar_url   ?? null;
          const book   = books.find(b => b.id === c.book_id);

          return (
            <div key={`c-${c.id}-${i}`} className="feed-item">
              <div className="feed-avatar">
                {avatar ? <img src={avatar} alt="" /> : <span>{name[0].toUpperCase()}</span>}
              </div>
              <div className="feed-body">
                <div className="feed-meta">
                  <span className="feed-who">{name}</span>
                  <span className="feed-time">{fmtDate(c.created_at)}</span>
                </div>
                {book && <div className="feed-book-ref">📖 {book.title}</div>}
                <p className="feed-comment-text">"{c.content}"</p>
              </div>
              <MessageCircle size={13} className="feed-type-icon feed-icon-comment" />
            </div>
          );
        }

        const { book, type, sortKey } = item;
        const member     = getMember(book.userId ?? '');
        const name       = member?.display_name ?? '—';
        const avatar     = member?.avatar_url   ?? null;
        const isFinished = type === 'book_finished';
        const isReview   = type === 'review_added';
        const isOpen     = commentingBookId === book.id;

        return (
          <div key={`a-${book.id}-${type}`} className="feed-item feed-item-activity">
            <div className="feed-avatar">
              {avatar ? <img src={avatar} alt="" /> : <span>{name[0].toUpperCase()}</span>}
            </div>
            <div className="feed-body">
              <div className="feed-meta">
                <span className="feed-who">{name}</span>
                <span className="feed-time">{fmtDate(sortKey)}</span>
              </div>
              <p className="feed-activity-text">
                {isReview
                  ? <><strong>{book.title}</strong> 감상문을 남겼어요</>
                  : isFinished
                  ? <><strong>{book.title}</strong>을 완독했어요 🎉</>
                  : <><strong>{book.title}</strong>을 서재에 추가했어요</>
                }
              </p>
              {isReview && book.review && (
                <p className="feed-review-snippet">"{book.review}"</p>
              )}
              {(isFinished || isReview) && book.cover && (
                <img src={book.cover} alt="" className="feed-book-cover" />
              )}
              <button
                className={`feed-comment-btn ${isOpen ? 'active' : ''}`}
                onClick={() => openComment(book.id, book.userId ?? '')}
              >
                <MessageCircle size={12} />
                한마디
              </button>

              {isOpen && (
                <form onSubmit={handleCommentSubmit} className="feed-inline-comment">
                  <input
                    ref={inputRef}
                    value={commentText}
                    onChange={e => { setCommentText(e.target.value); setCommentError(null); }}
                    placeholder="가족 한마디 남기기..."
                    maxLength={500}
                    className="feed-inline-input"
                    disabled={commentSubmitting}
                  />
                  <button
                    type="submit"
                    className="feed-inline-send"
                    disabled={commentSubmitting || !commentText.trim()}
                  >
                    {commentSubmitting
                      ? <Loader size={13} className="spin" />
                      : <Send size={13} />
                    }
                  </button>
                  {commentError && <p className="feed-inline-error">{commentError}</p>}
                </form>
              )}
            </div>
            {isReview
              ? <PenLine  size={13} className="feed-type-icon feed-icon-review" />
              : isFinished
              ? <Award    size={13} className="feed-type-icon feed-icon-finished" />
              : <BookPlus size={13} className="feed-type-icon feed-icon-added"    />
            }
          </div>
        );
      })}

      {hasMore && (
        <button className="feed-more-btn" onClick={() => setExpanded(e => !e)}>
          {expanded ? '접기' : `더보기 (${feed.length - PAGE_SIZE}개)`}
        </button>
      )}
    </div>
  );
}
