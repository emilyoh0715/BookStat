import { useState, useEffect } from 'react';
import { MessageCircle, BookPlus, Award } from 'lucide-react';
import type { Book } from '../types';
import type { Profile } from '../contexts/AuthContext';
import {
  getGroupActivityComments,
  getGroupActivityLogs,
  type BookComment,
  type ActivityLogItem,
} from '../services/comments';
import { supabase } from '../lib/supabase';

type FeedItem =
  | { kind: 'comment';  data: BookComment;     sortKey: string }
  | { kind: 'activity'; data: ActivityLogItem; sortKey: string };

interface Props {
  books:   Book[];
  members: Profile[];
  userId:  string;
}

function fmtDate(iso: string): string {
  const diffMs  = Date.now() - new Date(iso).getTime();
  const diffHr  = Math.floor(diffMs / 3_600_000);
  if (diffHr < 1)  return '방금 전';
  if (diffHr < 24) return `${diffHr}시간 전`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

export default function ActivityFeed({ books, members }: Props) {
  const [feed, setFeed]       = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const memberIds = members.map(m => m.id);
    const [comments, logs] = await Promise.all([
      getGroupActivityComments(40),
      getGroupActivityLogs(memberIds, 40),
    ]);

    const items: FeedItem[] = [
      ...comments.map(c => ({ kind: 'comment'  as const, data: c, sortKey: c.created_at })),
      ...logs.map(a     => ({ kind: 'activity' as const, data: a, sortKey: a.created_at })),
    ];
    items.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
    setFeed(items.slice(0, 60));
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

  const getMember = (uid: string) => members.find(m => m.id === uid);
  const getBook   = (bid: string) => books.find(b => b.id === bid);

  if (loading) return (
    <div className="feed-loading">
      <span className="feed-spinner" />
    </div>
  );

  if (feed.length === 0) return (
    <div className="feed-empty">
      <span style={{ fontSize: 36 }}>📚</span>
      <p>아직 활동이 없어요.<br />책을 추가하거나 감상을 남겨보세요!</p>
    </div>
  );

  return (
    <div className="activity-feed">
      {feed.map(item => {
        if (item.kind === 'comment') {
          const c      = item.data;
          const member = getMember(c.user_id);
          const name   = member?.display_name ?? c.profiles?.display_name ?? '—';
          const avatar = member?.avatar_url   ?? c.profiles?.avatar_url   ?? null;
          const book   = getBook(c.book_id);

          return (
            <div key={`c-${c.id}`} className="feed-item">
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

        const a      = item.data;
        const member = getMember(a.user_id);
        const name   = member?.display_name ?? '—';
        const avatar = member?.avatar_url   ?? null;
        const book   = getBook(a.book_id);
        const isFinished = a.type === 'book_finished';

        return (
          <div key={`a-${a.id}`} className="feed-item">
            <div className="feed-avatar">
              {avatar ? <img src={avatar} alt="" /> : <span>{name[0].toUpperCase()}</span>}
            </div>
            <div className="feed-body">
              <div className="feed-meta">
                <span className="feed-who">{name}</span>
                <span className="feed-time">{fmtDate(a.created_at)}</span>
              </div>
              <p className="feed-activity-text">
                {isFinished
                  ? <><strong>{book?.title ?? '책'}</strong>을 완독했어요 🎉</>
                  : <><strong>{book?.title ?? '책'}</strong>을 서재에 추가했어요</>
                }
              </p>
              {isFinished && book?.cover && (
                <img src={book.cover} alt="" className="feed-book-cover" />
              )}
            </div>
            {isFinished
              ? <Award   size={13} className="feed-type-icon feed-icon-finished" />
              : <BookPlus size={13} className="feed-type-icon feed-icon-added"   />
            }
          </div>
        );
      })}
    </div>
  );
}
