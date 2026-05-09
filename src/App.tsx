import { useState, useEffect } from 'react';
import { useBooks } from './useBooks';
import type { ReadingStatus, BookLanguage } from './types';
import BookCard from './components/BookCard';
import BookDetail from './components/BookDetail';
import AddBookModal from './components/AddBookModal';
import SettingsModal from './components/SettingsModal';
import AuthScreen from './components/AuthScreen';
import ProfileSetup from './components/ProfileSetup';
import GroupManager from './components/GroupManager';
import PointsModal from './components/PointsModal';
import type { MemberStat } from './components/GroupDashboard';
import StatsView from './components/StatsView';
import HelpModal from './components/HelpModal';
import ChildReadingComplete from './components/ChildReadingComplete';
import ProfileSelector from './components/ProfileSelector';
import BookstatLogo from './components/BookstatLogo';
import HomeView from './components/HomeView';
import FamilyView from './components/FamilyView';
import PointsCelebration from './components/PointsCelebration';
import ReadingCheckinSection from './components/ReadingCheckinSection';
import RightPanel from './components/RightPanel';
import { useAuth } from './contexts/AuthContext';
import { getUserPoints, awardPoints, removePoints, calcReviewPoints, calcFinishedPoints } from './services/points';
import type { PointLog } from './services/points';
import { validateReview, getApiKey, saveRejectionReason, clearRejectionReason } from './services/claudeVocab';
import { supabase } from './lib/supabase';
import type { Profile } from './contexts/AuthContext';
import { Plus, Search, Settings, ChevronDown, ChevronRight, Users, LogOut, BarChart2, BookOpen, RefreshCw, HelpCircle, Home } from 'lucide-react';
import { useTheme } from './useTheme';

const MEMBER_COLORS = ['#3b7fd4', '#e91e8c', '#ab47bc', '#26c6da', '#f5a623', '#2ecc71'];
function getMemberColor(idx: number) { return MEMBER_COLORS[idx % MEMBER_COLORS.length]; }
function applyMemberColor(color: string) {
  document.documentElement.style.setProperty('--member-accent', color);
}

import './App.css';

const STATUS_FILTERS: { value: ReadingStatus | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'reading', label: '읽는 중' },
  { value: 'want-to-read', label: '읽고 싶음' },
  { value: 'finished', label: '다 읽음' },
  { value: 'paused', label: '멈춤' },
];

const LANG_FILTERS: { value: BookLanguage | 'all'; label: string }[] = [
  { value: 'all', label: '🌍 전체' },
  { value: 'korean', label: '🇰🇷 한국어' },
  { value: 'english', label: '🇺🇸 영어 원서' },
  { value: 'other', label: '🌐 기타' },
];

