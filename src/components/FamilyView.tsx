import { useState, useEffect } from 'react';
import { Users, BookOpen, Award, ShoppingBag, Activity, Trophy, Target, Check, X, Loader, Plus } from 'lucide-react';
import type { Book } from '../types';
import type { Profile } from '../contexts/AuthContext';
import type { MemberStat } from './GroupDashboard';
import { MARKET_ITEMS } from './PointsMarket';
import PointsMarket from './PointsMarket';
import ActivityFeed from './ActivityFeed';
import GoalSetupModal from './GoalSetupModal';
import { supabase } from '../lib/supabase';
import {
  getMyCurrentGoal, getGroupPendingGoals, approveGoal, rejectGoal, cancelGoal,
  type ReadingGoal,
} from '../services/goals';

type FamilyTab   = 'activity' | 'library' | 'market';
type RewardMode  = 'instant' | 'goal';

interface Props {
  members:            Profile[];
  memberPoints:       MemberStat[];
  books:              Book[];
  userId:             string;
  onViewLibrary:      (userId: string) => void;
  onOpenGroupManager: () => void;
}

const MEMBER_COLORS = ['#3b7fd4', '#e91e8c', '#ab47bc', '#26c6da', '#f5a623', '#2ecc71'];
const RANK_EMOJI    = ['🥇', '🥈', '🥉'];

function memberColor(members: Profile[], uid: string) {
  const idx = members.findIndex(m => m.id === uid);
  return MEMBER_COLORS[idx >= 0 ? idx % MEMBER_COLORS.length : 0];
}

