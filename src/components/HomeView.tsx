import { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, ChevronRight, BookOpen, Award, Zap, Star, FileText, Flame, Target, Activity, BookPlus, PenLine, Clock } from 'lucide-react';
import MagazineArticle from './MagazineArticle';
import type { MagazineArticleType } from './MagazineArticle';
import type { Book } from '../types';
import type { Profile } from '../contexts/AuthContext';
import type { MemberStat } from './GroupDashboard';
import type { PointLog } from '../services/points';
import { getMyCurrentGoal, redeemGoal, type ReadingGoal } from '../services/goals';

interface Props {
  profile: Profile;
  books: Book[];
  userId: string;
  groupMembers: Profile[];
  groupMemberPoints: MemberStat[];
  pointLogs: PointLog[];
  onNavigateToLibrary: () => void;
  onOpenBook: (bookId: string) => void;
  onRecord: (bookId: string, type: 'reading_log' | 'reflection') => void;
  onNavigateToFamily: () => void;
  onShowAdd: () => void;
  onShowPoints: () => void;
  onShowChildComplete?: (bookId?: string) => void;
}

const MEMBER_COLORS = ['#3b7fd4', '#e91e8c', '#ab47bc', '#26c6da', '#f5a623', '#2ecc71'];
const FAMILY_DIGEST_DAYS = 7;
const FAMILY_STAGNANT_DAYS = 14;