export default function App() {
  useTheme(); // 테마 초기화 (토글은 SettingsModal에서)
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { books, loading: booksLoading, addBook, updateBook, deleteBook, addVocab, deleteVocab, addNote, deleteNote, filterBooks, getYears, groupByYear, refetchBooks } = useBooks();

  const [introVisible, setIntroVisible] = useState(() => {
    if (sessionStorage.getItem('bookstat-intro-shown')) return false;
    sessionStorage.setItem('bookstat-intro-shown', '1');
    return true;
  });
  const [introFading, setIntroFading] = useState(false);

  const [profileSelected, setProfileSelected] = useState(() =>
    !!sessionStorage.getItem('bookstat-profile-chosen')
  );

  useEffect(() => {
    if (!user) {
      sessionStorage.removeItem('bookstat-profile-chosen');
      setProfileSelected(false);
    }
  }, [user]);

  // 그룹 멤버 (사이드바용)
  const [groupMembers, setGroupMembers] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);
  const [inviteToast, setInviteToast] = useState<string | null>(null);

  const [groupMemberPoints, setGroupMemberPoints] = useState<MemberStat[]>([]);
  const [myPointLogs, setMyPointLogs] = useState<PointLog[]>([]);
  // userId → Set<bookId> : 그룹 전체 승인된 후기
  const [groupApprovedBookIds, setGroupApprovedBookIds] = useState<Map<string, Set<string>>>(new Map());
  const [showPoints, setShowPoints] = useState(false);
  const [mainView, setMainView] = useState<'home' | 'library' | 'stats' | 'family'>('home');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showChildComplete, setShowChildComplete] = useState(false);
  const [childCompleteBookId, setChildCompleteBookId] = useState<string | null>(null);
  const [pointsCelebration, setPointsCelebration] = useState<{ points: number; label: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReadingStatus | 'all'>('all');
  const [langFilter, setLangFilter] = useState<BookLanguage | 'all'>('all');
  const [yearFilter, setYearFilter] = useState<number | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'recent' | 'title'>('recent');
  const [groupByYearEnabled, setGroupByYearEnabled] = useState(false);
  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(new Set());
  const [revalidating, setRevalidating] = useState(false);
  const [revalidateToast, setRevalidateToast] = useState<string | null>(null);

  useEffect(() => {
    const t1 = setTimeout(() => setIntroFading(true), 600);
    const t2 = setTimeout(() => setIntroVisible(false), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // 그룹 멤버 로드
  const loadGroupMembers = async () => {
    if (!user) return;

    const members: Profile[] = [];
    const seen = new Set<string>();

    // 항상 본인 먼저
    if (profile && !seen.has(profile.id)) {
      members.push(profile);
      seen.add(profile.id);
    }

    const { data: otherProfiles } = await supabase.rpc('get_group_member_profiles');
    (otherProfiles ?? []).forEach((p: Profile) => {
      if (!seen.has(p.id)) {
        members.push(p);
        seen.add(p.id);
      }
    });

    setGroupMembers(members);
    setSelectedUserId(prev => prev || (members[0]?.id ?? user.id));
  };

  useEffect(() => {
    if (user && profile) {
      loadGroupMembers();
    } else if (user && !profile) {
      setSelectedUserId(user.id);
    }
  }, [user, profile]);

  // 그룹 멤버 변경 실시간 감지
  // 초대 카운트 로드
  const loadPendingInviteCount = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('group_members')
      .select('id, groups(name)')
      .eq('user_id', user.id)
      .eq('status', 'pending');
    setPendingInviteCount((data ?? []).length);
    return data ?? [];
  };

  // ─── 포인트 로드 & 실시간 동기화 (현재 연도만 집계) ───
  const loadGroupPoints = async () => {
    // get_group_member_points RPC는 SECURITY DEFINER로 연도 필터 포함 집계
    // point_logs는 RLS로 본인 것만 읽히므로 클라이언트 직접 쿼리 불가 → RPC 결과만 사용
    const { data: rpcData } = await supabase.rpc('get_group_member_points');
    if (!rpcData) return;
    setGroupMemberPoints(rpcData as MemberStat[]);
  };

  const loadMyLogs = async () => {
    const { logs } = await getUserPoints();
    setMyPointLogs(logs);
  };

  const loadGroupApprovals = async () => {
    const { data } = await supabase.rpc('get_group_review_approvals');
    if (data) {
      const map = new Map<string, Set<string>>();
      (data as { user_id: string; book_id: string }[]).forEach(({ user_id, book_id }) => {
        if (!map.has(user_id)) map.set(user_id, new Set());
        map.get(user_id)!.add(book_id);
      });
      setGroupApprovedBookIds(map);
    }
  };

  const reloadPoints = () => {
    loadGroupPoints();
    loadMyLogs();
    loadGroupApprovals();
  };

  useEffect(() => {
    if (!user) return;

    loadGroupPoints();
    loadMyLogs();
    loadGroupApprovals();

    // INSERT, UPDATE, DELETE 모두 감지해서 포인트 즉시 갱신
    const channel = supabase
      .channel('point-logs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'point_logs' }, () => {
        loadGroupPoints();
        loadMyLogs();
        loadGroupApprovals();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadPendingInviteCount();

    // 15초마다 초대 확인
    const pollInterval = setInterval(async () => {
      const { data } = await supabase
        .from('group_members')
        .select('id, groups(name)')
        .eq('user_id', user.id)
        .eq('status', 'pending');
      const count = (data ?? []).length;
      setPendingInviteCount(prev => {
        if (count > prev && count > 0) {
          const newest = (data as unknown as { groups: { name: string } }[])[0];
          setInviteToast(`"${newest?.groups?.name ?? '새 그룹'}" 초대가 도착했어요!`);
          setTimeout(() => setInviteToast(null), 5000);
        }
        return count;
      });
    }, 15000);

    const channel = supabase
      .channel('group-members-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'group_members' },
        async () => {
          await loadGroupMembers();
          await refetchBooks();
          loadPendingInviteCount();
        })
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [user]);

  const selectedUser = groupMembers.find(m => m.id === selectedUserId) ?? profile;
  const selectedBook = selectedId ? books.find(b => b.id === selectedId) : null;
  const isOwnLibrary = !selectedUserId || selectedUserId === user?.id;

  // 후기 상태: 그룹 전체 승인 맵 기준으로 승인/미승인 판단
  const getReviewStatus = (bookId: string, userId: string): 'approved' | 'pending' | undefined => {
    const b = books.find(bk => bk.id === bookId);
    if (!b || !b.review?.trim()) return undefined;                        // 후기 없음
    const approvedSet = groupApprovedBookIds.get(userId) ?? new Set<string>();
    if (approvedSet.has(bookId)) return 'approved';                       // 후기 있음 + 승인
    return 'pending';                                                      // 후기 있음 + 미승인
  };

  const totalBooksForUser = filterBooks(selectedUserId, 'all', 'all', 'all', '').length;
  const filtered = filterBooks(selectedUserId, statusFilter, langFilter, yearFilter, search)
    .slice().sort((a, b) => {
      if (sortOrder === 'title') return a.title.localeCompare(b.title, 'ko');
      const dateA = a.finishDate ?? a.startDate ?? a.createdAt;
      const dateB = b.finishDate ?? b.startDate ?? b.createdAt;
      return dateB.localeCompare(dateA);
    });

  const years = getYears(selectedUserId);

  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId);
    setSelectedId(null);
    setStatusFilter('all');
    setLangFilter('all');
    setYearFilter('all');
    setSearch('');
    setSortOrder('recent');
    const idx = groupMembers.findIndex(m => m.id === userId);
    applyMemberColor(getMemberColor(idx >= 0 ? idx : 0));
  };

  // 내 모든 후기를 AI로 재검증 — 탈락 시 포인트 삭제, 통과 시 포인트 재지급
  const revalidateAllReviews = async () => {
    if (!getApiKey()) {
      setRevalidateToast('설정에서 Claude API 키를 먼저 입력해주세요.');
      setTimeout(() => setRevalidateToast(null), 4000);
      return;
    }
    setRevalidating(true);
    const reviewBooks = books.filter(b => b.userId === user!.id && b.review?.trim());
    let removed = 0;
    let awarded = 0;
    let kept = 0;
    for (const book of reviewBooks) {
      const result = await validateReview(book.review!, book.title);
      if (!result.valid) {
        await removePoints(book.id, 'review_approved');
        saveRejectionReason(book.id, result.reason ?? '책의 구체적인 내용이 포함된 후기를 작성해주세요.');
        removed++;
      } else {
        clearRejectionReason(book.id);
        // 완독 + 별점 있는 경우 포인트 재지급 (awardPoints는 idempotent)
        if (book.status === 'finished' && (book.rating ?? 0) > 0) {
          await awardPoints(book.id, 'review_approved', calcReviewPoints(book.totalPages, book.language));
          awarded++;
        } else {
          kept++;
        }
      }
    }
    await reloadPoints();
    setRevalidating(false);
    const msg = `재검증 완료 — 승인 ${kept + awarded}건 (신규 ${awarded}건) / 취소 ${removed}건`;
    setRevalidateToast(msg);
    setTimeout(() => setRevalidateToast(null), 6000);
  };

  // 초기 멤버 색상 적용
  useEffect(() => {
    if (selectedUserId && groupMembers.length > 0) {
      const idx = groupMembers.findIndex(m => m.id === selectedUserId);
      applyMemberColor(getMemberColor(idx >= 0 ? idx : 0));
    }
  }, [groupMembers]);

  const toggleYear = (year: number) => {
    setCollapsedYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  const grouped = groupByYearEnabled ? groupByYear(filtered) : null;

  // ─── 인트로 ───
  if (introVisible) {
    return (
      <div className={`intro-screen ${introFading ? 'fading' : ''}`}>
        <img src="/logo-vertical.png" alt="북스탯" className="intro-logo" />
      </div>
    );
  }

  // ─── 인증 로딩 ───
  if (authLoading) return null;

  // ─── 비로그인 ───
  if (!user) return <AuthScreen />;

  // ─── 프로필 미설정 ───
  if (!profile) return <ProfileSetup />;

  // ─── 부모 계정 → 프로필 선택 ───
  if (!profile.is_child && !profileSelected) {
    return (
      <ProfileSelector
        onContinueAsParent={() => {
          sessionStorage.setItem('bookstat-profile-chosen', 'true');
          setProfileSelected(true);
        }}
      />
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          {/* 왼쪽: 사용법 */}
          <div className="header-left">
            <button className="icon-btn" onClick={() => setShowHelp(true)} title="사용법">
              <HelpCircle size={20} />
            </button>
          </div>

          {/* 가운데: 로고 */}
          <div className="logo">
            <BookstatLogo size={44} className="logo-img" />
            <div className="logo-brand">
              <span className="logo-korean">북스탯</span>
              <span className="logo-english">Bookstat</span>
            </div>
          </div>

          {/* 오른쪽: 설정 + 로그아웃 */}
          <div className="header-right">
            <button className="icon-btn" onClick={() => setShowSettings(true)} title="설정">
              <Settings size={20} />
            </button>
            <button className="icon-btn" onClick={signOut} title="로그아웃">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {booksLoading && (
        <div className="loading-overlay">
          <BookstatLogo size={96} className="loading-logo" />
          <p>불러오는 중...</p>
        </div>
      )}

      <div className="app-body">
        {/* 사이드바 네비게이션 */}
        <aside className="user-sidebar">
          {/* 프로필 — 데스크탑 사이드바 */}
          {profile && (
            <div className="sidebar-profile">
              <div className="sidebar-profile-avatar" style={{ background: getMemberColor(0) }}>
                {profile.avatar_url
                  ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  : profile.display_name[0].toUpperCase()}
              </div>
              <div className="sidebar-profile-info">
                <span className="sidebar-profile-name">{profile.display_name}</span>
                <span className="sidebar-profile-pts">⭐ {(groupMemberPoints.find(m => m.user_id === user.id)?.total_points ?? 0).toLocaleString()}pt</span>
              </div>
            </div>
          )}

          <button
            className={`user-item ${mainView === 'home' ? 'active' : ''}`}
            onClick={() => setMainView('home')}
          >
            <span className="user-avatar"><Home size={16} /></span>
            <span className="user-name">홈</span>
          </button>

          <div className="sidebar-divider" />
          <div className="sidebar-title">서재</div>
          <nav className="user-list">
            {groupMembers.map((member, idx) => {
              const memberColor = getMemberColor(idx);
              const bookCount = books.filter(b => b.userId === member.id).length;
              const isActive = mainView === 'library' && selectedUserId === member.id;
              return (
                <button
                  key={member.id}
                  className={`user-item ${isActive ? 'active' : ''}`}
                  style={{ '--item-color': memberColor } as React.CSSProperties}
                  onClick={() => { handleSelectUser(member.id); setMainView('library'); }}
                >
                  <span className="user-avatar-circle" style={{ background: memberColor }}>
                    {member.avatar_url
                      ? <img src={member.avatar_url} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      : member.display_name[0].toUpperCase()}
                  </span>
                  <span className="user-name">{member.display_name}</span>
                  <span className="user-count-pill">
                    <BookOpen size={10} />{bookCount}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="sidebar-divider" />
          <button
            className={`user-item ${mainView === 'stats' ? 'active' : ''}`}
            onClick={() => setMainView('stats')}
          >
            <span className="user-avatar"><BarChart2 size={16} /></span>
            <span className="user-name">통계</span>
          </button>
          <button
            className={`user-item ${mainView === 'family' ? 'active' : ''}`}
            onClick={() => { setMainView('family'); setPendingInviteCount(0); }}
          >
            <span className="user-avatar" style={{ position: 'relative' }}>
              <Users size={16} />
              {pendingInviteCount > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -6,
                  background: 'var(--accent)', color: '#fff',
                  borderRadius: '50%', fontSize: 9, fontWeight: 700,
                  width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{pendingInviteCount}</span>
              )}
            </span>
            <span className="user-name">가족</span>
          </button>

          <div className="sidebar-bottom">
            <button className="user-item" onClick={() => setShowSettings(true)}>
              <span className="user-avatar"><Settings size={16} /></span>
              <span className="user-name">설정</span>
            </button>
            <button className="user-item" onClick={signOut}>
              <span className="user-avatar"><LogOut size={16} /></span>
              <span className="user-name">로그아웃</span>
            </button>
          </div>
        </aside>

        {/* 메인 컨텐츠 */}
        <main className="main-content">
          {mainView === 'home' ? (
            <HomeView
              profile={profile}
              books={books}
              userId={user.id}
              groupMembers={groupMembers}
              groupMemberPoints={groupMemberPoints}
              pointLogs={myPointLogs}
              onNavigateToLibrary={() => { handleSelectUser(user.id); setMainView('library'); }}
              onNavigateToFamily={() => setMainView('family')}
              onShowAdd={() => setShowAdd(true)}
              onShowPoints={() => setShowPoints(true)}
              onShowChildComplete={(bookId) => { setChildCompleteBookId(bookId ?? null); setShowChildComplete(true); }}
            />
          ) : mainView === 'stats' ? (
            <StatsView
              books={books}
              userId={user.id}
              groupMembers={groupMembers}
              groupMemberPoints={groupMemberPoints}
            />
          ) : mainView === 'family' ? (
            <FamilyView
              members={groupMembers}
              memberPoints={groupMemberPoints}
              books={books}
              userId={user.id}
              onViewLibrary={(uid) => { handleSelectUser(uid); setMainView('library'); }}
              onOpenGroupManager={() => setShowGroupManager(true)}
            />
          ) : selectedBook ? (
            <BookDetail
              book={selectedBook}
              onBack={() => setSelectedId(null)}
              onUpdate={updates => updateBook(selectedBook.id, updates)}
              onAddVocab={entry => addVocab(selectedBook.id, entry)}
              onDeleteVocab={id => deleteVocab(selectedBook.id, id)}
              onAddNote={note => addNote(selectedBook.id, note)}
              onDeleteNote={id => deleteNote(selectedBook.id, id)}
              onPointsSync={reloadPoints}
              onWriteReview={isOwnLibrary ? () => { setChildCompleteBookId(selectedBook.id); setShowChildComplete(true); } : undefined}
              reviewStatus={getReviewStatus(selectedBook.id, selectedBook.userId ?? user.id)}
              readOnly={!isOwnLibrary}
              currentUserId={user.id}
              groupMembers={groupMembers}
            />
          ) : (
            <>
              {/* 모바일 멤버 전환 스트립 — 사이드바 대체 */}
              {groupMembers.length > 1 && (
                <div className="mobile-member-strip">
                  {groupMembers.map((member, idx) => {
                    const color = getMemberColor(idx);
                    const isActive = selectedUserId === member.id;
                    return (
                      <button
                        key={member.id}
                        className={`mobile-member-chip ${isActive ? 'active' : ''}`}
                        style={{ '--chip-color': color } as React.CSSProperties}
                        onClick={() => handleSelectUser(member.id)}
                      >
                        <span className="mobile-member-chip-avatar" style={{ background: color }}>
                          {member.avatar_url
                            ? <img src={member.avatar_url} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                            : member.display_name[0].toUpperCase()}
                        </span>
                        <span className="mobile-member-chip-name">{member.display_name}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="user-heading">
                <span className="user-heading-emoji">
                  {selectedUser?.avatar_url
                    ? <img src={selectedUser.avatar_url} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                    : selectedUser?.display_name[0].toUpperCase()}
                </span>
                <h2>{selectedUser?.display_name}의 서재 <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>· {totalBooksForUser}권</span></h2>
                {isOwnLibrary && (
                  <button
                    className="icon-btn"
                    onClick={revalidateAllReviews}
                    disabled={revalidating}
                    title="내 후기 전체 재검증"
                    style={{ marginLeft: 'auto' }}
                  >
                    <RefreshCw size={16} className={revalidating ? 'spin' : ''} />
                  </button>
                )}
              </div>

              {isOwnLibrary && (
                <ReadingCheckinSection books={books} userId={user.id} />
              )}

<div className="list-controls">
                <div className="search-wrap">
                  <Search size={16} className="search-icon" />
                  <input
                    className="search-input"
                    placeholder="제목 또는 저자 검색..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>

                <div className="filter-row">
                  <span className="filter-label">언어</span>
                  <div className="filter-tabs">
                    {LANG_FILTERS.map(f => (
                      <button
                        key={f.value}
                        className={`filter-btn ${langFilter === f.value ? 'active' : ''}`}
                        onClick={() => setLangFilter(f.value)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="filter-row">
                  <span className="filter-label">상태</span>
                  <div className="filter-tabs">
                    {STATUS_FILTERS.map(f => (
                      <button
                        key={f.value}
                        className={`filter-btn ${statusFilter === f.value ? 'active' : ''}`}
                        onClick={() => setStatusFilter(f.value)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="filter-row">
                  <span className="filter-label">연도</span>
                  <div className="filter-tabs">
                    <button
                      className={`filter-btn ${yearFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setYearFilter('all')}
                    >
                      전체
                    </button>
                    {years.map(y => (
                      <button
                        key={y}
                        className={`filter-btn ${yearFilter === y ? 'active' : ''}`}
                        onClick={() => setYearFilter(y)}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                  <button
                    className={`filter-btn group-toggle ${groupByYearEnabled ? 'active' : ''}`}
                    onClick={() => setGroupByYearEnabled(v => !v)}
                  >
                    연도별 묶기
                  </button>
                </div>

                <div className="filter-row">
                  <span className="filter-label">정렬</span>
                  <div className="filter-tabs">
                    <button className={`filter-btn ${sortOrder === 'recent' ? 'active' : ''}`} onClick={() => setSortOrder('recent')}>최근 읽은 순</button>
                    <button className={`filter-btn ${sortOrder === 'title' ? 'active' : ''}`} onClick={() => setSortOrder('title')}>제목 가나다순</button>
                  </div>
                </div>
              </div>

              {filtered.length === 0 ? (
                isOwnLibrary && totalBooksForUser === 0 ? (
                  <div className="empty-guide-card">
                    <div className="empty-guide-header">
                      <BookstatLogo size={56} />
                      <div>
                        <p className="empty-guide-welcome">북스탯에 오신 걸 환영해요! 👋</p>
                        <p className="empty-guide-sub">책을 추가하고 독서 포인트를 모아보세요.</p>
                      </div>
                    </div>
                    <div className="empty-guide-steps">
                      {[
                        { emoji: '📸', text: '카메라로 표지 촬영 → 책 자동 인식' },
                        { emoji: '⭐', text: '다 읽은 책에 별점·후기 → 포인트 획득' },
                        { emoji: '👨‍👩‍👧', text: '설정에서 가족을 초대해 함께 기록' },
                        { emoji: '🛍️', text: '포인트로 마켓에서 선물 신청' },
                      ].map((s, i) => (
                        <div key={i} className="empty-guide-step">
                          <span>{s.emoji}</span>
                          <span>{s.text}</span>
                        </div>
                      ))}
                    </div>
                    <div className="empty-guide-actions">
                      <button className="btn-primary" onClick={() => setShowAdd(true)}>
                        <Plus size={16} /> 첫 번째 책 추가하기
                      </button>
                      <button className="btn-secondary" onClick={() => setShowHelp(true)}>
                        자세한 사용법 보기
                      </button>
                    </div>
                  </div>
                ) : (
                <div className="empty-state">
                  <BookstatLogo size={80} style={{ opacity: 0.4 }} />
                  <p>조건에 맞는 책이 없습니다.</p>
                  {isOwnLibrary && (
                    <button className="btn-primary" onClick={() => setShowAdd(true)}>
                      <Plus size={18} /> 책 추가하기
                    </button>
                  )}
                </div>
                )
              ) : grouped ? (
                <div className="year-groups">
                  {Array.from(grouped.entries()).map(([year, yearBooks]) => (
                    <div key={year} className="year-group">
                      <button className="year-group-header" onClick={() => toggleYear(year)}>
                        {collapsedYears.has(year) ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                        <span>{year}년</span>
                        <span className="year-count">{yearBooks.length}권</span>
                      </button>
                      {!collapsedYears.has(year) && (
                        <div className="book-grid">
                          {yearBooks.map((book, idx) => (
                            <BookCard key={book.id} book={book} number={idx + 1}
                              onClick={() => setSelectedId(book.id)}
                              onDelete={e => { e.stopPropagation(); deleteBook(book.id); }}
                              reviewStatus={getReviewStatus(book.id, book.userId ?? selectedUserId)}
                              readOnly={!isOwnLibrary}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="book-grid">
                  {filtered.map((book, idx) => (
                    <BookCard key={book.id} book={book} number={idx + 1}
                      onClick={() => setSelectedId(book.id)}
                      onDelete={e => { e.stopPropagation(); deleteBook(book.id); }}
                      reviewStatus={getReviewStatus(book.id, book.userId ?? selectedUserId)}
                      readOnly={!isOwnLibrary}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>

        {/* 우측 패널 — 데스크탑 전용 */}
        <RightPanel
          books={books}
          members={groupMembers}
          memberPoints={groupMemberPoints}
          userId={user.id}
          onNavigateToFamily={() => { setMainView('family'); setPendingInviteCount(0); }}
        />
      </div>

      {/* 서재 탭 통합 액션 바 */}
      {isOwnLibrary && mainView === 'library' && !selectedBook && (() => {
        const hasReading = filterBooks(user.id, 'reading', 'all', 'all', '').length > 0;
        const hasNoReview = filterBooks(user.id, 'finished', 'all', 'all', '').some(b => !b.review?.trim());
        const hasCompletable = hasReading || hasNoReview;
        return (
          <div className="library-action-bar">
            <button className="library-action-btn library-action-btn--secondary" onClick={() => setShowAdd(true)}>
              <Plus size={15} /> 책 추가
            </button>
            {hasCompletable && (
              <button className="library-action-btn library-action-btn--primary" onClick={() => { setChildCompleteBookId(null); setShowChildComplete(true); }}>
                {hasReading ? '📖 다 읽었어요' : '✏️ 후기 쓰기'}
              </button>
            )}
          </div>
        );
      })()}

      {/* 모바일 하단 탭 바 */}
      <nav className="mobile-tab-bar">
        <button className={`mobile-tab ${mainView === 'home' ? 'active' : ''}`} onClick={() => setMainView('home')}>
          <Home size={20} />
          <span className="mobile-tab-name">홈</span>
        </button>
        <button
          className={`mobile-tab ${mainView === 'library' ? 'active' : ''}`}
          onClick={() => { handleSelectUser(user.id); setMainView('library'); }}
        >
          <BookOpen size={20} />
          <span className="mobile-tab-name">서재</span>
        </button>
        <button className={`mobile-tab ${mainView === 'stats' ? 'active' : ''}`} onClick={() => setMainView('stats')}>
          <BarChart2 size={20} />
          <span className="mobile-tab-name">통계</span>
        </button>
        <button className={`mobile-tab ${mainView === 'family' ? 'active' : ''}`} onClick={() => { setMainView('family'); setPendingInviteCount(0); }}>
          <span style={{ position: 'relative', display: 'inline-flex' }}>
            <Users size={20} />
            {pendingInviteCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -6,
                background: 'var(--accent)', color: '#fff',
                borderRadius: '50%', fontSize: 9, fontWeight: 700,
                width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{pendingInviteCount}</span>
            )}
          </span>
          <span className="mobile-tab-name">가족</span>
        </button>
      </nav>

      {revalidateToast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-surface)', color: 'var(--text-heading)',
          border: '1px solid var(--border)',
          padding: '12px 20px', borderRadius: 12, fontSize: 14, fontWeight: 600,
          zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          whiteSpace: 'nowrap',
        }}>
          {revalidateToast}
        </div>
      )}

      {inviteToast && (
        <div onClick={() => { setShowGroupManager(true); setInviteToast(null); }} style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--accent)', color: '#fff', padding: '12px 20px',
          borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer',
          zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Users size={16} /> {inviteToast}
        </div>
      )}

      {showAdd && (
        <AddBookModal
          onAdd={async book => {
            const bookId = await addBook(book, user.id);
            if (book.status !== 'want-to-read') {
              awardPoints(bookId, 'book_added', 2)
                .then(() => { reloadPoints(); setPointsCelebration({ points: 2, label: '📚 책 추가 완료!' }); })
                .catch(console.error);
            }
          }}
          onClose={() => setShowAdd(false)}
        />
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onGroupChange={loadGroupMembers} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showPoints && (
        <PointsModal
          total={groupMemberPoints.find(m => m.user_id === user.id)?.total_points ?? 0}
          logs={myPointLogs}
          books={books}
          userId={user.id}
          onClose={() => setShowPoints(false)}
        />
      )}
      {showGroupManager && (
        <GroupManager
          onClose={() => setShowGroupManager(false)}
          onGroupChange={async () => { await loadGroupMembers(); await refetchBooks(); }}
        />
      )}
      {showChildComplete && (() => {
        const readingBooks = filterBooks(user.id, 'reading', 'all', 'all', '');
        const noReviewBooks = filterBooks(user.id, 'finished', 'all', 'all', '').filter(b => !b.review?.trim());
        const allCompletable = [...readingBooks, ...noReviewBooks];
        // If triggered from a specific book, show only that book (even if filtered out above)
        const targetBook = childCompleteBookId ? books.find(b => b.id === childCompleteBookId) : null;
        const completableBooks = targetBook && !allCompletable.find(b => b.id === targetBook.id)
          ? [targetBook, ...allCompletable]
          : allCompletable;
        return (
          <ChildReadingComplete
            books={completableBooks}
            isChild={profile?.is_child ?? false}
            onComplete={async (bookId, updates) => {
              const book = books.find(b => b.id === bookId);
              const wasReading = book?.status === 'reading';
              // 완독일: 새로 완독하면 오늘, 이미 완독된 책이면 기존 날짜
              const finishDate = wasReading
                ? new Date().toISOString().split('T')[0]
                : book?.finishDate;
              await updateBook(bookId, {
                ...(wasReading ? {
                  status: 'finished' as const,
                  finishDate,
                } : {}),
                rating: updates.rating,
                childEmotion: updates.childEmotion,
                childAnswers: updates.childAnswers,
                review: updates.review || undefined,
              });
              let totalPts = 0;
              let celebrationLabel = '';
              if (wasReading) {
                const finishedPts = calcFinishedPoints(book?.totalPages, book?.language);
                // finishDate 전달 → 로그 created_at = 완독일 → 연도 필터가 완독 연도 기준으로 동작
                await awardPoints(bookId, 'book_finished', finishedPts, finishDate);
                totalPts += finishedPts;
                celebrationLabel = '📖 완독 완료!';
              }
              if (book && updates.review) {
                clearRejectionReason(bookId);
                const reviewPts = calcReviewPoints(book.totalPages, book.language);
                await awardPoints(bookId, 'review_approved', reviewPts, finishDate ?? book?.finishDate);
                totalPts += reviewPts;
                celebrationLabel = wasReading ? '✨ 완독 + 감상문 완성!' : '✍️ 감상문 완성!';
              }
              if (totalPts > 0) {
                reloadPoints();
                setPointsCelebration({ points: totalPts, label: celebrationLabel });
              }
              await refetchBooks();
            }}
            onClose={() => { setShowChildComplete(false); setChildCompleteBookId(null); }}
          />
        );
      })()}
      {pointsCelebration && (
        <PointsCelebration
          points={pointsCelebration.points}
          label={pointsCelebration.label}
          onDismiss={() => setPointsCelebration(null)}
        />
      )}
    </div>
  );
}
