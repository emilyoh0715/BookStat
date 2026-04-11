import { useState, useRef } from 'react';
import type { Book, ReadingStatus, BookLanguage } from '../types';
import StatusBadge from './StatusBadge';
import StarRating from './StarRating';
import { lookupVocab, getApiKey } from '../services/claudeVocab';
import { GENRES } from '../lib/genres';
import { ArrowLeft, Plus, Trash2, BookOpen, StickyNote, BookMarked, Edit2, Check, X, Sparkles, Loader, Camera, Search, Wand2 } from 'lucide-react';

interface BookCandidate {
  cover: string;
  title: string;
  author: string;
  publisher: string;
  pages?: number;
  categoryName?: string;
}

function mapCategory(categoryName?: string): string {
  if (!categoryName) return '';
  const cat = categoryName;
  if (/소설|시\/희곡|희곡/.test(cat)) return cat.includes('시') && !cat.includes('소설') ? '시/에세이' : '소설';
  if (/에세이/.test(cat)) return '시/에세이';
  if (/경제|경영/.test(cat)) return '경제/경영';
  if (/자기계발/.test(cat)) return '자기계발';
  if (/인문/.test(cat)) return '인문';
  if (/사회|정치/.test(cat)) return '정치/사회';
  if (/역사|문화/.test(cat)) return '역사/문화';
  if (/과학/.test(cat)) return '과학';
  if (/컴퓨터|IT|프로그래밍/.test(cat)) return '컴퓨터/IT';
  if (/외국어/.test(cat)) return '외국어';
  if (/여행/.test(cat)) return '여행';
  if (/요리/.test(cat)) return '요리';
  if (/건강|의학/.test(cat)) return '건강';
  if (/육아|가정/.test(cat)) return '가정/육아';
  if (/예술|대중문화|음악|영화/.test(cat)) return '예술/대중문화';
  if (/종교/.test(cat)) return '종교';
  if (/만화/.test(cat)) return '만화';
  if (/청소년/.test(cat)) return '청소년';
  if (/어린이|초등/.test(cat)) return '어린이(초등)';
  if (/취미|스포츠|실용/.test(cat)) return '취미/실용/스포츠';
  if (/기술|공학/.test(cat)) return '기술/공학';
  if (/취업|수험/.test(cat)) return '취업/수험서';
  if (/잡지/.test(cat)) return '잡지';
  return '';
}

async function fetchBookCandidates(title: string, author: string): Promise<BookCandidate[]> {
  try {
    const params = new URLSearchParams({ title, ...(author ? { author } : {}) });
    const res = await fetch(`/api/book-covers?${params}`);
    const data = await res.json() as { books?: BookCandidate[]; covers?: string[] };
    // 구버전 응답(covers only) 대비 폴백
    if (data.books) return data.books;
    return (data.covers ?? []).map(cover => ({ cover, title, author, publisher: '' }));
  } catch {
    return [];
  }
}

interface Props {
  book: Book;
  onBack: () => void;
  onUpdate: (updates: Partial<Book>) => void;
  onAddVocab: (entry: { word: string; meaning: string; sentence?: string; page?: number }) => void;
  onDeleteVocab: (id: string) => void;
  onAddNote: (note: { content: string; page?: number }) => void;
  onDeleteNote: (id: string) => void;
}

type Tab = 'info' | 'vocab' | 'notes';

const STATUS_OPTIONS: { value: ReadingStatus; label: string }[] = [
  { value: 'reading', label: '읽는 중' },
  { value: 'want-to-read', label: '읽고 싶음' },
  { value: 'finished', label: '다 읽음' },
  { value: 'paused', label: '잠시 멈춤' },
];

const LANG_OPTIONS: { value: BookLanguage; label: string; flag: string }[] = [
  { value: 'korean', label: '한국어', flag: '🇰🇷' },
  { value: 'english', label: '영어 원서', flag: '🇺🇸' },
  { value: 'other', label: '기타', flag: '🌐' },
];

