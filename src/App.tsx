import { useState, useEffect } from 'react';
import { useBooks } from './useBooks';
import type { ReadingStatus, BookLanguage } from './types';
import BookCard from './components/BookCard';
import BookDetail from './components/BookDetail';
import AddBookModal from './components/AddBookModal';
import Dashboard from './components/Dashboard';
import SettingsModal from './components/SettingsModal';
import { Plus, Search, Settings, ChevronDown, ChevronRight } from 'lucide-react';
import './App.css';

const USERS = [
  { id: 'dad',    name: '아빠', emoji: '👨' },
  { id: 'mom',    name: '엄마', emoji: '👩' },
  { id: 'suyeon', name: '수연', emoji: '👧' },
];

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
  const { books, loading, addBook, updateBook, deleteBook, addVocab, deleteVocab, addNote, deleteNote, getStats, filterBooks, getYears, groupByYear } = useBooks();
  const [introVisible, setIntroVisible] = useState(true);
  const [introFading, setIntroFading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('dad');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // 인트로: 1.2초 보여주다가 fade out
  useEffect(() => {
    const t1 = setTimeout(() => setIntroFading(true), 600);
    const t2 = setTimeout(() => setIntroVisible(false), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  const [statusFilter, setStatusFilter] = useState<ReadingStatus | 'all'>('all');
  const [langFilter, setLangFilter] = useState<BookLanguage | 'all'>('all');
  const [yearFilter, setYearFilter] = useState<number | 'all'>('all');
  const [search, setSearch] = useState('');
  const [groupByYearEnabled, setGroupByYearEnabled] = useState(false);
  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(new Set());

  const selectedUser = USERS.find(u => u.id === selectedUserId)!;
  const selectedBook = selectedId ? books.find(b => b.id === selectedId) : null;
  const filtered = filterBooks(selectedUserId, statusFilter, langFilter, yearFilter, search);
  const stats = getStats(selectedUserId);
  const years = getYears(selectedUserId);

  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId);
    setSelectedId(null);
    setStatusFilter('all');
    setLangFilter('all');
    setYearFilter('all');
    setSearch('');
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

  return (
    <>
    {introVisible && (
      <div className={`intro-screen ${introFading ? 'fading' : ''}`}>
        <img src="/logo.png" alt="북스탯" className="intro-logo" />
      </div>
    )}
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <img src="/logo.png" alt="북스탯" className="logo-img" />
            <span>북스탯</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!selectedBook && (
              <button className="btn-primary header-add-btn" onClick={() => setShowAdd(true)}>
                <Plus size={18} /> 책 추가
              </button>
            )}
            <button className="icon-btn" onClick={() => setShowSettings(true)} title="설정">
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      {loading && (
        <div className="loading-overlay">
          <img src="/logo.png" alt="북스탯" className="loading-logo" />
          <p>불러오는 중...</p>
        </div>
      )}

      <div className="app-body">
        {/* 유저 사이드바 */}
        <aside className="user-sidebar">
          <div className="sidebar-title">가족 서재</div>
          <nav className="user-list">
            {USERS.map(user => (
              <button
                key={user.id}
                className={`user-item ${selectedUserId === user.id ? 'active' : ''}`}
                onClick={() => handleSelectUser(user.id)}
              >
                <span className="user-avatar">{user.emoji}</span>
                <span className="user-name">{user.name}</span>
                <span className="user-count">
                  {books.filter(b => b.userId === user.id).length}
                </span>
              </button>
            ))}
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
            />
          ) : (
            <>
              <div className="user-heading">
                <span className="user-heading-emoji">{selectedUser.emoji}</span>
                <h2>{selectedUser.name}의 서재</h2>
              </div>

              <Dashboard stats={stats} statusFilter={statusFilter} onStatusFilter={setStatusFilter} />

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
                    title="연도별 그룹화"
                  >
                    연도별 묶기
                  </button>
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="empty-state">
                  <img src="/logo.png" alt="북스탯" style={{ width: 80, opacity: 0.4 }} />
                  <p>조건에 맞는 책이 없습니다.</p>
                  <button className="btn-primary" onClick={() => setShowAdd(true)}>
                    <Plus size={18} /> 책 추가하기
                  </button>
                </div>
              ) : grouped ? (
                <div className="year-groups">
                  {Array.from(grouped.entries()).map(([year, yearBooks]) => (
                    <div key={year} className="year-group">
                      <button
                        className="year-group-header"
                        onClick={() => toggleYear(year)}
                      >
                        {collapsedYears.has(year)
                          ? <ChevronRight size={18} />
                          : <ChevronDown size={18} />}
                        <span>{year}년</span>
                        <span className="year-count">{yearBooks.length}권</span>
                      </button>
                      {!collapsedYears.has(year) && (
                        <div className="book-grid">
                          {yearBooks.map((book, idx) => (
                            <BookCard
                              key={book.id}
                              book={book}
                              number={idx + 1}
                              onClick={() => setSelectedId(book.id)}
                              onDelete={e => { e.stopPropagation(); deleteBook(book.id); }}
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
                    <BookCard
                      key={book.id}
                      book={book}
                      number={idx + 1}
                      onClick={() => setSelectedId(book.id)}
                      onDelete={e => { e.stopPropagation(); deleteBook(book.id); }}
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
        {USERS.map(user => (
          <button
            key={user.id}
            className={`mobile-tab ${selectedUserId === user.id ? 'active' : ''}`}
            onClick={() => handleSelectUser(user.id)}
          >
            <span className="mobile-tab-emoji">{user.emoji}</span>
            <span className="mobile-tab-name">{user.name}</span>
          </button>
        ))}
        <button
          className="mobile-tab"
          onClick={() => setShowAdd(true)}
        >
          <Plus size={22} />
          <span className="mobile-tab-name">추가</span>
        </button>
      </nav>

      {showAdd && (
        <AddBookModal
          onAdd={book => addBook(book, selectedUserId)}
          onClose={() => setShowAdd(false)}
        />
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
    </>
  );
}
