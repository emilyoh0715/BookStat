import { useState, useEffect } from 'react';
import { ShoppingBag, Clock, CheckCircle, XCircle, ChevronRight, Loader, Bell, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

/* ── 마켓 아이템 정의 ── */
export const MARKET_ITEMS = [
  {
    id: 'snack',
    name: '편의점 간식',
    emoji: '🍭',
    cost: 100,
    desc: '편의점에서 원하는 간식 마음껏',
    color: '#e91e8c',
    bg: 'rgba(233,30,140,0.08)',
    border: 'rgba(233,30,140,0.2)',
  },
  {
    id: 'stationery',
    name: '문구용품',
    emoji: '✏️',
    cost: 300,
    desc: '예쁜 노트 · 펜 · 스티커 세트',
    color: '#f5a623',
    bg: 'rgba(245,166,35,0.08)',
    border: 'rgba(245,166,35,0.2)',
  },
  {
    id: 'craft_kit',
    name: '만들기 세트',
    emoji: '🎨',
    cost: 500,
    desc: '공예 · 클레이 · DIY 키트 1개',
    color: '#26c6da',
    bg: 'rgba(38,198,218,0.08)',
    border: 'rgba(38,198,218,0.2)',
  },
  {
    id: 'doll_keyring',
    name: '인형 키링',
    emoji: '🧸',
    cost: 1000,
    desc: '귀여운 캐릭터 인형 키링 1개',
    color: '#ab47bc',
    bg: 'rgba(171,71,188,0.08)',
    border: 'rgba(171,71,188,0.2)',
  },
];

interface Redemption {
  id: string;
  user_id: string;
  group_id: string;
  item_id: string;
  item_name: string;
  points_cost: number;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  resolved_at: string | null;
  note: string | null;
  profiles?: { display_name: string; handle: string; avatar_url: string | null };
}

interface Props {
  userId: string;
  totalEarnedPoints: number;
}

const STATUS_META = {
  pending:  { label: '검토 중',  icon: <Clock size={13} />,        color: '#f5a623' },
  approved: { label: '승인됨',   icon: <CheckCircle size={13} />, color: '#2ecc71' },
  rejected: { label: '거절됨',   icon: <XCircle size={13} />,     color: 'var(--danger)' },
};

export default function PointsMarket({ userId, totalEarnedPoints }: Props) {
  const [tab, setTab] = useState<'shop' | 'history' | 'admin'>('shop');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [myRedemptions, setMyRedemptions]     = useState<Redemption[]>([]);
  const [adminRequests, setAdminRequests]     = useState<Redemption[]>([]);
  const [approvedCost, setApprovedCost]       = useState(0);
  const [pendingCost, setPendingCost]         = useState(0);
  const [confirming, setConfirming]           = useState<typeof MARKET_ITEMS[0] | null>(null);
  const [submitting, setSubmitting]           = useState(false);
  const [resolving, setResolving]             = useState<string | null>(null);
  const [rejectNote, setRejectNote]           = useState('');
  const [rejectingId, setRejectingId]         = useState<string | null>(null);
  const [cancelling, setCancelling]           = useState<string | null>(null);

  const availablePoints = totalEarnedPoints - approvedCost;
  const spendablePoints = availablePoints - pendingCost;

  const loadData = async () => {
    // 그룹 & 역할 조회
    const { data: membership } = await supabase
      .from('group_members')
      .select('group_id, role')
      .eq('user_id', userId)
      .eq('status', 'accepted')
      .limit(1)
      .maybeSingle();

    if (!membership) return;
    setGroupId(membership.group_id);

    // 내 신청 내역
    const { data: mine } = await supabase
      .from('point_redemptions')
      .select('*')
      .eq('user_id', userId)
      .order('requested_at', { ascending: false });

    const list = (mine ?? []) as Redemption[];
    setMyRedemptions(list);
    setApprovedCost(list.filter(r => r.status === 'approved').reduce((s, r) => s + r.points_cost, 0));
    setPendingCost(list.filter(r => r.status === 'pending').reduce((s, r) => s + r.points_cost, 0));

    // 그룹 전체 신청 내역 (본인 제외 승인 가능)
    const { data: all } = await supabase
      .from('point_redemptions')
      .select('*, profiles(display_name, handle, avatar_url)')
      .eq('group_id', membership.group_id)
      .order('requested_at', { ascending: false });
    setAdminRequests((all ?? []) as Redemption[]);
  };

  useEffect(() => { loadData(); }, [userId]);

  /* ── 신청 제출 ── */
  const submitRequest = async () => {
    if (!confirming || !groupId) return;
    if (spendablePoints < confirming.cost) return;
    setSubmitting(true);
    await supabase.from('point_redemptions').insert({
      user_id: userId,
      group_id: groupId,
      item_id: confirming.id,
      item_name: confirming.name,
      points_cost: confirming.cost,
    });
    setConfirming(null);
    await loadData();
    setTab('history');
    setSubmitting(false);
  };

  /* ── 취소 ── */
  const cancelRequest = async (id: string) => {
    setCancelling(id);
    await supabase.from('point_redemptions').delete().eq('id', id);
    await loadData();
    setCancelling(null);
  };

  /* ── 승인 ── */
  const approve = async (id: string) => {
    setResolving(id);
    await supabase.from('point_redemptions').update({
      status: 'approved',
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
    }).eq('id', id);
    await loadData();
    setResolving(null);
  };

  /* ── 거절 ── */
  const reject = async (id: string) => {
    setResolving(id);
    await supabase.from('point_redemptions').update({
      status: 'rejected',
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
      note: rejectNote || null,
    }).eq('id', id);
    setRejectingId(null);
    setRejectNote('');
    await loadData();
    setResolving(null);
  };

  const pendingAdminCount = adminRequests.filter(r => r.status === 'pending' && r.user_id !== userId).length;

  return (
    <div className="market-page">
      <div className="market-header">
        <div>
          <h2 className="market-title">🛍️ 포인트 마켓</h2>
          <p className="market-subtitle">독서 포인트로 선물을 신청해보세요</p>
        </div>
        <div className="market-balance-box">
          <div className="market-balance-label">사용 가능</div>
          <div className="market-balance-value">{spendablePoints.toLocaleString()}pt</div>
          {pendingCost > 0 && (
            <div className="market-balance-pending">검토 중 -{pendingCost}pt</div>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="market-tabs">
        <button className={`market-tab ${tab === 'shop' ? 'active' : ''}`} onClick={() => setTab('shop')}>
          <ShoppingBag size={14} /> 마켓
        </button>
        <button className={`market-tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          <Clock size={14} /> 내 신청
          {myRedemptions.filter(r => r.status === 'pending').length > 0 && (
            <span className="market-tab-badge">{myRedemptions.filter(r => r.status === 'pending').length}</span>
          )}
        </button>
        {groupId && (
          <button className={`market-tab ${tab === 'admin' ? 'active' : ''}`} onClick={() => setTab('admin')}>
            <Bell size={14} /> 신청 관리
            {pendingAdminCount > 0 && <span className="market-tab-badge">{pendingAdminCount}</span>}
          </button>
        )}
      </div>

      {/* ── 마켓 탭 ── */}
      {tab === 'shop' && (
        <div className="market-grid">
          {MARKET_ITEMS.map(item => {
            const canAfford = spendablePoints >= item.cost;
            return (
              <button
                key={item.id}
                className={`market-item-card ${!canAfford ? 'disabled' : ''}`}
                style={{ '--item-color': item.color, '--item-bg': item.bg, '--item-border': item.border } as React.CSSProperties}
                onClick={() => canAfford && setConfirming(item)}
                disabled={!canAfford}
              >
                <div className="market-item-emoji">{item.emoji}</div>
                <div className="market-item-name">{item.name}</div>
                <div className="market-item-desc">{item.desc}</div>
                <div className="market-item-cost" style={{ color: item.color }}>
                  {item.cost.toLocaleString()}pt
                </div>
                {!canAfford && <div className="market-item-lock">포인트 부족</div>}
                {canAfford && (
                  <div className="market-item-cta">
                    신청하기 <ChevronRight size={13} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── 내 신청 내역 ── */}
      {tab === 'history' && (
        <div className="market-list">
          {myRedemptions.length === 0 ? (
            <div className="market-empty">
              <span style={{ fontSize: 40 }}>🛒</span>
              <p>아직 신청 내역이 없어요.<br />마켓에서 원하는 아이템을 신청해보세요!</p>
            </div>
          ) : myRedemptions.map(r => {
            const item = MARKET_ITEMS.find(i => i.id === r.item_id);
            const meta = STATUS_META[r.status];
            return (
              <div key={r.id} className="market-history-row">
                <div className="market-history-emoji">{item?.emoji ?? '🎁'}</div>
                <div className="market-history-info">
                  <span className="market-history-name">{r.item_name}</span>
                  <span className="market-history-date">{r.requested_at.split('T')[0]}</span>
                  {r.note && <span className="market-history-note">{r.note}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <span className="market-history-pts">-{r.points_cost}pt</span>
                  {r.status === 'pending' ? (
                    <button
                      className="market-cancel-btn"
                      onClick={() => cancelRequest(r.id)}
                      disabled={cancelling === r.id}
                    >
                      {cancelling === r.id
                        ? <Loader size={11} className="spin" />
                        : <><Trash2 size={11} /> 취소</>}
                    </button>
                  ) : (
                    <span className="market-status-badge" style={{ color: meta.color }}>
                      {meta.icon} {meta.label}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 신청 관리 (본인 제외 모든 멤버) ── */}
      {tab === 'admin' && groupId && (
        <div className="market-list">
          {adminRequests.length === 0 ? (
            <div className="market-empty">
              <span style={{ fontSize: 40 }}>📭</span>
              <p>신청 내역이 없어요.</p>
            </div>
          ) : adminRequests.map(r => {
            const item = MARKET_ITEMS.find(i => i.id === r.item_id);
            const meta = STATUS_META[r.status];
            const isPending = r.status === 'pending';
            const isSelf = r.user_id === userId;
            return (
              <div key={r.id} className={`market-admin-row ${isPending ? 'pending' : ''}`}>
                <div className="market-history-emoji">{item?.emoji ?? '🎁'}</div>
                <div className="market-history-info">
                  <span className="market-history-name">{r.item_name}</span>
                  <span className="market-admin-who">
                    {(r.profiles as Redemption['profiles'])?.display_name ?? '—'}
                    {isSelf && <span className="market-self-tag">나</span>}
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                      {' '}@{(r.profiles as Redemption['profiles'])?.handle}
                    </span>
                  </span>
                  <span className="market-history-date">{r.requested_at.split('T')[0]}</span>
                  {r.note && <span className="market-history-note">{r.note}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, minWidth: 80 }}>
                  <span className="market-history-pts">-{r.points_cost}pt</span>
                  {isPending ? (
                    isSelf ? (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>본인 신청</span>
                    ) : rejectingId === r.id ? (
                      <div className="market-reject-form">
                        <input
                          className="market-reject-input"
                          placeholder="거절 사유 (선택)"
                          value={rejectNote}
                          onChange={e => setRejectNote(e.target.value)}
                        />
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="market-btn-approve" style={{ background: 'var(--danger)' }} onClick={() => reject(r.id)} disabled={resolving === r.id}>
                            {resolving === r.id ? <Loader size={12} className="spin" /> : '거절'}
                          </button>
                          <button className="market-btn-reject" onClick={() => { setRejectingId(null); setRejectNote(''); }}>취소</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="market-btn-approve" onClick={() => approve(r.id)} disabled={resolving === r.id}>
                          {resolving === r.id ? <Loader size={12} className="spin" /> : '승인'}
                        </button>
                        <button className="market-btn-reject" onClick={() => setRejectingId(r.id)}>거절</button>
                      </div>
                    )
                  ) : (
                    <span className="market-status-badge" style={{ color: meta.color }}>
                      {meta.icon} {meta.label}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 신청 확인 모달 ── */}
      {confirming && (
        <div className="modal-overlay" onClick={() => !submitting && setConfirming(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="market-confirm-body">
              <div className="market-confirm-emoji">{confirming.emoji}</div>
              <h3 className="market-confirm-title">{confirming.name}</h3>
              <p className="market-confirm-desc">{confirming.desc}</p>
              <div className="market-confirm-cost">
                <span>{confirming.cost.toLocaleString()}pt 차감</span>
                <span className="market-confirm-remain">
                  잔여 {(spendablePoints - confirming.cost).toLocaleString()}pt
                </span>
              </div>
              <p className="market-confirm-hint">그룹장이 승인하면 최종 차감돼요.</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setConfirming(null)} disabled={submitting}>
                  취소
                </button>
                <button className="btn-primary" style={{ flex: 1 }} onClick={submitRequest} disabled={submitting}>
                  {submitting ? <><Loader size={14} className="spin" /> 신청 중...</> : '신청하기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
