import { Award, BookOpen, CheckCircle, Clock, BookPlus, Star, HelpCircle } from 'lucide-react';
import type { Book } from '../types';

export interface MemberStat {
  user_id: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  total_points: number;
  book_added_points: number;
  review_approved_points: number;
}

interface Props {
  members: MemberStat[];
  books: Book[];
  loading: boolean;
}

const RANK_COLORS = ['#f5c518', '#adb5bd', '#cd7f32'];
const RANK_LABELS = ['🥇', '🥈', '🥉'];

function Avatar({ member, size = 36 }: { member: MemberStat; size?: number }) {
  const bg = `hsl(${member.display_name.charCodeAt(0) * 37 % 360}, 50%, 42%)`;
  return (
    <div style={{
      width: size, height: size, minWidth: size, borderRadius: '50%',
      background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 700, color: '#fff', overflow: 'hidden',
    }}>
      {member.avatar_url
        ? <img src={member.avatar_url} alt={member.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : member.display_name[0].toUpperCase()}
    </div>
  );
}

export default function GroupDashboard({ members, books, loading }: Props) {
  const maxPoints = Math.max(...members.map(m => m.total_points), 1);

  const getStats = (userId: string) => {
    const ub = books.filter(b => b.userId === userId);
    return {
      total: ub.length,
      finished: ub.filter(b => b.status === 'finished').length,
      reading: ub.filter(b => b.status === 'reading').length,
      wantToRead: ub.filter(b => b.status === 'want-to-read').length,
    };
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
        <div className="cover-spinner" />
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="empty-state">
        <p>그룹 멤버가 없어요.<br />그룹에 참여하거나 멤버를 초대해보세요.</p>
      </div>
    );
  }

  return (
    <div className="gd-page">
      <h2 className="gd-page-heading">그룹 대시보드</h2>

      {/* ── 포인트 랭킹 바 차트 ── */}
      <section className="gd-page-section">
        <h3 className="gd-page-section-title">
          <Award size={16} /> 포인트 랭킹
        </h3>
        {/* 범례 */}
        <div className="gd-chart-legend">
          <span className="gd-chart-legend-item">
            <span className="gd-chart-legend-dot" style={{ background: '#3b7fd4' }} />
            책 추가
          </span>
          <span className="gd-chart-legend-item">
            <span className="gd-chart-legend-dot" style={{ background: '#f5a623' }} />
            완독 후기
          </span>
        </div>

        <div className="gd-chart">
          {members.map((m, i) => {
            const addedPct    = maxPoints > 0 ? (m.book_added_points    / maxPoints) * 100 : 0;
            const reviewPct   = maxPoints > 0 ? (m.review_approved_points / maxPoints) * 100 : 0;

            return (
              <div key={m.user_id} className="gd-chart-row">
                {/* 순위 */}
                <span className="gd-chart-rank" style={{ color: RANK_COLORS[i] ?? 'var(--text-muted)' }}>
                  {i < 3 ? RANK_LABELS[i] : i + 1}
                </span>

                {/* 아바타 + 이름 */}
                <div className="gd-chart-identity">
                  <Avatar member={m} size={32} />
                  <div className="gd-chart-names">
                    <span className="gd-chart-name">{m.display_name}</span>
                    {m.handle && <span className="gd-chart-handle">@{m.handle}</span>}
                  </div>
                </div>

                {/* 스택 바 */}
                <div className="gd-chart-bar-wrap">
                  <div className="gd-chart-bar-fill" style={{ width: `${addedPct}%`, background: '#3b7fd4' }} />
                  <div className="gd-chart-bar-fill" style={{ width: `${reviewPct}%`, background: '#f5a623' }} />
                </div>

                {/* 포인트 상세 */}
                <div className="gd-chart-pts-detail">
                  <span className="gd-chart-pts">{m.total_points}pt</span>
                  <span className="gd-chart-pts-sub">
                    <span style={{ color: '#3b7fd4' }}>{m.book_added_points}</span>
                    {' + '}
                    <span style={{ color: '#f5a623' }}>{m.review_approved_points}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 포인트 가이드 ── */}
      <section className="gd-page-section">
        <h3 className="gd-page-section-title">
          <HelpCircle size={16} /> 포인트 획득 방법
        </h3>
        <div className="gd-guide">
          <div className="gd-guide-row">
            <div className="gd-guide-icon" style={{ background: 'rgba(59,127,212,0.12)', color: '#3b7fd4' }}>
              <BookPlus size={18} />
            </div>
            <div className="gd-guide-body">
              <span className="gd-guide-title">책 추가</span>
              <span className="gd-guide-desc">서재에 책을 추가하면 <b>+1점</b> (읽고 싶음 제외)</span>
            </div>
            <span className="gd-guide-pts">+1pt</span>
          </div>

          <div className="gd-guide-divider" />

          <div className="gd-guide-row">
            <div className="gd-guide-icon" style={{ background: 'rgba(245,166,35,0.12)', color: '#f5a623' }}>
              <Star size={18} />
            </div>
            <div className="gd-guide-body">
              <span className="gd-guide-title">완독 후기 승인</span>
              <span className="gd-guide-desc">다 읽은 책의 후기를 AI가 검증해 승인하면 페이지 수에 따라 포인트 지급</span>
            </div>
            <span className="gd-guide-pts" style={{ color: '#f5a623' }}>+3~18pt</span>
          </div>

          <div className="gd-guide-pts-table">
            <div className="gd-guide-pts-row">
              <span>~100p</span>
              <span>한국어 <b>3pt</b> / 외국어 <b>5pt</b></span>
            </div>
            <div className="gd-guide-pts-row">
              <span>~300p</span>
              <span>한국어 <b>5pt</b> / 외국어 <b>8pt</b></span>
            </div>
            <div className="gd-guide-pts-row">
              <span>~500p</span>
              <span>한국어 <b>8pt</b> / 외국어 <b>12pt</b></span>
            </div>
            <div className="gd-guide-pts-row">
              <span>501p~</span>
              <span>한국어 <b>12pt</b> / 외국어 <b>18pt</b></span>
            </div>
          </div>

          <div className="gd-guide-note">
            후기는 30자 이상, 책과 관련된 완전한 문장이어야 승인됩니다.
          </div>
        </div>
      </section>

      {/* ── 독서 현황 카드 ── */}
      <section className="gd-page-section">
        <h3 className="gd-page-section-title">
          <BookOpen size={16} /> 독서 현황
        </h3>
        <div className="gd-member-grid">
          {members.map(m => {
            const s = getStats(m.user_id);
            return (
              <div key={m.user_id} className="gd-member-card">
                <div className="gd-member-card-top">
                  <Avatar member={m} size={40} />
                  <div>
                    <div className="gd-chart-name">{m.display_name}</div>
                    <div style={{ fontSize: 12, color: '#f5a623', fontWeight: 700 }}>{m.total_points}pt</div>
                  </div>
                </div>
                <div className="gd-member-card-stats">
                  <div className="gd-stat-pill" style={{ color: '#2ecc71' }}>
                    <CheckCircle size={12} /> 완독 {s.finished}
                  </div>
                  <div className="gd-stat-pill" style={{ color: '#3b7fd4' }}>
                    <BookOpen size={12} /> 읽는 중 {s.reading}
                  </div>
                  <div className="gd-stat-pill" style={{ color: '#5ba8e5' }}>
                    <Clock size={12} /> 읽고 싶음 {s.wantToRead}
                  </div>
                  <div className="gd-stat-pill">전체 {s.total}권</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