export default function FamilyView({
  members, memberPoints, books, userId, onViewLibrary, onOpenGroupManager,
}: Props) {
  const [tab, setTab]                   = useState<FamilyTab>('activity');
  const [rewardMode, setRewardMode]     = useState<RewardMode>('instant');
  const [myGoal, setMyGoal]             = useState<ReadingGoal | null>(null);
  const [pendingGoals, setPendingGoals] = useState<ReadingGoal[]>([]);
  const [goalPreselect, setGoalPreselect] = useState<typeof MARKET_ITEMS[0] | null>(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [resolving, setResolving]       = useState<string | null>(null);
  const [rejectingId, setRejectingId]   = useState<string | null>(null);
  const [rejectNote, setRejectNote]     = useState('');

  // 바로 사용하기 — 인라인 신청
  const [groupId, setGroupId]             = useState<string | null>(null);
  const [approvedCost, setApprovedCost]   = useState(0);
  const [pendingCost, setPendingCost]     = useState(0);
  const [instantConfirming, setInstantConfirming] = useState<typeof MARKET_ITEMS[0] | null>(null);
  const [instantSubmitting, setInstantSubmitting] = useState(false);

  const myPoints      = memberPoints.find(m => m.user_id === userId)?.total_points ?? 0;
  const spendablePoints = myPoints - approvedCost - pendingCost;
  const sortedByPts   = [...memberPoints].sort((a, b) => b.total_points - a.total_points);
  const year          = new Date().getFullYear();

  const loadGoals = async () => {
    const [mine, pending] = await Promise.all([getMyCurrentGoal(), getGroupPendingGoals()]);
    setMyGoal(mine);
    setPendingGoals(pending);
  };

  const loadRedemptions = async () => {
    const { data: membership } = await supabase
      .from('group_members').select('group_id')
      .eq('user_id', userId).eq('status', 'accepted').limit(1).maybeSingle();
    if (!membership) return;
    setGroupId(membership.group_id);

    const yearStart = `${year}-01-01`;
    const yearEnd   = `${year + 1}-01-01`;
    const { data: mine } = await supabase
      .from('point_redemptions').select('status, points_cost')
      .eq('user_id', userId)
      .gte('requested_at', yearStart).lt('requested_at', yearEnd);
    const list = mine ?? [];
    setApprovedCost(list.filter(r => r.status === 'approved').reduce((s: number, r: any) => s + r.points_cost, 0));
    setPendingCost(list.filter(r => r.status === 'pending').reduce((s: number, r: any) => s + r.points_cost, 0));
  };

  useEffect(() => {
    loadGoals();
    loadRedemptions();
  }, [userId]);

  const handleApproveGoal = async (goalId: string) => {
    setResolving(goalId);
    await approveGoal(goalId);
    await loadGoals();
    setResolving(null);
  };

  const handleRejectGoal = async (goalId: string) => {
    setResolving(goalId);
    await rejectGoal(goalId, rejectNote || undefined);
    setRejectingId(null); setRejectNote('');
    await loadGoals();
    setResolving(null);
  };

  const handleCancelGoal = async () => {
    if (!myGoal) return;
    await cancelGoal(myGoal.id);
    setMyGoal(null);
  };

  const handleItemClick = (item: typeof MARKET_ITEMS[0]) => {
    if (rewardMode === 'instant') {
      if (spendablePoints >= item.cost) setInstantConfirming(item);
    } else {
      setGoalPreselect(item);
      setShowGoalModal(true);
    }
  };

  const submitInstant = async () => {
    if (!instantConfirming || !groupId) return;
    setInstantSubmitting(true);
    await supabase.from('point_redemptions').insert({
      user_id: userId, group_id: groupId,
      item_id: instantConfirming.id, item_name: instantConfirming.name,
      points_cost: instantConfirming.cost,
    });
    setInstantConfirming(null);
    await loadRedemptions();
    setInstantSubmitting(false);
  };

  const TABS = [
    { id: 'activity' as const, label: '활동',        icon: <Activity    size={14} /> },
    { id: 'library'  as const, label: '서재',        icon: <BookOpen    size={14} /> },
    { id: 'market'   as const, label: '리워드 마켓', icon: <ShoppingBag size={14} /> },
  ];

  // 내 목표 카드 컴포넌트
  const GoalCard = ({ goal }: { goal: ReadingGoal }) => {
    const isPending  = goal.status === 'pending_approval';
    const progress   = isPending ? 0 : Math.min(100, Math.round((myPoints / goal.points_required) * 100));
    const remaining  = Math.max(0, goal.points_required - myPoints);
    return (
      <div className="goal-card">
        <div className="goal-card-left">
          {goal.item_image_url
            ? <img src={goal.item_image_url} alt="" className="goal-card-img"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            : <span className="goal-card-emoji">{goal.item_emoji ?? '🎁'}</span>
          }
        </div>
        <div className="goal-card-body">
          <div className="goal-card-top">
            <span className="goal-card-name">{goal.item_name}</span>
            {isPending
              ? <span className="goal-status-badge pending">승인 대기</span>
              : <span className="goal-status-badge active">진행 중</span>}
          </div>
          {isPending ? (
            <p className="goal-card-hint">가족 중 한 명이 승인하면 시작돼요!</p>
          ) : (
            <>
              <div className="goal-progress-bar-wrap">
                <div className="goal-progress-bar">
                  <div className="goal-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <span className="goal-progress-text">{myPoints}/{goal.points_required}p</span>
              </div>
              <p className="goal-card-hint">
                {remaining === 0 ? '🎉 목표 달성!' : `목표까지 ${remaining.toLocaleString()}p 남았어요`}
              </p>
            </>
          )}
        </div>
        <button className="goal-card-cancel" onClick={handleCancelGoal} title="목표 취소">
          <X size={14} />
        </button>
      </div>
    );
  };

  return (
    <div className="family-view">
      <div className="family-header">
        <h2 className="family-title">가족</h2>
        <button className="family-manage-btn" onClick={onOpenGroupManager}>
          <Users size={15} /> 그룹 관리
        </button>
      </div>

      <div className="family-subtabs">
        {TABS.map(t => (
          <button key={t.id} className={`family-subtab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}>
            {t.icon}<span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── 활동 ── */}
      {tab === 'activity' && (
        <div className="family-tab-content">
          {members.length < 2
            ? <div className="family-empty">
                <span style={{ fontSize: 36 }}>👨‍👩‍👧</span>
                <p>가족을 초대하면 활동 피드가 보여요!</p>
              </div>
            : <ActivityFeed books={books} members={members} userId={userId} />
          }
        </div>
      )}

      {/* ── 서재 ── */}
      {tab === 'library' && (
        <div className="family-tab-content">
          <div className="family-members-grid">
            {members.map((member, idx) => {
              const color         = MEMBER_COLORS[idx % MEMBER_COLORS.length];
              const stats         = memberPoints.find(m => m.user_id === member.id);
              const memberBooks   = books.filter(b => b.userId === member.id);
              const finished      = memberBooks.filter(b => b.status === 'finished').length;
              const reading       = memberBooks.filter(b => b.status === 'reading').length;
              const isMe          = member.id === userId;
              const rankIdx       = sortedByPts.findIndex(m => m.user_id === member.id);
              const rank          = rankIdx >= 0 ? rankIdx + 1 : null;
              const rankEmoji     = rank != null && rank <= 3 ? RANK_EMOJI[rank - 1] : null;
              const readingCovers = memberBooks.filter(b => b.status === 'reading' && b.cover).slice(0, 3);
              return (
                <div key={member.id} className="family-member-card"
                  style={{ '--member-color': color } as React.CSSProperties}>
                  <div className="family-member-color-bar" style={{ background: color }} />
                  <div className="family-member-top">
                    <div className="family-member-avatar-wrap">
                      <div className="family-member-avatar" style={{ background: color }}>
                        {member.avatar_url
                          ? <img src={member.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                          : member.display_name[0].toUpperCase()}
                      </div>
                      {rankEmoji && <span className="family-member-rank-badge">{rankEmoji}</span>}
                    </div>
                    <div className="family-member-info">
                      <p className="family-member-name">
                        {member.display_name}
                        {isMe && <span className="family-member-me-badge">나</span>}
                      </p>
                      <p className="family-member-pts">
                        <Award size={12} style={{ color: 'var(--accent-yellow)' }} />
                        <strong>{stats?.total_points ?? 0}</strong>pt
                        {rank != null && <span className="family-member-rank-text">{rank}위</span>}
                      </p>
                    </div>
                  </div>
                  <div className="family-member-stats">
                    <div className="family-member-stat">
                      <span className="family-member-stat-val">{finished}</span>
                      <span className="family-member-stat-lbl">완독</span>
                    </div>
                    <div className="family-member-stat">
                      <span className="family-member-stat-val">{reading}</span>
                      <span className="family-member-stat-lbl">읽는 중</span>
                    </div>
                    <div className="family-member-stat">
                      <span className="family-member-stat-val">{memberBooks.length}</span>
                      <span className="family-member-stat-lbl">전체</span>
                    </div>
                  </div>
                  {readingCovers.length > 0 && (
                    <div className="family-member-reading">
                      <span className="family-member-reading-label">읽는 중</span>
                      <div className="family-member-reading-covers">
                        {readingCovers.map(book => (
                          <img key={book.id} src={book.cover} alt={book.title}
                            className="family-member-reading-cover" title={book.title} />
                        ))}
                      </div>
                    </div>
                  )}
                  <button className="family-member-library-btn" onClick={() => onViewLibrary(member.id)}>
                    <BookOpen size={13} /> 서재 보기
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 리워드 마켓 ── */}
      {tab === 'market' && (
        <div className="family-tab-content">

          {/* 내 목표 */}
          <div className="family-section-hd">
            <Target size={15} /><span>내 목표</span>
            {myGoal && (
              <button className="goal-change-btn" onClick={() => { setGoalPreselect(null); setShowGoalModal(true); }}>변경</button>
            )}
          </div>
          {myGoal
            ? <GoalCard goal={myGoal} />
            : <button className="goal-empty-btn" onClick={() => { setGoalPreselect(null); setRewardMode('goal'); setShowGoalModal(true); }}>
                <Target size={16} />
                <span>목표 설정하기</span>
                <span className="goal-empty-hint">원하는 보상을 목표로 설정해보세요!</span>
              </button>
          }

          {/* 승인 요청 */}
          {pendingGoals.length > 0 && (
            <>
              <div className="family-section-hd" style={{ marginTop: 16 }}>
                <Check size={15} /><span>승인 요청</span>
                <span className="market-tab-badge" style={{ marginLeft: 4 }}>{pendingGoals.length}</span>
              </div>
              {pendingGoals.map(goal => {
                const owner = members.find(m => m.id === goal.user_id);
                const color = memberColor(members, goal.user_id);
                return (
                  <div key={goal.id} className="goal-approval-card">
                    <div className="goal-approval-who">
                      <div className="goal-approval-avatar" style={{ background: color }}>
                        {owner?.avatar_url
                          ? <img src={owner.avatar_url} alt="" />
                          : <span>{(owner?.display_name ?? '?')[0].toUpperCase()}</span>}
                      </div>
                      <div>
                        <span className="goal-approval-name">{owner?.display_name ?? '—'}</span>
                        <span className="goal-approval-label">의 목표 승인 요청</span>
                      </div>
                    </div>
                    <div className="goal-approval-item">
                      {goal.item_image_url
                        ? <img src={goal.item_image_url} alt="" className="goal-approval-img"
                            onError={e => { (e.currentTarget as HTMLImageElement).style.display='none'; }} />
                        : <span className="goal-approval-emoji">{goal.item_emoji ?? '🎁'}</span>}
                      <div>
                        <p className="goal-approval-item-name">{goal.item_name}</p>
                        <p className="goal-approval-pts">{goal.points_required.toLocaleString()}p 필요</p>
                      </div>
                    </div>
                    {rejectingId === goal.id ? (
                      <div className="goal-reject-form">
                        <input className="market-reject-input" placeholder="거절 사유 (선택)"
                          value={rejectNote} onChange={e => setRejectNote(e.target.value)} />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn-primary" style={{ flex: 1, background: 'var(--danger)' }}
                            onClick={() => handleRejectGoal(goal.id)} disabled={resolving === goal.id}>
                            {resolving === goal.id ? <Loader size={13} className="spin" /> : '거절'}
                          </button>
                          <button className="btn-secondary" style={{ flex: 1 }}
                            onClick={() => { setRejectingId(null); setRejectNote(''); }}>취소</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-primary" style={{ flex: 1 }}
                          onClick={() => handleApproveGoal(goal.id)} disabled={resolving === goal.id}>
                          {resolving === goal.id ? <Loader size={13} className="spin" /> : <><Check size={13} /> 승인</>}
                        </button>
                        <button className="btn-secondary" onClick={() => setRejectingId(goal.id)}>거절</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* 보상 선택 — 통합 아이템 그리드 */}
          <div className="family-section-hd" style={{ marginTop: 16 }}>
            <ShoppingBag size={15} /><span>보상</span>
          </div>

          {/* 모드 토글 */}
          <div className="reward-mode-tabs">
            <button className={`reward-mode-tab ${rewardMode === 'instant' ? 'active' : ''}`}
              onClick={() => setRewardMode('instant')}>
              💳 바로 사용하기
            </button>
            <button className={`reward-mode-tab ${rewardMode === 'goal' ? 'active' : ''}`}
              onClick={() => setRewardMode('goal')}>
              🎯 목표로 설정하기
            </button>
          </div>

          {rewardMode === 'instant' && (
            <p className="reward-mode-desc">포인트를 바로 사용해 보상을 신청해요. 부모님 승인 후 지급됩니다.</p>
          )}
          {rewardMode === 'goal' && (
            <p className="reward-mode-desc">원하는 보상을 목표로 설정하고 포인트를 모아요!</p>
          )}

          <div className="goal-preset-grid">
            {MARKET_ITEMS.map(item => {
              const canAfford  = spendablePoints >= item.cost;
              const isDisabled = rewardMode === 'instant' && !canAfford;
              return (
                <button key={item.id}
                  className={`goal-preset-card ${isDisabled ? 'disabled' : ''}`}
                  style={{ '--item-color': item.color, '--item-bg': item.bg, '--item-border': item.border } as React.CSSProperties}
                  onClick={() => !isDisabled && handleItemClick(item)}
                  disabled={isDisabled}
                >
                  <div className="goal-preset-emoji">{item.emoji}</div>
                  <div className="goal-preset-name">{item.name}</div>
                  <div className="goal-preset-pts" style={{ color: item.color }}>{item.cost.toLocaleString()}p</div>
                  {isDisabled && <div className="market-item-lock">포인트 부족</div>}
                </button>
              );
            })}
            {/* 직접 설정하기 — 목표 모드에서만 */}
            {rewardMode === 'goal' && (
              <button className="goal-preset-card goal-preset-custom"
                onClick={() => { setGoalPreselect(null); setShowGoalModal(true); }}>
                <div className="goal-preset-emoji"><Plus size={22} /></div>
                <div className="goal-preset-name">직접 설정</div>
                <div className="goal-preset-pts" style={{ color: 'var(--text-muted)' }}>직접 입력</div>
              </button>
            )}
          </div>

          {/* 바로 사용하기 확인 모달 */}
          {instantConfirming && (
            <div className="modal-overlay modal-overlay--center" onClick={() => !instantSubmitting && setInstantConfirming(null)}>
              <div className="modal modal-dialog" onClick={e => e.stopPropagation()}>
                <div className="market-confirm-body">
                  <div className="market-confirm-emoji">{instantConfirming.emoji}</div>
                  <h3 className="market-confirm-title">{instantConfirming.name}</h3>
                  <p className="market-confirm-desc">{instantConfirming.desc}</p>
                  <div className="market-confirm-cost">
                    <span>{instantConfirming.cost.toLocaleString()}pt 차감</span>
                    <span className="market-confirm-remain">잔여 {(spendablePoints - instantConfirming.cost).toLocaleString()}pt</span>
                  </div>
                  <p className="market-confirm-hint">그룹장이 승인하면 최종 차감돼요.</p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    <button className="btn-secondary" style={{ flex: 1 }}
                      onClick={() => setInstantConfirming(null)} disabled={instantSubmitting}>취소</button>
                    <button className="btn-primary" style={{ flex: 1 }}
                      onClick={submitInstant} disabled={instantSubmitting}>
                      {instantSubmitting ? <><Loader size={14} className="spin" /> 신청 중...</> : '신청하기'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 신청 내역 / 관리 */}
          <PointsMarket userId={userId} totalEarnedPoints={myPoints} hideShop />

          {/* 포인트 순위 */}
          <div className="family-section-hd" style={{ marginTop: 16 }}>
            <Trophy size={15} /><span>{year}년 포인트 순위</span>
          </div>
          {sortedByPts.length >= 2 && (
            <div className="family-podium">
              {[1, 0, 2].map(ri => {
                const stat   = sortedByPts[ri];
                if (!stat) return <div key={ri} className="family-podium-slot empty" />;
                const member = members.find(m => m.id === stat.user_id);
                const color  = memberColor(members, stat.user_id);
                return (
                  <div key={ri} className={`family-podium-slot rank-${ri + 1}`}>
                    <div className="family-podium-emoji">{RANK_EMOJI[ri] ?? ''}</div>
                    <div className="family-podium-avatar"
                      style={{ background: color, width: ri === 0 ? 52 : 42, height: ri === 0 ? 52 : 42 }}>
                      {member?.avatar_url
                        ? <img src={member.avatar_url} alt="" />
                        : <span>{(member?.display_name ?? '?')[0].toUpperCase()}</span>}
                    </div>
                    <div className="family-podium-name">{member?.display_name ?? '—'}</div>
                    <div className="family-podium-pts" style={{ color }}>{stat.total_points.toLocaleString()}pt</div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="family-rank-list">
            {sortedByPts.map((stat, idx) => {
              const member = members.find(m => m.id === stat.user_id);
              const color  = memberColor(members, stat.user_id);
              const isMe   = stat.user_id === userId;
              const rank   = idx + 1;
              return (
                <div key={stat.user_id} className={`family-rank-row ${isMe ? 'me' : ''}`}>
                  <span className="family-rank-no">{rank <= 3 ? RANK_EMOJI[rank - 1] : rank}</span>
                  <div className="family-rank-avatar" style={{ background: color }}>
                    {member?.avatar_url
                      ? <img src={member.avatar_url} alt="" />
                      : <span>{(member?.display_name ?? '?')[0].toUpperCase()}</span>}
                  </div>
                  <div className="family-rank-info">
                    <span className="family-rank-name">
                      {member?.display_name ?? '—'}
                      {isMe && <span className="family-member-me-badge">나</span>}
                    </span>
                    <div className="family-rank-breakdown">
                      <span>책 추가 {stat.book_added_points}pt</span>
                      <span>감상문 {stat.review_approved_points}pt</span>
                    </div>
                  </div>
                  <span className="family-rank-pts" style={{ color }}>{stat.total_points.toLocaleString()}pt</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 목표 설정 모달 */}
      {showGoalModal && (
        <GoalSetupModal
          preselected={goalPreselect}
          onClose={() => { setShowGoalModal(false); setGoalPreselect(null); }}
          onCreated={() => { setShowGoalModal(false); setGoalPreselect(null); loadGoals(); }}
        />
      )}
    </div>
  );
}
