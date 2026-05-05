import { Plus, ChevronRight, BookOpen, Award, Zap, Star, BookMarked, FileText, Flame } from 'lucide-react';
import type { Book } from '../types';
import type { Profile } from '../contexts/AuthContext';
import type { MemberStat } from './GroupDashboard';
import type { PointLog } from '../services/points';

interface Props {
  profile: Profile;
  books: Book[];
  userId: string;
  groupMembers: Profile[];
  groupMemberPoints: MemberStat[];
  pointLogs: PointLog[];
  onNavigateToLibrary: () => void;
  onNavigateToFamily: () => void;
  onShowAdd: () => void;
  onShowPoints: () => void;
}

const MEMBER_COLORS = ['#3b7fd4', '#e91e8c', '#ab47bc', '#26c6da', '#f5a623', '#2ecc71'];

export default function HomeView({
  profile, books, userId, groupMembers, groupMemberPoints, pointLogs,
  onNavigateToLibrary, onNavigateToFamily, onShowAdd, onShowPoints,
}: Props) {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const myBooks = books.filter(b => b.userId === userId);
  const myStats = groupMemberPoints.find(m => m.user_id === userId);
  const myPoints = myStats?.total_points ?? 0;

  const thisMonthLogs = pointLogs.filter(l => l.created_at.startsWith(thisMonth));
  const thisMonthBookPts = thisMonthLogs.filter(l => l.reason === 'book_added').reduce((s, l) => s + l.points, 0);
  const thisMonthReviewPts = thisMonthLogs.filter(l => l.reason === 'review_approved').reduce((s, l) => s + l.points, 0);
  const thisMonthTotal = thisMonthLogs.reduce((s, l) => s + l.points, 0);

  const familyFinishedThisMonth = books.filter(
    b => b.status === 'finished' && b.finishDate?.startsWith(thisMonth)
  );
  const familyBooksCount = familyFinishedThisMonth.length;
  const familyPagesCount = familyFinishedThisMonth.reduce((s, b) => s + (b.totalPages ?? 0), 0);
  const hasFamilyPages = familyFinishedThisMonth.some(b => (b.totalPages ?? 0) > 0);

  // 가족 연속 완독 스트릭 (완독일 기준 연속 일수)
  const familyStreak = (() => {
    const dates = books
      .filter(b => b.status === 'finished' && b.finishDate)
      .map(b => b.finishDate!.slice(0, 10))
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort();
    if (dates.length === 0) return 0;
    const today = now.toISOString().split('T')[0];
    const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0];
    const rev = [...dates].reverse();
    if (rev[0] !== today && rev[0] !== yesterday) return 0;
    let streak = 1;
    for (let i = 1; i < rev.length; i++) {
      const diff = Math.round(
        (new Date(rev[i - 1]).getTime() - new Date(rev[i]).getTime()) / 86400000
      );
      if (diff === 1) streak++;
      else break;
    }
    return streak;
  })();

  const recentBooks = [...myBooks]
    .sort((a, b) => {
      const da = a.finishDate ?? a.startDate ?? a.createdAt;
      const db = b.finishDate ?? b.startDate ?? b.createdAt;
      return db.localeCompare(da);
    })
    .slice(0, 8);

  const memberIdx = groupMembers.findIndex(m => m.id === userId);
  const myColor = MEMBER_COLORS[memberIdx >= 0 ? memberIdx % MEMBER_COLORS.length : 0];

  const isFamily = groupMembers.length > 1;

  return (
    <div className="home-view">

      {/* ① 상단 헤더 */}
      <div className="home-header">
        <div>
          <p className="home-greeting">안녕하세요 👋</p>
          <h1 className="home-username">{profile.display_name}</h1>
        </div>
        <div className="home-header-avatar" style={{ background: myColor }}>
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            : profile.display_name[0].toUpperCase()}
        </div>
      </div>

      {/* ② 이번 달 가족 독서 현황 */}
      <div className="home-family-card">
        <p className="home-family-card-label">이번 달 우리 가족 독서 현황</p>
        <div className="home-fstats">
          <div className="home-fstat">
            <span className="home-fstat-lbl">
              <BookOpen size={11} /> 읽은 책
            </span>
            <span className="home-fstat-num">
              {familyBooksCount}<span className="home-fstat-unit">권</span>
            </span>
          </div>
          <div className="home-fstat">
            <span className="home-fstat-lbl">
              <FileText size={11} /> 읽은 페이지
            </span>
            <span className="home-fstat-num">
              {hasFamilyPages ? familyPagesCount.toLocaleString() : '--'}
              {hasFamilyPages && <span className="home-fstat-unit">p</span>}
            </span>
          </div>
          <div className="home-fstat">
            <span className="home-fstat-lbl" style={{ color: familyStreak > 0 ? '#FF9F43' : undefined }}>
              <Flame size={11} /> 연속 독서
            </span>
            <span className="home-fstat-num">
              {familyStreak > 0 ? familyStreak : '--'}
              {familyStreak > 0 && <span className="home-fstat-unit">일</span>}
            </span>
          </div>
        </div>
        {isFamily && (
          <button className="home-family-link-btn" onClick={onNavigateToFamily}>
            가족 서재 보기 <ChevronRight size={14} />
          </button>
        )}
      </div>

      {/* ③ 내 포인트 현황 */}
      <button className="home-points-card" onClick={onShowPoints}>
        {/* 상단: 라벨 행 */}
        <div className="home-points-row">
          <span className="home-points-label">
            <Award size={13} className="home-points-icon" /> 내 포인트
          </span>
          <span className="home-points-label home-points-label--right">이번 달</span>
        </div>
        {/* 중단: 숫자 행 */}
        <div className="home-points-row home-points-row--values">
          <span className="home-points-total">
            {myPoints.toLocaleString()}<span className="home-points-total-unit">pt</span>
          </span>
          <span className="home-points-month-total">
            {thisMonthTotal > 0 ? `+${thisMonthTotal}` : '--'}<span className="home-points-total-unit">pt</span>
          </span>
        </div>
        {/* 구분선 */}
        <div className="home-points-divider" />
        {/* 하단: 세부 내역 */}
        <div className="home-points-detail-row">
          <span className="home-points-detail-item"><Zap size={11} /> 책 추가</span>
          <span className="home-points-detail-val">+{thisMonthBookPts}pt</span>
        </div>
        <div className="home-points-detail-row">
          <span className="home-points-detail-item"><Star size={11} /> 후기 승인</span>
          <span className="home-points-detail-val">+{thisMonthReviewPts}pt</span>
        </div>
        {/* 푸터 */}
        <div className="home-points-footer">
          포인트 내역 보기 <ChevronRight size={12} />
        </div>
      </button>

      {/* ④ 오늘의 매거진 (플레이스홀더) */}
      <div className="home-magazine-card">
        <div className="home-magazine-top">
          <span className="home-magazine-tag">오늘의 매거진</span>
          <span className="home-magazine-coming">준비 중</span>
        </div>
        <div className="home-magazine-body">
          <div className="home-magazine-thumb">
            <BookMarked size={26} style={{ opacity: 0.25 }} />
          </div>
          <div className="home-magazine-text">
            <p className="home-magazine-title">독서 습관을 만드는 법</p>
            <p className="home-magazine-sub">매일 10분, 작은 시작이 큰 변화를 만들어요</p>
          </div>
        </div>
      </div>

      {/* ⑤ 최근 읽은 책 */}
      <section className="home-section">
        <div className="home-section-hd">
          <BookOpen size={14} />
          <span>최근 읽은 책</span>
          <button className="home-section-more" onClick={onNavigateToLibrary}>
            전체 보기 <ChevronRight size={13} />
          </button>
        </div>
        {recentBooks.length === 0 ? (
          <div className="home-empty">
            <BookOpen size={36} style={{ opacity: 0.2 }} />
            <p>아직 추가한 책이 없어요</p>
            <button className="btn-primary" onClick={onShowAdd}>
              <Plus size={14} /> 첫 책 추가하기
            </button>
          </div>
        ) : (
          <div className="home-books-scroll">
            {recentBooks.map(book => (
              <button key={book.id} className="home-book-item" onClick={onNavigateToLibrary}>
                {book.cover
                  ? <img src={book.cover} alt={book.title} className="home-book-cover" />
                  : <div className="home-book-cover home-book-cover-empty"><BookOpen size={18} /></div>
                }
                <p className="home-book-title">{book.title}</p>
                <p className={`home-book-badge home-book-badge--${book.status}`}>
                  {book.status === 'finished' ? '완독'
                    : book.status === 'reading' ? '읽는 중'
                    : book.status === 'paused' ? '멈춤' : '읽고 싶음'}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
