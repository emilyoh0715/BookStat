import { useState, useMemo } from 'react';
import { Plus, ChevronRight, BookOpen, Award, Zap, Star, BookMarked, FileText, Flame, CheckCircle, Target, TrendingUp, TrendingDown, Minus } from 'lucide-react';
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
  onShowChildComplete?: (bookId?: string) => void;
}

const MEMBER_COLORS = ['#3b7fd4', '#e91e8c', '#ab47bc', '#26c6da', '#f5a623', '#2ecc71'];
const ANNUAL_GOAL = 12;

type MissionType = 'add' | 'stagnant' | 'check' | 'review';
interface Mission {
  id: string;
  type: MissionType;
  icon: string;
  text: string;
  bookId?: string;
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function DeltaBadge({ delta, unit = '' }: { delta: number; unit?: string }) {
  if (delta === 0) return <span className="home-stat-delta home-stat-delta--zero"><Minus size={9} />0{unit}</span>;
  if (delta > 0)   return <span className="home-stat-delta home-stat-delta--up"><TrendingUp size={9} />+{delta}{unit}</span>;
  return               <span className="home-stat-delta home-stat-delta--down"><TrendingDown size={9} />{delta}{unit}</span>;
}

export default function HomeView({
  profile, books, userId, groupMembers, groupMemberPoints, pointLogs,
  onNavigateToLibrary, onNavigateToFamily, onShowAdd, onShowPoints, onShowChildComplete,
}: Props) {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonth = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();
  const currentYear = String(now.getFullYear());
  const todayStr = now.toISOString().slice(0, 10);
  const todayKey = `reading_check_${userId}_${todayStr}`;

  const [checkedToday, setCheckedToday] = useState<Set<string>>(() => {
    try {
      const s = localStorage.getItem(todayKey);
      return s ? new Set(JSON.parse(s) as string[]) : new Set<string>();
    } catch { return new Set<string>(); }
  });

  const checkBook = (bookId: string) => {
    const next = new Set(checkedToday);
    next.add(bookId);
    setCheckedToday(next);
    try { localStorage.setItem(todayKey, JSON.stringify([...next])); } catch {}
  };

  const myBooks = books.filter(b => b.userId === userId);
  const myStats = groupMemberPoints.find(m => m.user_id === userId);
  const myPoints = myStats?.total_points ?? 0;

  // This month
  const thisMonthLogs      = pointLogs.filter(l => l.created_at.startsWith(thisMonth));
  const thisMonthBookPts   = thisMonthLogs.filter(l => l.reason === 'book_added').reduce((s, l) => s + l.points, 0);
  const thisMonthReviewPts = thisMonthLogs.filter(l => l.reason === 'review_approved').reduce((s, l) => s + l.points, 0);
  const thisMonthTotal     = thisMonthLogs.reduce((s, l) => s + l.points, 0);

  // Last month (for deltas)
  const lastMonthLogs  = pointLogs.filter(l => l.created_at.startsWith(lastMonth));
  const lastMonthTotal = lastMonthLogs.reduce((s, l) => s + l.points, 0);

  // My finished books
  const myFinishedThis  = myBooks.filter(b => b.status === 'finished' && b.finishDate?.startsWith(thisMonth)).length;
  const myFinishedLast  = myBooks.filter(b => b.status === 'finished' && b.finishDate?.startsWith(lastMonth)).length;
  const myFinishedDelta = myFinishedThis - myFinishedLast;

  // Annual goal progress
  const myFinishedThisYear = myBooks.filter(b => b.status === 'finished' && b.finishDate?.startsWith(currentYear)).length;
  const goalPct = Math.min(100, Math.round((myFinishedThisYear / ANNUAL_GOAL) * 100));

  // Family finished books
  const familyFinishedThisMonth = books.filter(b => b.status === 'finished' && b.finishDate?.startsWith(thisMonth));
  const familyBooksCount  = familyFinishedThisMonth.length;
  const familyPagesCount  = familyFinishedThisMonth.reduce((s, b) => s + (b.totalPages ?? 0), 0);
  const hasFamilyPages    = familyFinishedThisMonth.some(b => (b.totalPages ?? 0) > 0);
  const familyLastCount   = books.filter(b => b.status === 'finished' && b.finishDate?.startsWith(lastMonth)).length;
  const familyDelta       = familyBooksCount - familyLastCount;
  const pointsDelta       = thisMonthTotal - lastMonthTotal;

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

  const missions = useMemo<Mission[]>(() => {
    const list: Mission[] = [];
    const reading = myBooks.filter(b => b.status === 'reading');

    if (reading.length === 0) {
      list.push({ id: 'add', type: 'add', icon: '📚', text: '읽을 책을 추가해보세요' });
    } else {
      const stagnant = reading.filter(b => b.startDate && daysSince(b.startDate) >= 21);
      const active   = reading.filter(b => !stagnant.find(s => s.id === b.id));

      stagnant.slice(0, 1).forEach(b =>
        list.push({ id: `stagnant-${b.id}`, type: 'stagnant', icon: '📖', text: `"${b.title}" 다 읽으셨나요?`, bookId: b.id })
      );
      active
        .filter(b => !checkedToday.has(b.id))
        .slice(0, 2)
        .forEach(b =>
          list.push({ id: `check-${b.id}`, type: 'check', icon: '✅', text: `오늘 "${b.title}" 읽기 체크!`, bookId: b.id })
        );
    }

    if (list.length < 3) {
      myBooks
        .filter(b => b.status === 'finished' && !b.review?.trim())
        .slice(0, 1)
        .forEach(b =>
          list.push({ id: `review-${b.id}`, type: 'review', icon: '✍️', text: `"${b.title}" 감상문 써볼까요?`, bookId: b.id })
        );
    }

    return list.slice(0, 3);
  }, [myBooks, checkedToday]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMission = (m: Mission) => {
    if (m.type === 'add') { onShowAdd(); return; }
    if (m.type === 'check') { checkBook(m.bookId!); return; }
    if ((m.type === 'stagnant' || m.type === 'review') && onShowChildComplete) {
      onShowChildComplete(m.bookId);
    }
  };

  return (
    <div className="home-view">

      {/* ① 헤더 */}
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

      {/* ② 통계 4칸 그리드 */}
      <div className="home-stats-grid">
        <button className="home-stat-card" onClick={onNavigateToLibrary}>
          <div className="home-stat-icon-wrap home-stat-icon-wrap--blue">
            <BookOpen size={15} />
          </div>
          <div className="home-stat-body">
            <span className="home-stat-label">이번 달 완독</span>
            <span className="home-stat-value">{myFinishedThis}<span className="home-stat-unit">권</span></span>
          </div>
          <DeltaBadge delta={myFinishedDelta} unit="권" />
        </button>

        <button className="home-stat-card" onClick={onShowPoints}>
          <div className="home-stat-icon-wrap home-stat-icon-wrap--yellow">
            <Award size={15} />
          </div>
          <div className="home-stat-body">
            <span className="home-stat-label">누적 포인트</span>
            <span className="home-stat-value">{myPoints.toLocaleString()}<span className="home-stat-unit">pt</span></span>
          </div>
          <DeltaBadge delta={pointsDelta} unit="pt" />
        </button>

        <button className="home-stat-card" onClick={isFamily ? onNavigateToFamily : undefined}>
          <div className="home-stat-icon-wrap home-stat-icon-wrap--green">
            <FileText size={15} />
          </div>
          <div className="home-stat-body">
            <span className="home-stat-label">가족 완독</span>
            <span className="home-stat-value">{familyBooksCount}<span className="home-stat-unit">권</span></span>
          </div>
          <DeltaBadge delta={familyDelta} unit="권" />
        </button>

        <div className="home-stat-card home-stat-card--static">
          <div className={`home-stat-icon-wrap ${familyStreak > 0 ? 'home-stat-icon-wrap--orange' : 'home-stat-icon-wrap--muted'}`}>
            <Flame size={15} />
          </div>
          <div className="home-stat-body">
            <span className="home-stat-label">독서 스트릭</span>
            <span className="home-stat-value">
              {familyStreak > 0 ? familyStreak : '--'}
              {familyStreak > 0 && <span className="home-stat-unit">일</span>}
            </span>
          </div>
          {familyStreak > 0
            ? <span className="home-stat-delta home-stat-delta--fire">🔥 연속 중</span>
            : <span className="home-stat-delta home-stat-delta--zero">-</span>
          }
        </div>
      </div>

      {/* ③ 콘텐츠 영역
          모바일:         가족현황 → 내포인트 → 목표 → 미션 → 매거진 → 최근책
          데스크탑(~1279): 좌(미션+책) / 우(가족+포인트+목표+매거진)
          데스크탑(1280+): 좌 단일 컬럼(미션+책), 우측패널이 가족 정보 담당 → 우컬럼 숨김 */}
      <div className="home-content">

        {/* 우리 가족 독서 현황 */}
        <div className="home-item home-item--family">
          <div className="home-family-card">
            <p className="home-family-card-label">이번 달 우리 가족 독서 현황</p>
            <div className="home-fstats">
              <div className="home-fstat">
                <span className="home-fstat-lbl"><BookOpen size={11} /> 읽은 책</span>
                <span className="home-fstat-num">
                  {familyBooksCount}<span className="home-fstat-unit">권</span>
                </span>
              </div>
              <div className="home-fstat">
                <span className="home-fstat-lbl"><FileText size={11} /> 읽은 페이지</span>
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
                가족 리포트 보기 <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>

        {/* 내 포인트 */}
        <div className="home-item home-item--points">
          <button className="home-points-card" onClick={onShowPoints}>
            <div className="home-points-body">
              <div className="home-points-left">
                <span className="home-points-label">
                  <Award size={13} className="home-points-icon" /> 내 포인트
                </span>
                <span className="home-points-total">
                  {myPoints.toLocaleString()}<span className="home-points-total-unit">pt</span>
                </span>
              </div>
              <div className="home-points-right">
                <span className="home-points-month-label">이번 달</span>
                <span className="home-points-month-val">
                  {thisMonthTotal > 0 ? <strong style={{ color: '#22C55E' }}>+{thisMonthTotal}pt</strong> : '--'}
                </span>
                <div className="home-points-month-row">
                  <span className="home-points-month-row-label"><Zap size={11} /> 책 추가</span>
                </div>
                <span className="home-points-month-val">+{thisMonthBookPts}pt</span>
                <div className="home-points-month-row">
                  <span className="home-points-month-row-label"><Star size={11} /> 후기 승인</span>
                </div>
                <span className="home-points-month-val">+{thisMonthReviewPts}pt</span>
              </div>
            </div>
            <div className="home-points-link-btn">
              포인트 내역 보기 <ChevronRight size={14} />
            </div>
          </button>
        </div>

        {/* 현재 목표 */}
        <div className="home-item home-item--goal">
          <div className="home-goal-card">
            <div className="home-goal-header">
              <Target size={13} />
              <span>현재 목표</span>
            </div>
            <div className="home-goal-body">
              <div className="home-goal-label">올해 {ANNUAL_GOAL}권 읽기</div>
              <div className="home-goal-bar-track">
                <div
                  className="home-goal-bar-fill"
                  style={{ width: `${goalPct}%` }}
                />
              </div>
              <div className="home-goal-foot">
                <span className="home-goal-count">{myFinishedThisYear}권 완독</span>
                <span className="home-goal-pct">{goalPct}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* 오늘의 독서 미션 */}
        <div className="home-item home-item--missions">
          <div className="home-missions-card">
            <div className="home-missions-header">
              <span className="home-missions-tag">
                <Target size={12} /> 오늘의 독서 미션
              </span>
            </div>
            {missions.length === 0 ? (
              <div className="home-missions-empty">
                <CheckCircle size={22} style={{ color: '#2ecc71' }} />
                <p>오늘 할 일을 모두 완료했어요! 🎉</p>
              </div>
            ) : (
              <div className="home-missions-list">
                {missions.map(m => (
                  <button
                    key={m.id}
                    className={`home-mission-item home-mission-item--${m.type}`}
                    onClick={() => handleMission(m)}
                  >
                    <span className="home-mission-icon">{m.icon}</span>
                    <span className="home-mission-text">{m.text}</span>
                    {m.type === 'check'
                      ? <CheckCircle size={16} className="home-mission-action-icon home-mission-action-icon--check" />
                      : <ChevronRight size={15} className="home-mission-action-icon" />
                    }
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 오늘의 매거진 */}
        <div className="home-item home-item--magazine">
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
        </div>

        {/* 최근 읽은 책 */}
        <div className="home-item home-item--books">
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

      </div>
    </div>
  );
}
