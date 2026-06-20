import { useState, useEffect, useMemo } from 'react';
import { Activity, Check, X, ChevronRight, Loader, Bell, BookPlus, Award, MessageCircle, PenLine } from 'lucide-react';
import type { Book } from '../types';
import type { Profile } from '../contexts/AuthContext';
import type { MemberStat } from './GroupDashboard';
import { MARKET_ITEMS } from './PointsMarket';
import { supabase } from '../lib/supabase';
import { getGroupPendingGoals, approveGoal, rejectGoal, type ReadingGoal } from '../services/goals';
import { getGroupActivityComments, type BookComment } from '../services/comments';

interface Redemption {
  id: string;
  user_id: string;
  item_id: string;
  item_name: string;
  points_cost: number;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
}

interface Props {
  books: Book[];
  members: Profile[];
  memberPoints: MemberStat[];
  userId: string;
  onNavigateToFamily: () => void;
}

const MEMBER_COLORS = ['#3b7fd4', '#e91e8c', '#ab47bc', '#26c6da', '#f5a623', '#2ecc71'];
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function memberColor(members: Profile[], uid: string) {
  const idx = members.findIndex(m => m.id === uid);
  return MEMBER_COLORS[idx >= 0 ? idx % MEMBER_COLORS.length : 0];
}

function fmtRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;
  return `${Math.floor(diffHr / 24)}일 전`;
}

type FeedItem =
  | { kind: 'comment'; data: BookComment; sortKey: string }
  | { kind: 'book_added' | 'book_finished' | 'review_added'; book: Book; sortKey: string };

