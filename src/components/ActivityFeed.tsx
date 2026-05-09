import { useState, useEffect, useMemo } from 'react';
import { MessageCircle, BookPlus, Award } from 'lucide-react';
import type { Book } from '../types';
import type { Profile } from '../contexts/AuthContext';
import { getGroupActivityComments, type BookComment } from '../services/comments';
import { supabase } from '../lib/supabase';

type FeedItem =
  | { kind: 'comment';  data: BookComment; sortKey: string }
  | { kind: 'activity'; type: 'book_added' | 'book_finished'; book: Book; sortKey: string };

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

    // 다른 가족의 책 활동 (books prop은 RLS 없이 전체 로드됨)
    const bookItems: FeedItem[] = books
      .filter(b => b.userId !== userId)
      .flatMap(b => {
        const items: FeedItem[] = [];

        // 책 추가: 7일 이내
        if (b.status !== 'want-to-read' && b.createdAt >= cutoff) {
          items.push({ kind: 'activity', type: 'book_added', book: b, sortKey: b.createdAt });
        }

        // 완독: finishDate 기준 7일 이내
        if (b.status === 'finished' && b.finishDate) {
          const finishISO = `${b.finishDate}T12:00:00.000Z`;
          if (finishISO >= cutoff) {
            items.push({ kind: 'activity', type: 'book_finished', book: b, sortKey: finishISO });
          }
        }

        return items;
      });

    // 다른 가족의 댓글 (7일 이내)
    const commentItems: FeedItem[] = comments
      .filter(c => c.user_id !== userId && c.created_at >= cutoff)
      .map(c => ({ kind: 'comment', data: c, sortKey: c.created_at }));

    return [...bookItems, ...commentItems].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [books, comments, userId]);

  const getMember = (uid: string) => members.find(m => m.id === uid);

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

        return (
          <div key={`a-${book.id}-${type}`} className="feed-item">
            <div className="feed-avatar">
              {avatar ? <img src={avatar} alt="" /> : <span>{name[0].toUpperCase()}</span>}
            </div>
            <div className="feed-body">
              <div className="feed-meta">
                <span className="feed-who">{name}</span>
                <span className="feed-time">{fmtDate(sortKey)}</span>
              </div>
              <p className="feed-activity-text">
                {isFinished
                  ? <><strong>{book.title}</strong>을 완독했어요 🎉</>
                  : <><strong>{book.title}</strong>을 서재에 추가했어요</>
                }
              </p>
              {isFinished && book.cover && (
                <img src={book.cover} alt="" className="feed-book-cover" />
              )}
            </div>
            {isFinished
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
