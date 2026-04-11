import { useState, useEffect } from 'react';
import { useBooks } from './useBooks';
import type { ReadingStatus, BookLanguage } from './types';
import BookCard from './components/BookCard';
import BookDetail from './components/BookDetail';
import AddBookModal from './components/AddBookModal';
import Dashboard from './components/Dashboard';
import SettingsModal from './components/SettingsModal';
import AuthScreen from './components/AuthScreen';
import ProfileSetup from './components/ProfileSetup';
import GroupManager from './components/GroupManager';
import PointsModal from './components/PointsModal';
import GroupDashboardModal from './components/GroupDashboardModal';
import { useAuth } from './contexts/AuthContext';
import { getUserPoints, awardPoints } from './services/points';
import type { PointLog } from './services/points';
import { supabase } from './lib/supabase';
import type { Profile } from './contexts/AuthContext';
import { Plus, Search, Settings, ChevronDown, ChevronRight, Users, LogOut, BarChart2 } from 'lucide-react';
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
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { books, loading: booksLoading, addBook, updateBook, deleteBook, addVocab, deleteVocab, addNote, deleteNote, getStats, filterBooks, getYears, groupByYear, refetchBooks } = useBooks();

  const [introVisible, setIntroVisible] = useState(true);
  const [introFading, setIntroFading] = useState(false);

  // 그룹 멤버 (사이드바용)
  const [groupMembers, setGroupMembers] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);
  const [inviteToast, setInviteToast] = useState<string | null>(null);

  const [myPoints, setMyPoints] = useState(0);
  const [myPointLogs, setMyPointLogs] = useState<PointLog[]>([]);
  const [showPoints, setShowPoints] = useState(false);
  const [showGroupDashboard, setShowGroupDashboard] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ReadingStatus | 'all'>('all');
  const [langFilter, setLangFilter] = useState<BookLanguage | 'all'>('all');
  const [yearFilter, setYearFilter] = useState<number | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'recent' | 'title'>('recent');
  const [groupByYearEnabled, setGroupByYearEnabled] = useState(false);
  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(new Set());

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

  // ─── 포인트 로드 & 실시간 동기화 ───
  useEffect(() => {
    if (!user) return;
    const loadPoints = async () => {
      const { total, logs } = await getUserPoints();
      setMyPoints(total);
      setMyPointLogs(logs);
    };
    loadPoints();

    const channel = supabase
      .channel('point-logs-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'point_logs' }, () => {
        loadPoints();
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

  const filtered = filterBooks(selectedUserId, statusFilter, langFilter, yearFilter, search).slice().sort((a, b) => {
    if (sortOrder === 'title') return a.title.localeCompare(b.title, 'ko');
    const dateA = a.finishDate ?? a.startDate ?? a.createdAt;
    const dateB = b.finishDate ?? b.startDate ?? b.createdAt;
    return dateB.localeCompare(dateA);
  });

  const stats = getStats(selectedUserId);
  const years = getYears(selectedUserId);

  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId);
    setSelectedId(null);
    setStatusFilter('all');
    setLangFilter('all');
    setYearFilter('all');
    setSearch('');
    setSortOrder('recent');
  };

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
        <img src="/logo.png" alt="북스탯" className="intro-logo" />
      </div>
    );
  }

  // ─── 인증 로딩 ───
  if (authLoading) return null;

  // ─── 비로그인 ───
  if (!user) return <AuthScreen />;

  // ─── 프로필 미설정 ───
  if (!profile) return <ProfileSetup />;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <img src="/logo.png" alt="북스탯" className="logo-img" />
            <span>북스탯</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!selectedBook && isOwnLibrary && (
              <button className="btn-primary header-add-btn" onClick={() => setShowAdd(true)}>
                <Plus size={18} /> 책 추가
              </button>
            )}
            <button className="icon-btn" onClick={() => setShowGroupDashboard(true)} title="그룹 통계">
              <BarChart2 size={20} />
            </button>
            <button className="icon-btn" onClick={() => { setShowGroupManager(true); setPendingInviteCount(0); }} title="그룹 관리" style={{ position: 'relative' }}>
              <Users size={20} />
              {pendingInviteCount > 0 && (
                <span style={{
                  position: 'absolute', top: 2, right: 2,
                  background: 'var(--accent)', color: '#fff',
                  borderRadius: '50%', fontSize: 10, fontWeight: 700,
                  width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1,
                }}>{pendingInviteCount}</span>
              )}
            </button>
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
          <img src="/logo.png" alt="북스탯" className="loading-logo" />
          <p>불러오는 중...</p>
        </div>
      )}

      <div className="app-body">
        {/* 유저 사이드바 */}
        <aside className="user-sidebar">
          <div className="sidebar-title">서재</div>
          <nav className="user-list">
            {groupMembers.map(member => (
              <button
                key={member.id}
                className={`user-item ${selectedUserId === member.id ? 'active' : ''}`}
                onClick={() => handleSelectUser(member.id)}
              >
                <span className="user-avatar">
                  {member.avatar_url
                    ? <img src={member.avatar_url} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                    : member.display_name[0].toUpperCase()}
                </span>
                <span className="user-name">{member.display_name}</span>
                <span className="user-count">
                  {books.filter(b => b.userId === member.id).length}
                </span>
              </button>
            ))}
            <button className="user-item add-group-btn" onClick={() => setShowGroupManager(true)}>
              <span className="user-avatar"><Users size={16} /></span>
              <span className="user-name">그룹 관리</span>
            </button>
          </nav>
        </aside>

        {/* 메인 컨텐츠 */}
        <main className="main-content">
          {selectedBook ? (
            <BookDetail
              book={selectedBook}
              onBack={() => setSelectedId(null)}
              onUpdate={updates => updateBook(selectedBook.id, updates)}
              onAddVocab={entry => addVocab(selectedBook.id, entry)}
              onDeleteVocab={id => deleteVocab(selectedBook.id, id)}
              onAddNote={note => addNote(selectedBook.id, note)}
              onDeleteNote={id => deleteNote(selectedBook.id, id)}
              readOnly={!isOwnLibrary}
            />
          ) : (
            <>
              <div className="user-heading">
                <span className="user-heading-emoji">
                  {selectedUser?.avatar_url
                    ? <img src={selectedUser.avatar_url} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                    : selectedUser?.display_name[0].toUpperCase()}
                </span>
                <h2>{selectedUser?.display_name}의 서재</h2>
              </div>

              <Dashboard
                stats={stats}
                statusFilter={statusFilter}
                onStatusFilter={setStatusFilter}
                totalPoints={isOwnLibrary ? myPoints : undefined}
                onPointsClick={isOwnLibrary ? () => setShowPoints(true) : undefined}
              />

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
                <div className="empty-state">
                  <img src="/logo.png" alt="북스탯" style={{ width: 80, opacity: 0.4 }} />
                  <p>조건에 맞는 책이 없습니다.</p>
                  {isOwnLibrary && (
                    <button className="btn-primary" onClick={() => setShowAdd(true)}>
                      <Plus size={18} /> 책 추가하기
                    </button>
                  )}
                </div>
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
                      readOnly={!isOwnLibrary}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* 모바일 하단 탭 바 */}
      <nav className="mobile-tab-bar">
        {groupMembers.slice(0, 3).map(member => (
          <button
            key={member.id}
            className={`mobile-tab ${selectedUserId === member.id ? 'active' : ''}`}
            onClick={() => handleSelectUser(member.id)}
          >
            <span className="mobile-tab-emoji">
              {member.avatar_url
                ? <img src={member.avatar_url} style={{ width: 22, height: 22, borderRadius: '50%' }} />
                : member.display_name[0].toUpperCase()}
            </span>
            <span className="mobile-tab-name">{member.display_name}</span>
          </button>
        ))}
        {isOwnLibrary && (
          <button className="mobile-tab" onClick={() => setShowAdd(true)}>
            <Plus size={22} />
            <span className="mobile-tab-name">추가</span>
          </button>
        )}
      </nav>

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
              awardPoints(bookId, 'book_added', 1).catch(console.error);
            }
          }}
          onClose={() => setShowAdd(false)}
        />
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showGroupDashboard && (
        <GroupDashboardModal
          books={books}
          onClose={() => setShowGroupDashboard(false)}
        />
      )}
      {showPoints && (
        <PointsModal
          total={myPoints}
          logs={myPointLogs}
          books={books}
          onClose={() => setShowPoints(false)}
        />
      )}
      {showGroupManager && (
        <GroupManager
          onClose={() => setShowGroupManager(false)}
          onGroupChange={async () => { await loadGroupMembers(); await refetchBooks(); }}
        />
      )}
    </div>
  );
}