export default function BookDetail({ book, onBack, onUpdate, onAddVocab, onDeleteVocab, onAddNote, onDeleteNote }: Props) {
  const [tab, setTab] = useState<Tab>('info');
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({
    status: book.status,
    currentPage: book.currentPage?.toString() ?? '',
    rating: book.rating ?? 0,
    review: book.review ?? '',
    finishDate: book.finishDate ?? '',
  });

  const [editingMeta, setEditingMeta] = useState(false);
  const [metaForm, setMetaForm] = useState({
    title: book.title,
    author: book.author,
    publisher: book.publisher ?? '',
    genre: book.genre ?? '',
    language: book.language,
    totalPages: book.totalPages?.toString() ?? '',
    startDate: book.startDate ?? '',
  });
  const [metaAutoFilling, setMetaAutoFilling] = useState(false);

  const saveMeta = () => {
    onUpdate({
      title: metaForm.title.trim() || book.title,
      author: metaForm.author.trim(),
      publisher: metaForm.publisher.trim() || undefined,
      genre: metaForm.genre.trim() || undefined,
      language: metaForm.language,
      totalPages: metaForm.totalPages ? Number(metaForm.totalPages) : undefined,
      startDate: metaForm.startDate || undefined,
    });
    setEditingMeta(false);
  };

  const handleMetaAutoFill = async () => {
    if (!metaForm.title.trim()) return;
    setMetaAutoFilling(true);
    const candidates = await fetchBookCandidates(metaForm.title.trim(), metaForm.author.trim());
    if (candidates.length > 0) {
      const best = candidates[0];
      setMetaForm(f => ({
        ...f,
        // 비어 있는 필드만 채움
        author: f.author.trim() || best.author,
        publisher: f.publisher.trim() || best.publisher,
        genre: f.genre || mapCategory(best.categoryName),
        // 페이지수: 검색 결과가 있으면 항상 업데이트 (명시적으로 버튼을 누른 경우)
        totalPages: best.pages ? String(best.pages) : f.totalPages,
      }));
    }
    setMetaAutoFilling(false);
  };

  const [vocabForm, setVocabForm] = useState({ word: '', meaning: '', sentence: '', page: '' });
  const [noteForm, setNoteForm] = useState({ content: '', page: '' });
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');

  const [editingCover, setEditingCover] = useState(false);
  const [coverCandidates, setCoverCandidates] = useState<BookCandidate[]>([]);
  const [coverIdx, setCoverIdx] = useState(0);
  const [coverSearching, setCoverSearching] = useState(false);
  const [manualCoverUrl, setManualCoverUrl] = useState('');
  const [manualCoverMode, setManualCoverMode] = useState(false);
  const coverSearchedFor = useRef('');

  const openCoverEdit = async () => {
    setEditingCover(true);
    setManualCoverMode(false);
    setManualCoverUrl(book.cover ?? '');
    const key = `${book.title}|${book.author}`;
    if (coverSearchedFor.current !== key) {
      coverSearchedFor.current = key;
      setCoverSearching(true);
      const candidates = await fetchBookCandidates(book.title, book.author);
      setCoverCandidates(candidates);
      setCoverIdx(0);
      setCoverSearching(false);
    }
  };

  const saveCover = () => {
    const selected = manualCoverMode ? null : coverCandidates[coverIdx];
    const url = manualCoverMode ? manualCoverUrl : (selected?.cover ?? '');

    const updates: Partial<Book> = { cover: url || undefined };

    // 표지 선택 시 빈 메타데이터도 함께 채움
    if (selected) {
      if (!book.author?.trim() && selected.author) updates.author = selected.author;
      if (!book.publisher?.trim() && selected.publisher) updates.publisher = selected.publisher;
      if (!book.totalPages && selected.pages) updates.totalPages = selected.pages;
      if (!book.genre && selected.categoryName) {
        const mapped = mapCategory(selected.categoryName);
        if (mapped) updates.genre = mapped;
      }
    }

    onUpdate(updates);
    setEditingCover(false);
  };

  const progress = book.totalPages && book.currentPage
    ? Math.round((book.currentPage / book.totalPages) * 100) : null;

  const saveInfo = () => {
    onUpdate({
      status: infoForm.status,
      currentPage: infoForm.currentPage ? Number(infoForm.currentPage) : undefined,
      rating: infoForm.rating || undefined,
      review: infoForm.review || undefined,
      finishDate: infoForm.finishDate || undefined,
    });
    setEditingInfo(false);
  };

  const handleAutoLookup = async () => {
    if (!vocabForm.word.trim()) return;
    if (!getApiKey()) {
      setLookupError('설정에서 Claude API 키를 먼저 입력해주세요.');
      return;
    }
    setLookupLoading(true);
    setLookupError('');
    try {
      const result = await lookupVocab(vocabForm.word.trim(), book.language, book.title, vocabForm.sentence.trim() || undefined);
      const meaning = result.example
        ? `${result.meaning}\n예: ${result.example}`
        : result.meaning;
      setVocabForm(f => ({ ...f, meaning }));
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : '검색 실패');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleAddVocab = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vocabForm.word.trim() || !vocabForm.meaning.trim()) return;
    onAddVocab({ word: vocabForm.word.trim(), meaning: vocabForm.meaning.trim(), sentence: vocabForm.sentence.trim() || undefined, page: vocabForm.page ? Number(vocabForm.page) : undefined });
    setVocabForm({ word: '', meaning: '', sentence: '', page: '' });
    setLookupError('');
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteForm.content.trim()) return;
    onAddNote({ content: noteForm.content.trim(), page: noteForm.page ? Number(noteForm.page) : undefined });
    setNoteForm({ content: '', page: '' });
  };

  const coverColors = ['#8B5E3C', '#4A6741', '#3D5A80', '#7B4E7E', '#8B6914', '#2E6E8E'];
  const colorIdx = book.title.charCodeAt(0) % coverColors.length;

  return (
    <div className="book-detail">
      <button className="back-btn" onClick={onBack}>
        <ArrowLeft size={18} /> 목록으로
      </button>

      <div className="detail-hero">
        <div className="detail-cover-wrap">
          <div className="detail-cover" style={{ backgroundColor: book.cover ? undefined : coverColors[colorIdx] }}>
            {book.cover
              ? <img src={book.cover} alt={book.title} />
              : <BookOpen size={48} color="rgba(255,255,255,0.5)" />
            }
          </div>
          <button className="cover-edit-overlay" onClick={openCoverEdit} title="표지 변경">
            <Camera size={14} />
          </button>
        </div>
        <div className="detail-hero-info">
          <h1>{book.title}</h1>
          <p className="detail-author">{book.author}</p>
          {book.genre && <span className="book-genre">{book.genre}</span>}
          <StatusBadge status={book.status} />
          {book.rating && <StarRating value={book.rating} size={18} />}
          {progress !== null && (
            <div className="progress-wrap large">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <span className="progress-text">{progress}% ({book.currentPage}/{book.totalPages}p)</span>
            </div>
          )}
        </div>
      </div>

      {editingCover && (
        <div className="cover-edit-panel">
          <div className="cover-panel-header">
            <span className="cover-panel-title">표지 변경</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="btn-secondary cover-edit-btn" onClick={() => setManualCoverMode(m => !m)}>
                {manualCoverMode ? <><Search size={13} /> 검색 결과로</> : <><Edit2 size={13} /> 직접 입력</>}
              </button>
              {!manualCoverMode && (
                <button type="button" className="btn-secondary cover-edit-btn" onClick={() => { coverSearchedFor.current = ''; openCoverEdit(); }}>
                  <Search size={13} /> 다시 검색
                </button>
              )}
              <button type="button" className="btn-secondary cover-edit-btn" onClick={() => setEditingCover(false)}><X size={13} /></button>
              <button type="button" className="btn-primary cover-edit-btn" onClick={saveCover}><Check size={13} /> 저장</button>
            </div>
          </div>
          {coverSearching ? (
            <div className="cover-searching">
              <div className="cover-spinner" />
              <span>표지 검색 중...</span>
            </div>
          ) : manualCoverMode ? (
            <div className="cover-manual-area">
              <input
                className="cover-url-input"
                value={manualCoverUrl}
                onChange={e => setManualCoverUrl(e.target.value)}
                placeholder="https://... (이미지 URL)"
                autoFocus
              />
              {manualCoverUrl && (
                <img src={manualCoverUrl} alt="미리보기" className="cover-manual-preview" onError={e => (e.currentTarget.style.display = 'none')} />
              )}
            </div>
          ) : coverCandidates.length > 0 ? (
            <div className="cover-grid">
              {coverCandidates.map((b, i) => (
                <button
                  key={i}
                  type="button"
                  className={`cover-grid-item ${coverIdx === i ? 'selected' : ''}`}
                  onClick={() => setCoverIdx(i)}
                >
                  <img src={b.cover} alt={`표지 후보 ${i + 1}`} onError={e => (e.currentTarget.parentElement!.style.display = 'none')} />
                </button>
              ))}
            </div>
          ) : (
            <p className="cover-hint">검색 결과가 없습니다. 직접 입력을 시도해보세요.</p>
          )}
        </div>
      )}

      <div className="detail-tabs">
        <button className={`tab-btn ${tab === 'info' ? 'active' : ''}`} onClick={() => setTab('info')}>
          <BookMarked size={16} /> 정보 & 리뷰
        </button>
        <button className={`tab-btn ${tab === 'vocab' ? 'active' : ''}`} onClick={() => setTab('vocab')}>
          <BookOpen size={16} /> 단어장 <span className="tab-count">{book.vocab.length}</span>
        </button>
        <button className={`tab-btn ${tab === 'notes' ? 'active' : ''}`} onClick={() => setTab('notes')}>
          <StickyNote size={16} /> 메모 <span className="tab-count">{book.notes.length}</span>
        </button>
      </div>

      <div className="detail-content">
        {tab === 'info' && (
          <div className="info-tab">
            {/* 기본 정보 섹션 */}
            <div className="info-section">
              <div className="section-header">
                <h3>기본 정보</h3>
                {!editingMeta
                  ? <button className="icon-btn" onClick={() => setEditingMeta(true)}><Edit2 size={16} /></button>
                  : <div style={{ display: 'flex', gap: 8 }}>
                    <button className="icon-btn success" onClick={saveMeta}><Check size={16} /></button>
                    <button className="icon-btn" onClick={() => setEditingMeta(false)}><X size={16} /></button>
                  </div>
                }
              </div>
              {editingMeta ? (
                <div className="edit-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>제목</label>
                      <input value={metaForm.title} onChange={e => setMetaForm(f => ({ ...f, title: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label>저자</label>
                      <input value={metaForm.author} onChange={e => setMetaForm(f => ({ ...f, author: e.target.value }))} placeholder="저자명" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>출판사</label>
                      <input value={metaForm.publisher} onChange={e => setMetaForm(f => ({ ...f, publisher: e.target.value }))} placeholder="출판사" />
                    </div>
                    <div className="form-group">
                      <label>전체 페이지</label>
                      <input type="number" value={metaForm.totalPages} onChange={e => setMetaForm(f => ({ ...f, totalPages: e.target.value }))} placeholder="0" min="1" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>장르</label>
                      <select value={metaForm.genre} onChange={e => setMetaForm(f => ({ ...f, genre: e.target.value }))}>
                        <option value="">선택 안함</option>
                        {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={handleMetaAutoFill}
                        disabled={metaAutoFilling || !metaForm.title.trim()}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        {metaAutoFilling
                          ? <><Loader size={14} className="spin" /> 검색 중...</>
                          : <><Wand2 size={14} /> 자동완성</>}
                      </button>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>언어</label>
                      <div className="lang-selector">
                        {LANG_OPTIONS.map(o => (
                          <button key={o.value} type="button"
                            className={`lang-btn ${metaForm.language === o.value ? 'active' : ''}`}
                            onClick={() => setMetaForm(f => ({ ...f, language: o.value }))}
                          >{o.flag} {o.label}</button>
                        ))}
                      </div>
                    </div>
                    <div className="form-group">
                      <label>시작일</label>
                      <input type="date" value={metaForm.startDate} onChange={e => setMetaForm(f => ({ ...f, startDate: e.target.value }))} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="info-grid">
                  <div className="info-item"><span className="info-label">제목</span><span>{book.title}</span></div>
                  <div className="info-item"><span className="info-label">저자</span><span>{book.author || '—'}</span></div>
                  <div className="info-item"><span className="info-label">출판사</span><span>{book.publisher || '—'}</span></div>
                  <div className="info-item"><span className="info-label">장르</span><span>{book.genre || '—'}</span></div>
                  <div className="info-item"><span className="info-label">언어</span><span>{LANG_OPTIONS.find(o => o.value === book.language)?.label ?? '—'}</span></div>
                </div>
              )}
            </div>

            {/* 독서 정보 섹션 */}
            <div className="info-section">
              <div className="section-header">
                <h3>독서 정보</h3>
                {!editingInfo
                  ? <button className="icon-btn" onClick={() => setEditingInfo(true)}><Edit2 size={16} /></button>
                  : <div style={{ display: 'flex', gap: 8 }}>
                    <button className="icon-btn success" onClick={saveInfo}><Check size={16} /></button>
                    <button className="icon-btn" onClick={() => setEditingInfo(false)}><X size={16} /></button>
                  </div>
                }
              </div>

              {editingInfo ? (
                <div className="edit-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>상태</label>
                      <select value={infoForm.status} onChange={e => setInfoForm(f => ({ ...f, status: e.target.value as ReadingStatus }))}>
                        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>현재 페이지</label>
                      <input type="number" value={infoForm.currentPage}
                        onChange={e => setInfoForm(f => ({ ...f, currentPage: e.target.value }))}
                        placeholder="0" min="0" max={book.totalPages} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>완독일</label>
                      <input type="date" value={infoForm.finishDate}
                        onChange={e => setInfoForm(f => ({ ...f, finishDate: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>별점</label>
                    <StarRating value={infoForm.rating} onChange={v => setInfoForm(f => ({ ...f, rating: v }))} size={22} />
                  </div>
                  <div className="form-group">
                    <label>리뷰</label>
                    <textarea value={infoForm.review} onChange={e => setInfoForm(f => ({ ...f, review: e.target.value }))}
                      placeholder="이 책에 대한 생각을 남겨보세요..." rows={4} />
                  </div>
                </div>
              ) : (
                <div className="info-display">
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-label">시작일</span>
                      <span>{book.startDate ?? '—'}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">완독일</span>
                      <span>{book.finishDate ?? '—'}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">전체 페이지</span>
                      <span>{book.totalPages ?? '—'}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">현재 페이지</span>
                      <span>{book.currentPage ?? '—'}</span>
                    </div>
                  </div>
                  {book.review && (
                    <div className="review-box">
                      <span className="info-label">리뷰</span>
                      <p>{book.review}</p>
                    </div>
                  )}
                  {!book.review && <p className="empty-text">아직 리뷰가 없습니다.</p>}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'vocab' && (
          <div className="vocab-tab">
            <form onSubmit={handleAddVocab} className="add-form">
              <div className="vocab-input-row">
                <div className="vocab-word-row">
                  <input value={vocabForm.word} onChange={e => setVocabForm(f => ({ ...f, word: e.target.value }))}
                    placeholder="단어 / 표현" className="flex-1" required />
                  <button
                    type="button"
                    className={`btn-ai ${lookupLoading ? 'loading' : ''}`}
                    onClick={handleAutoLookup}
                    disabled={lookupLoading || !vocabForm.word.trim()}
                    title="Claude AI로 뜻 자동 검색"
                  >
                    {lookupLoading ? <Loader size={15} className="spin" /> : <Sparkles size={15} />}
                    {lookupLoading ? '검색 중...' : 'AI 검색'}
                  </button>
                </div>
                <textarea value={vocabForm.sentence} onChange={e => setVocabForm(f => ({ ...f, sentence: e.target.value }))}
                  placeholder="단어가 사용된 문장 (선택) — AI 검색 시 문맥으로 활용됩니다" className="flex-1" rows={2} />
                <div className="vocab-meaning-row">
                  <textarea value={vocabForm.meaning} onChange={e => setVocabForm(f => ({ ...f, meaning: e.target.value }))}
                    placeholder="의미 (AI 검색 또는 직접 입력)" className="flex-1" rows={2} required />
                  <div className="vocab-side">
                    <input type="number" value={vocabForm.page} onChange={e => setVocabForm(f => ({ ...f, page: e.target.value }))}
                      placeholder="p." className="page-input" min="1" />
                    <button type="submit" className="btn-primary small"><Plus size={16} /></button>
                  </div>
                </div>
                {lookupError && <p className="lookup-error">{lookupError}</p>}
              </div>
            </form>

            {book.vocab.length === 0
              ? <p className="empty-text">아직 단어가 없습니다. 위에서 추가해보세요!</p>
              : <div className="vocab-list">
                {book.vocab.map(v => (
                  <div key={v.id} className="vocab-item">
                    <div className="vocab-item-top">
                      <span className="vocab-word">{v.word}</span>
                      <div className="vocab-meta">
                        {v.page && <span className="page-tag">p.{v.page}</span>}
                        <button className="icon-btn danger" onClick={() => onDeleteVocab(v.id)}><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <p className="vocab-meaning">{v.meaning}</p>
                    {v.sentence && <p className="vocab-sentence">"{v.sentence}"</p>}
                  </div>
                ))}
              </div>
            }
          </div>
        )}

        {tab === 'notes' && (
          <div className="notes-tab">
            <form onSubmit={handleAddNote} className="add-form">
              <div className="note-input-row">
                <textarea value={noteForm.content} onChange={e => setNoteForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="메모를 입력하세요..." rows={2} required />
                <div className="note-actions">
                  <input type="number" value={noteForm.page} onChange={e => setNoteForm(f => ({ ...f, page: e.target.value }))}
                    placeholder="p." className="page-input" min="1" />
                  <button type="submit" className="btn-primary small"><Plus size={16} /></button>
                </div>
              </div>
            </form>

            {book.notes.length === 0
              ? <p className="empty-text">아직 메모가 없습니다. 위에서 추가해보세요!</p>
              : <div className="notes-list">
                {book.notes.map(n => (
                  <div key={n.id} className="note-item">
                    <p>{n.content}</p>
                    <div className="note-footer">
                      <span className="note-date">{n.createdAt}</span>
                      {n.page && <span className="page-tag">p.{n.page}</span>}
                      <button className="icon-btn danger" onClick={() => onDeleteNote(n.id)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
        )}
      </div>
    </div>
  );
}
