import { Users, BookOpen, Award, ShoppingBag } from 'lucide-react';
import type { Book } from '../types';
import type { Profile } from '../contexts/AuthContext';
import type { MemberStat } from './GroupDashboard';
import PointsMarket from './PointsMarket';

interface Props {
  members: Profile[];
  memberPoints: MemberStat[];
  books: Book[];
  userId: string;
  onViewLibrary: (userId: string) => void;
  onOpenGroupManager: () => void;
}

const MEMBER_COLORS = ['#3b7fd4', '#e91e8c', '#ab47bc', '#26c6da', '#f5a623', '#2ecc71'];
const RANK_EMOJI = ['🥇', '🥈', '🥉'];

export default function FamilyView({
  members, memberPoints, books, userId, onViewLibrary, onOpenGroupManager,
}: Props) {
  const myPoints = memberPoints.find(m => m.user_id === userId)?.total_points ?? 0;
  const sortedByPoints = [...memberPoints].sort((a, b) => b.total_points - a.total_points);

  return (
    <div className="family-view">
      <div className="family-header">
        <h2 className="family-title">가족</h2>
        <button className="family-manage-btn" onClick={onOpenGroupManager}>
          <Users size={15} /> 그룹 관리
        </button>
      </div>

      {/* 멤버 카드 */}
      <div className="family-members-grid">
        {members.map((member, idx) => {
          const color = MEMBER_COLORS[idx % MEMBER_COLORS.length];
          const stats = memberPoints.find(m => m.user_id === member.id);
          const memberBooks = books.filter(b => b.userId === member.id);
          const finished = memberBooks.filter(b => b.status === 'finished').length;
          const reading = memberBooks.filter(b => b.status === 'reading').length;
          const isMe = member.id === userId;

          const rankIdx = sortedByPoints.findIndex(m => m.user_id === member.id);
          const rank = rankIdx >= 0 ? rankIdx + 1 : null;
          const rankEmoji = rank != null && rank <= 3 ? RANK_EMOJI[rank - 1] : null;

          const readingCovers = memberBooks
            .filter(b => b.status === 'reading' && b.cover)
            .slice(0, 3);

          return (
            <div
              key={member.id}
              className="family-member-card"
              style={{ '--member-color': color } as React.CSSProperties}
            >
              {/* 상단 컬러 바 */}
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
                    {rank != null && (
                      <span className="family-member-rank-text">{rank}위</span>
                    )}
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

              {/* 읽는 중인 책 표지 미리보기 */}
              {readingCovers.length > 0 && (
                <div className="family-member-reading">
                  <span className="family-member-reading-label">읽는 중</span>
                  <div className="family-member-reading-covers">
                    {readingCovers.map(book => (
                      <img
                        key={book.id}
                        src={book.cover}
                        alt={book.title}
                        className="family-member-reading-cover"
                        title={book.title}
                      />
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

      {/* 포인트 마켓 */}
      <section className="family-market-section">
        <div className="family-section-hd">
          <ShoppingBag size={15} />
          <span>포인트 마켓</span>
        </div>
        <PointsMarket userId={userId} totalEarnedPoints={myPoints} />
      </section>
    </div>
  );
}