type FamilyDigestType = 'book_added' | 'book_finished' | 'review_added' | 'reading' | 'stagnant';
interface FamilyDigestItem {
  id: string;
  type: FamilyDigestType;
  text: string;
  time?: string;
  sortKey: string;
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function toNoonIso(dateStr: string): string {
  return dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00.000Z`;
}

function fmtShortTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffHr = Math.floor(diffMs / 3600000);
  if (diffHr < 1) return '방금';
  if (diffHr < 24) return `${diffHr}시간 전`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

export default function HomeView({
  profile, books, userId, groupMembers, groupMemberPoints, pointLogs,
  onNavigateToLibrary, onNavigateToFamily, onShowAdd, onShowPoints,
  onOpenBook, onRecord, onShowChildComplete,
}: Props) {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const myBooks = books.filter(b => b.userId === userId);
  const myStats = groupMemberPoints.find(m => m.user_id === userId);
  const myPoints = myStats?.total_points ?? 0;

  const thisMonthLogs      = pointLogs.filter(l => l.created_at.startsWith(thisMonth));
  const thisMonthBookPts   = thisMonthLogs.filter(l => l.reason === 'book_added').reduce((s, l) => s + l.points, 0);
  const thisMonthReviewPts = thisMonthLogs.filter(l => l.reason === 'review_approved').reduce((s, l) => s + l.points, 0);
  const thisMonthTotal     = thisMonthLogs.reduce((s, l) => s + l.points, 0);

  const [currentGoal, setCurrentGoal] = useState<ReadingGoal | null | undefined>(undefined);
  const [goalImgError, setGoalImgError] = useState(false);
  const [usedPoints, setUsedPoints]     = useState(0);
  const [redeemError, setRedeemError]   = useState<string | null>(null);
  const [redeeming, setRedeeming]       = useState(false);
  const [showMagazine, setShowMagazine] = useState(false);
  const [selectedMagazine, setSelectedMagazine] = useState<MagazineArticleType>('points');
  const [magazineIndex, setMagazineIndex] = useState(0);
  const magazineCarouselRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setGoalImgError(false);
    getMyCurrentGoal().then(setCurrentGoal).catch(() => setCurrentGoal(null));
  }, [userId]);

  // 사용한 포인트(승인+대기) fetch → 사용 가능 포인트 계산에 사용
  useEffect(() => {
    const year = new Date().getFullYear();
    import('../lib/supabase').then(({ supabase }) => {
      supabase
        .from('point_redemptions')
        .select('points_cost, status')
        .eq('user_id', userId)
        .in('status', ['approved', 'pending'])
        .gte('requested_at', `${year}-01-01`)
        .lt('requested_at',  `${year + 1}-01-01`)
        .then(({ data }) => {
          const total = (data ?? []).reduce((s, r) => s + (r.points_cost ?? 0), 0);
          setUsedPoints(total);
        });
    });
  }, [userId]);

  const spendablePoints = Math.max(0, myPoints - usedPoints);
  const goalPct = currentGoal
    ? Math.min(100, Math.round((spendablePoints / currentGoal.points_required) * 100))
    : 0;
  const goalAchieved = !!(currentGoal?.status === 'active' && spendablePoints >= currentGoal.points_required);

  const handleRedeem = async () => {
    if (!currentGoal || redeeming) return;
    setRedeeming(true);
    setRedeemError(null);
    const err = await redeemGoal(currentGoal);
    if (err) {
      setRedeemError(err);
      setRedeeming(false);
    } else {
      setCurrentGoal(null);
    }
  };

  const scrollMagazineTo = (index: number) => {
    const carousel = magazineCarouselRef.current;
    if (!carousel) return;
    setMagazineIndex(index);
    carousel.scrollTo({
      left: index * carousel.clientWidth,
      behavior: 'smooth',
    });
  };

  const handleMagazineScroll = () => {
    const carousel = magazineCarouselRef.current;
    if (!carousel || carousel.clientWidth === 0) return;
    setMagazineIndex(Math.round(carousel.scrollLeft / carousel.clientWidth));
  };

  const familyFinishedThisMonth = books.filter(b => b.status === 'finished' && b.finishDate?.startsWith(thisMonth));
  const familyBooksCount  = familyFinishedThisMonth.length;
  const familyPagesCount  = familyFinishedThisMonth.reduce((s, b) => s + (b.totalPages ?? 0), 0);
  const hasFamilyPages    = familyFinishedThisMonth.some(b => (b.totalPages ?? 0) > 0);

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

  const familyDigest = useMemo<FamilyDigestItem[]>(() => {
    const cutoff = Date.now() - FAMILY_DIGEST_DAYS * 86400000;
    const nameOf = (uid: string) =>
      groupMembers.find(m => m.id === uid)?.display_name ?? '가족';

    const events: FamilyDigestItem[] = books.flatMap(book => {
      const name = nameOf(book.userId);
      const items: FamilyDigestItem[] = [];

      if (book.status !== 'want-to-read') {
        const createdIso = toNoonIso(book.createdAt);
        if (new Date(createdIso).getTime() >= cutoff) {
          items.push({
            id: `added-${book.id}`,
            type: 'book_added',
            text: `${name} 님이 『${book.title}』을 서재에 추가했어요.`,
            time: fmtShortTime(createdIso),
            sortKey: createdIso,
          });
        }
      }

      if (book.status === 'finished' && book.finishDate) {
        const finishIso = toNoonIso(book.finishDate);
        if (new Date(finishIso).getTime() >= cutoff) {
          items.push({
            id: `finished-${book.id}`,
            type: 'book_finished',
            text: `${name} 님이 『${book.title}』을 다 읽었어요.`,
            time: fmtShortTime(finishIso),
            sortKey: finishIso,
          });
        }
      }

      if (book.review?.trim() && book.reviewCreatedAt) {
        const reviewIso = book.reviewCreatedAt;
        if (new Date(reviewIso).getTime() >= cutoff) {
          items.push({
            id: `review-${book.id}`,
            type: 'review_added',
            text: `${name} 님이 『${book.title}』 감상문을 남겼어요.`,
            time: fmtShortTime(reviewIso),
            sortKey: reviewIso,
          });
        }
      }

      return items;
    });

    const reading = books
      .filter(book => book.status === 'reading')
      .map(book => {
        const name = nameOf(book.userId);
        const started = book.startDate ?? book.createdAt;
        const days = Math.max(1, daysSince(started) + 1);
        const isStagnant = days >= FAMILY_STAGNANT_DAYS;
        const progress = book.currentPage && book.totalPages
          ? ` ${book.currentPage}/${book.totalPages}쪽까지`
          : '';
        return {
          id: `reading-${book.id}`,
          type: isStagnant ? 'stagnant' : 'reading',
          text: isStagnant
            ? `${name} 님은 『${book.title}』을 ${days}일째 읽고 있어요. 응원이 필요해요.`
            : `${name} 님은 『${book.title}』을${progress} 읽고 있어요.`,
          sortKey: toNoonIso(started),
        } satisfies FamilyDigestItem;
      })
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'stagnant' ? -1 : 1;
        return a.sortKey.localeCompare(b.sortKey);
      })
      .slice(0, 2);

    return [
      ...events.sort((a, b) => b.sortKey.localeCompare(a.sortKey)).slice(0, 4),
      ...reading,
    ].slice(0, 5);
  }, [books, groupMembers]);

  const renderDigestIcon = (type: FamilyDigestType) => {
    if (type === 'book_added') return <BookPlus size={15} />;
    if (type === 'book_finished') return <Award size={15} />;
    if (type === 'review_added') return <PenLine size={15} />;
    if (type === 'stagnant') return <Clock size={15} />;
    return <BookOpen size={15} />;
  };

  const recentBooks = [...myBooks]
    .sort((a, b) => {
      const da = a.finishDate ?? a.startDate ?? a.createdAt;
      const db = b.finishDate ?? b.startDate ?? b.createdAt;
      return db.localeCompare(da);
    })
    .slice(0, 8);

  const readingBooks = myBooks.filter(book => book.status === 'reading');
  const [activeReadingId, setActiveReadingId] = useState('');
  const activeBook = readingBooks.find(book => book.id === activeReadingId) ?? readingBooks[0];
  const progress = activeBook?.totalPages ? Math.min(100, Math.max(0, Math.round((activeBook.currentPage ?? 0) / activeBook.totalPages * 100))) : 0;

  const memberIdx = groupMembers.findIndex(m => m.id === userId);
  const myColor = MEMBER_COLORS[memberIdx >= 0 ? memberIdx % MEMBER_COLORS.length : 0];

  const isFamily = groupMembers.length > 1;

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

      {/* 기록 → 서재 → 가족 소식 → 통계와 목표 순서 */}
      <div className="home-content">
        <section className="home-item home-item--reading reading-focus" aria-labelledby="reading-focus-title">
          <div className="home-section-hd">
            <div><p className="reading-eyebrow">오늘의 독서</p><h2 id="reading-focus-title">조금 읽고, 오래 기억해요</h2></div>
            <button className="icon-btn" onClick={onShowAdd} aria-label="새 책 추가"><Plus size={20} /></button>
          </div>
          {activeBook ? <>
            {readingBooks.length > 1 && <label className="reading-select">읽는 책 {readingBooks.length}권
              <select value={activeBook.id} onChange={e => setActiveReadingId(e.target.value)}>
                {readingBooks.map(book => <option key={book.id} value={book.id}>{book.title}</option>)}
              </select>
            </label>}
            <button className="reading-current" onClick={() => onOpenBook(activeBook.id)}>
              {activeBook.cover ? <img src={activeBook.cover} alt="" /> : <span className="reading-cover-empty"><BookOpen size={32} /></span>}
              <span className="reading-current-info">
                <span className="reading-eyebrow">지금 읽고 있어요</span>
                <strong>{activeBook.title}</strong><span>{activeBook.author}</span>
                {activeBook.totalPages ? <><span className="reading-progress" role="progressbar" aria-label="독서 진행률" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></span><span>{activeBook.currentPage ?? 0} / {activeBook.totalPages}쪽 · {progress}%</span></> : <span>오늘 읽은 이야기를 남겨볼까요?</span>}
              </span><ChevronRight size={18} />
            </button>
            <div className="reading-actions">
              <button className="btn-primary" onClick={() => onRecord(activeBook.id, 'reading_log')}><BookOpen size={17} />오늘 읽었어요</button>
              <button className="btn-secondary" onClick={() => onRecord(activeBook.id, 'reflection')}><PenLine size={17} />한 줄 남기기</button>
              <button className="btn-secondary" onClick={() => onShowChildComplete?.(activeBook.id)}><Award size={17} />다 읽었어요</button>
            </div>
          </> : <div className="reading-empty"><BookOpen size={36} /><h3>다음 이야기를 시작해볼까요?</h3><p>읽을 책을 추가하고 오늘의 생각을 남겨보세요.</p><button className="btn-primary" onClick={onShowAdd}><Plus size={17} />읽을 책 추가하기</button><button className="btn-secondary" onClick={onNavigateToLibrary}>내 서재 둘러보기</button></div>}
        </section>


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
                  <button key={book.id} className="home-book-item" onClick={() => onOpenBook(book.id)}>
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

        <div className="home-item home-item--missions">
          <div className="home-missions-card">
            <div className="home-missions-header">
              <span className="home-missions-tag">
                <Activity size={12} /> 가족 독서 소식
              </span>
              <button className="home-missions-more" onClick={onNavigateToFamily}>
                전체 보기 <ChevronRight size={13} />
              </button>
            </div>
            {familyDigest.length === 0 ? (
              <div className="home-missions-empty">
                <BookOpen size={24} style={{ opacity: 0.25 }} />
                <p>아직 나눌 가족 독서 소식이 없어요.</p>
              </div>
            ) : (
              <div className="home-missions-list">
                {familyDigest.map(item => (
                  <button
                    key={item.id}
                    className={`home-mission-item home-mission-item--${item.type}`}
                    onClick={onNavigateToFamily}
                  >
                    <span className="home-mission-icon">{renderDigestIcon(item.type)}</span>
                    <span className="home-mission-text">{item.text}</span>
                    {item.time && <span className="home-mission-time">{item.time}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="home-item home-item--family">
          <div className="home-family-card">
            <p className="home-family-card-label">이번 달 독서 현황</p>
            <div className="home-fstats">
              <div className="home-fstat">
                <span className="home-fstat-lbl"><BookOpen size={11} /> 읽은 책</span>
                <span className="home-fstat-num">
                  {familyBooksCount}<span className="home-fstat-unit">권</span>
                </span>
              </div>
              <div className="home-fstat">
                <span className="home-fstat-lbl"><FileText size={11} /> 완독한 책의 쪽수</span>
                <span className="home-fstat-num">
                  {hasFamilyPages ? familyPagesCount.toLocaleString() : '--'}
                  {hasFamilyPages && <span className="home-fstat-unit">p</span>}
                </span>
              </div>
              <div className="home-fstat">
                <span className="home-fstat-lbl" style={{ color: familyStreak > 0 ? '#FF9F43' : undefined }}>
                  <Flame size={11} /> 연속 완독일
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

        <div className="home-item home-item--goal">
          <div className="home-goal-card">
            <div className="home-goal-header">
              <Target size={13} />
              <span>현재 목표</span>
            </div>

            {currentGoal === null && (
              <div className="home-goal-empty">
                <p>설정된 목표가 없어요</p>
                <button className="home-goal-set-btn" onClick={onNavigateToFamily}>
                  목표 설정하기 <ChevronRight size={13} />
                </button>
              </div>
            )}

            {currentGoal === undefined && (
              <div className="home-goal-loading" />
            )}

            {currentGoal != null && (
              <div className="home-goal-body">
                <div className="home-goal-reward">
                  {currentGoal.item_image_url && !goalImgError
                    ? <img
                        src={currentGoal.item_image_url}
                        alt=""
                        className="home-goal-reward-img"
                        onError={() => setGoalImgError(true)}
                      />
                    : <span className="home-goal-reward-emoji">{currentGoal.item_emoji ?? '🎁'}</span>
                  }
                  <div className="home-goal-reward-info">
                    <div className="home-goal-label">{currentGoal.item_name}</div>
                    {currentGoal.status === 'pending_approval' && (
                      <span className="home-goal-pending-badge">승인 대기 중</span>
                    )}
                    {goalAchieved && (
                      <span className="home-goal-achieved-badge">🎉 목표 달성!</span>
                    )}
                  </div>
                </div>
                <div className="home-goal-bar-track">
                  <div className="home-goal-bar-fill" style={{ width: `${goalPct}%` }} />
                </div>
                <div className="home-goal-foot">
                  <span className="home-goal-count">{spendablePoints.toLocaleString()}pt</span>
                  <span className="home-goal-pct">{goalPct}% · 목표 {currentGoal.points_required.toLocaleString()}pt</span>
                </div>
                {goalAchieved && (
                  <div className="home-goal-redeem-wrap">
                    {redeemError && <p className="home-goal-redeem-error">{redeemError}</p>}
                    <button
                      className="home-goal-redeem-btn"
                      onClick={handleRedeem}
                      disabled={redeeming}
                    >
                      {redeeming ? '요청 중...' : '🎁 보상 받기'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="home-item home-item--magazine">
          <div
            ref={magazineCarouselRef}
            className="home-magazine-carousel"
            aria-label="북스탯 매거진"
            onScroll={handleMagazineScroll}
          >
            <button
              className="home-magazine-card home-magazine-btn"
              onClick={() => { setSelectedMagazine('points'); setShowMagazine(true); }}
            >
              <div className="home-magazine-inner">
                <div className="home-magazine-text-col">
                  <div className="home-magazine-badge-row">
                    <span className="home-magazine-tag">⭐ POINT GUIDE</span>
                    <span className="home-magazine-new">NEW</span>
                  </div>
                  <p className="home-magazine-title">북스탯 포인트<br /><em className="home-magazine-accent">모으는 법</em></p>
                  <p className="home-magazine-sub">읽고, 남기고, 도전하면<br />포인트가 차곡차곡</p>
                </div>
                <div className="home-magazine-visual-col" aria-hidden="true">
                  <span className="home-mag-star">⭐</span>
                  <span className="home-mag-deco-circle" />
                  <span className="home-mag-char">P</span>
                  <span className="home-mag-books">📖</span>
                  <span className="home-mag-sparkle">✦</span>
                </div>
              </div>
            </button>

            <button
              className="home-magazine-card home-magazine-btn home-magazine-btn--books"
              onClick={() => { setSelectedMagazine('books'); setShowMagazine(true); }}
            >
              <div className="home-magazine-inner">
                <div className="home-magazine-text-col">
                  <div className="home-magazine-badge-row">
                    <span className="home-magazine-tag">📚 BOOK LIST</span>
                  </div>
                  <p className="home-magazine-title">초3~초4가<br />읽기 좋은<br /><em className="home-magazine-accent">책 10권</em></p>
                  <p className="home-magazine-sub">재밌어서 읽다 보면<br />생각이 자라는 책들</p>
                </div>
                <div className="home-magazine-visual-col" aria-hidden="true">
                  <span className="home-mag-star">⭐</span>
                  <span className="home-mag-deco-circle" />
                  <span className="home-mag-char home-mag-char--reader">🧒</span>
                  <span className="home-mag-books">📚</span>
                  <span className="home-mag-sparkle">✦</span>
                </div>
              </div>
            </button>
          </div>
          <div className="home-magazine-dots" aria-label="매거진 포스트 선택">
            <button
              type="button"
              className={magazineIndex === 0 ? 'active' : ''}
              onClick={() => scrollMagazineTo(0)}
              aria-label="포인트 안내 기사 보기"
            />
            <button
              type="button"
              className={magazineIndex === 1 ? 'active' : ''}
              onClick={() => scrollMagazineTo(1)}
              aria-label="추천 도서 기사 보기"
            />
          </div>
        </div>
        {showMagazine && <MagazineArticle article={selectedMagazine} onClose={() => setShowMagazine(false)} />}

      </div>
    </div>
  );
}