export default function RightPanel({ books, members, memberPoints, userId, onNavigateToFamily }: Props) {
  const [comments, setComments]       = useState<BookComment[]>([]);
  const [pendingGoals, setPendingGoals] = useState<ReadingGoal[]>([]);
  const [adminPending, setAdminPending] = useState<Redemption[]>([]);
  const [resolving, setResolving]     = useState<string | null>(null);

  const loadData = async () => {
    const [commentData, goalData] = await Promise.all([
      getGroupActivityComments(50),
      getGroupPendingGoals(),
    ]);
    setComments(commentData);
    setPendingGoals(goalData);

    const year = new Date().getFullYear();
    const { data: membership } = await supabase
      .from('group_members').select('group_id')
      .eq('user_id', userId).eq('status', 'accepted').limit(1).maybeSingle();
    if (!membership) return;

    const { data: pending } = await supabase
      .from('point_redemptions').select('*')
      .eq('group_id', membership.group_id)
      .eq('status', 'pending')
      .neq('user_id', userId)
      .gte('requested_at', `${year}-01-01`)
      .lt('requested_at', `${year + 1}-01-01`)
      .order('requested_at', { ascending: false });
    setAdminPending((pending ?? []) as Redemption[]);
  };

  useEffect(() => {
    loadData();
    const ch = supabase
      .channel('right-panel-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'book_comments' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reading_goals' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'point_redemptions' }, loadData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  const handleApproveGoal = async (id: string) => {
    setResolving(id);
    await approveGoal(id);
    await loadData();
    setResolving(null);
  };

  const handleRejectGoal = async (id: string) => {
    setResolving(id);
    await rejectGoal(id);
    await loadData();
    setResolving(null);
  };

  const handleApproveRedemption = async (id: string) => {
    setResolving(id);
    await supabase.from('point_redemptions').update({
      status: 'approved', resolved_at: new Date().toISOString(),
    }).eq('id', id);
    await loadData();
    setResolving(null);
  };

  const feed = useMemo((): FeedItem[] => {
    const cutoff = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
    const bookItems: FeedItem[] = books
      .filter(b => b.userId !== userId)
      .flatMap(b => {
        const items: FeedItem[] = [];
        if (b.status !== 'want-to-read' && b.createdAt >= cutoff)
          items.push({ kind: 'book_added', book: b, sortKey: b.createdAt });
        if (b.status === 'finished' && b.finishDate) {
          const finishISO = `${b.finishDate}T12:00:00.000Z`;
          if (finishISO >= cutoff)
            items.push({ kind: 'book_finished', book: b, sortKey: finishISO });
        }
        if (b.review?.trim() && b.reviewCreatedAt && b.reviewCreatedAt >= cutoff)
          items.push({ kind: 'review_added', book: b, sortKey: b.reviewCreatedAt });
        return items;
      });
    const commentItems: FeedItem[] = comments
      .filter(c => c.user_id !== userId && c.created_at >= cutoff)
      .map(c => ({ kind: 'comment' as const, data: c, sortKey: c.created_at }));
    return [...bookItems, ...commentItems]
      .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
      .slice(0, 10);
  }, [books, comments, userId]);

  const totalPending = pendingGoals.length + adminPending.length;
  const todayStr    = new Date().toISOString().slice(0, 10);
  const todayBooks  = books.filter(b => b.finishDate === todayStr).length;
  const totalPts    = memberPoints.reduce((s, m) => s + m.total_points, 0);

  const getMember = (uid: string) => members.find(m => m.id === uid);

  // merged approval list (max 3)
  const approvalList = [
    ...pendingGoals.map(g => ({
      type: 'goal' as const, id: g.id, userId: g.user_id,
      name: g.item_name, emoji: g.item_emoji ?? '🎁',
      detail: `${g.points_required.toLocaleString()}p 필요`,
    })),
    ...adminPending.map(r => ({
      type: 'redemption' as const, id: r.id, userId: r.user_id,
      name: r.item_name,
      emoji: MARKET_ITEMS.find(i => i.id === r.item_id)?.emoji ?? '🎁',
      detail: `${r.points_cost.toLocaleString()}p 차감`,
    })),
  ].slice(0, 3);

  return (
    <aside className="right-panel">

      {/* 신청 관리 */}
      {totalPending > 0 && (
        <section className="rp-section">
          <div className="rp-section-hd">
            <Bell size={13} />
            <span>신청 관리</span>
            <span className="rp-badge">{totalPending}</span>
            <button className="rp-see-all-btn" onClick={onNavigateToFamily}>
              모두 보기 <ChevronRight size={11} />
            </button>
          </div>
          <div className="rp-approvals">
            {approvalList.map(req => {
              const owner = getMember(req.userId);
              const color = memberColor(members, req.userId);
              return (
                <div key={`${req.type}-${req.id}`} className="rp-approval-row">
                  <div className="rp-approval-avatar" style={{ background: color }}>
                    {owner?.avatar_url
                      ? <img src={owner.avatar_url} alt="" />
                      : <span>{(owner?.display_name ?? '?')[0].toUpperCase()}</span>}
                  </div>
                  <div className="rp-approval-info">
                    <span className="rp-approval-who">{owner?.display_name ?? '—'}</span>
                    <span className="rp-approval-item">{req.emoji} {req.name} · {req.detail}</span>
                  </div>
                  <div className="rp-approval-actions">
                    <button className="rp-btn-approve"
                      onClick={() => req.type === 'goal' ? handleApproveGoal(req.id) : handleApproveRedemption(req.id)}
                      disabled={resolving === req.id}>
                      {resolving === req.id ? <Loader size={10} className="spin" /> : <Check size={10} />}
                    </button>
                    <button className="rp-btn-reject"
                      onClick={() => req.type === 'goal' ? handleRejectGoal(req.id) : null}
                      disabled={resolving === req.id}>
                      <X size={10} />
                    </button>
                  </div>
                </div>
              );
            })}
            {totalPending > 3 && (
              <button className="rp-more-link" onClick={onNavigateToFamily}>
                +{totalPending - 3}개 더 <ChevronRight size={11} />
              </button>
            )}
          </div>
        </section>
      )}

      {/* 가족 활동 피드 */}
      <section className="rp-section rp-section--grow">
        <div className="rp-section-hd">
          <Activity size={13} />
          <span>가족 활동</span>
          <button className="rp-see-all-btn" onClick={onNavigateToFamily}>
            전체 보기 <ChevronRight size={11} />
          </button>
        </div>
        {members.length < 2 ? (
          <p className="rp-empty">가족을 초대하면 활동이 보여요!</p>
        ) : feed.length === 0 ? (
          <p className="rp-empty">최근 7일간 가족 활동이 없어요</p>
        ) : (
          <div className="rp-feed">
            {feed.map((item) => {
              if (item.kind === 'comment') {
                const c      = item.data;
                const member = getMember(c.user_id);
                const name   = member?.display_name ?? '—';
                const color  = memberColor(members, c.user_id);
                const bookTitle = books.find(b => b.id === c.book_id)?.title;
                return (
                  <div key={`c-${c.id}`} className="rp-feed-item">
                    <div className="rp-feed-avatar" style={{ background: color }}>
                      {member?.avatar_url ? <img src={member.avatar_url} alt="" /> : name[0].toUpperCase()}
                    </div>
                    <div className="rp-feed-body">
                      <p className="rp-feed-text">
                        <strong>{name}</strong>{bookTitle ? `이 《${bookTitle}》에 댓글을 달았어요` : '이 댓글을 달았어요'}
                      </p>
                      <span className="rp-feed-time">{fmtRelative(c.created_at)}</span>
                    </div>
                    <MessageCircle size={11} className="rp-feed-icon rp-icon-comment" />
                  </div>
                );
              }
              const { book, kind, sortKey } = item;
              const member    = getMember(book.userId ?? '');
              const name      = member?.display_name ?? '—';
              const color     = memberColor(members, book.userId ?? '');
              const isFinished = kind === 'book_finished';
              const isReview   = kind === 'review_added';
              return (
                <div key={`a-${book.id}-${kind}`} className="rp-feed-item">
                  <div className="rp-feed-avatar" style={{ background: color }}>
                    {member?.avatar_url ? <img src={member.avatar_url} alt="" /> : name[0].toUpperCase()}
                  </div>
                  <div className="rp-feed-body">
                    <p className="rp-feed-text">
                      <strong>{name}</strong>{isReview
                        ? `이 《${book.title}》 감상문을 남겼어요`
                        : isFinished
                        ? `이 《${book.title}》을 완독했어요 🎉`
                        : `이 《${book.title}》을 추가했어요`}
                    </p>
                    <span className="rp-feed-time">{fmtRelative(sortKey)}</span>
                  </div>
                  {isReview
                    ? <PenLine  size={11} className="rp-feed-icon rp-icon-review" />
                    : isFinished
                    ? <Award    size={11} className="rp-feed-icon rp-icon-finished" />
                    : <BookPlus size={11} className="rp-feed-icon rp-icon-added" />}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 오늘 요약 */}
      <div className="rp-daily-summary">
        <span className="rp-daily-label">오늘 가족 합산</span>
        <div className="rp-daily-stats">
          <span>📚 {todayBooks}권 완독</span>
          <span>⭐ {totalPts.toLocaleString()}pt</span>
        </div>
      </div>
    </aside>
  );
}
