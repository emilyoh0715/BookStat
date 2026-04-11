import { useState, useRef } from 'react';
import type { Book, ReadingStatus, BookLanguage } from '../types';
import { GENRES } from '../lib/genres';
import StarRating from './StarRating';
import { X, Search, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';

interface Props {
  onAdd: (book: Omit<Book, 'id' | 'userId' | 'createdAt' | 'vocab' | 'notes'>) => void;
  onClose: () => void;
}

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

async function fetchCoverCandidates(title: string, author: string): Promise<string[]> {
  try {
    const params = new URLSearchParams({ title, author });
    const res = await fetch(`/api/book-covers?${params}`);
    const data = await res.json() as { covers?: string[] };
    return data.covers ?? [];
  } catch {
    return [];
  }
}

export default function AddBookModal({ onAdd, onClose }: Props) {
  const [form, setForm] = useState({
    title: '',
    author: '',
    genre: '',
    language: 'korean' as BookLanguage,
    totalPages: '',
    currentPage: '',
    status: 'want-to-read' as ReadingStatus,
    rating: 0,
    review: '',
    startDate: '',
    finishDate: '',
  });

  const [coverCandidates, setCoverCandidates] = useState<string[]>([]);
  const [coverIdx, setCoverIdx] = useState(0);
  const [coverSearching, setCoverSearching] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const searchedFor = useRef('');

  const set = (key: string, value: unknown) => setForm(f => ({ ...f, [key]: value }));

  const currentCover = manualMode ? manualUrl : coverCandidates[coverIdx] ?? '';

  const triggerSearch = async (title: string, author: string) => {
    const key = `${title.trim()}|${author.trim()}`;
    if (!title.trim() || !author.trim()) return;
    if (searchedFor.current === key) return;
    searchedFor.current = key;
    setCoverSearching(true);
    setManualMode(false);
    const candidates = await fetchCoverCandidates(title.trim(), author.trim());
    setCoverCandidates(candidates);
    setCoverIdx(0);
    setCoverSearching(false);
  };

  const handleBlur = () => {
    triggerSearch(form.title, form.author);
  };

  const handleSubmit = (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!form.title.trim() || !form.author.trim()) return;
    onAdd({
      title: form.title.trim(),
      author: form.author.trim(),
      genre: form.genre || undefined,
      language: form.language,
      totalPages: form.totalPages ? Number(form.totalPages) : undefined,
      currentPage: form.currentPage ? Number(form.currentPage) : undefined,
      status: form.status,
      rating: form.rating || undefined,
      review: form.review || undefined,
      startDate: form.startDate || undefined,
      finishDate: form.finishDate || undefined,
      cover: currentCover || undefined,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>책 추가</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label>제목 *</label>
              <input
                value={form.title}
                onChange={e => set('title', e.target.value)}
                onBlur={handleBlur}
                placeholder="책 제목"
                required
              />
            </div>
            <div className="form-group">
              <label>저자 *</label>
              <input
                value={form.author}
                onChange={e => set('author', e.target.value)}
                onBlur={handleBlur}
                placeholder="저자명"
                required
              />
            </div>
          </div>

          {/* 표지 섹션 */}
          <div className="form-group">
            <label>표지</label>
            <div className="cover-search-area">
              {coverSearching ? (
                <div className="cover-searching">
                  <div className="cover-spinner" />
                  <span>표지 검색 중...</span>
                </div>
              ) : currentCover ? (
                <div className="cover-preview-row">
                  <div className="cover-preview-img">
                    <img src={currentCover} alt="표지 미리보기" onError={() => {
                      if (!manualMode) setCoverIdx(i => i + 1);
                    }} />
                  </div>
                  <div className="cover-preview-controls">
                    {!manualMode && coverCandidates.length > 1 && (
                      <div className="cover-nav">
                        <button type="button" className="icon-btn" onClick={() => setCoverIdx(i => Math.max(0, i - 1))} disabled={coverIdx === 0}>
                          <ChevronLeft size={16} />
                        </button>
                        <span className="cover-nav-label">{coverIdx + 1} / {coverCandidates.length}</span>
                        <button type="button" className="icon-btn" onClick={() => setCoverIdx(i => Math.min(coverCandidates.length - 1, i + 1))} disabled={coverIdx === coverCandidates.length - 1}>
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    )}
                    <button type="button" className="btn-secondary cover-edit-btn" onClick={() => { setManualMode(m => !m); setManualUrl(currentCover); }}>
                      <Edit2 size={14} /> {manualMode ? '검색 결과로' : '직접 수정'}
                    </button>
                    {form.title && form.author && !manualMode && (
                      <button type="button" className="btn-secondary cover-edit-btn" onClick={() => { searchedFor.current = ''; triggerSearch(form.title, form.author); }}>
                        <Search size={14} /> 다시 검색
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="cover-empty">
                  {form.title && form.author ? (
                    <button type="button" className="btn-secondary" onClick={() => { searchedFor.current = ''; triggerSearch(form.title, form.author); }}>
                      <Search size={14} /> 표지 검색
                    </button>
                  ) : (
                    <span className="cover-hint">제목과 저자를 입력하면 자동으로 표지를 찾아드려요</span>
                  )}
                  <button type="button" className="btn-secondary cover-edit-btn" onClick={() => setManualMode(true)}>
                    <Edit2 size={14} /> 직접 입력
                  </button>
                </div>
              )}
              {manualMode && (
                <input
                  className="cover-url-input"
                  value={manualUrl}
                  onChange={e => setManualUrl(e.target.value)}
                  placeholder="https://... (이미지 URL)"
                  autoFocus
                />
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>언어</label>
              <div className="lang-selector">
                {LANG_OPTIONS.map(o => (
                  <button
                    key={o.value}
                    type="button"
                    className={`lang-btn ${form.language === o.value ? 'active' : ''}`}
                    onClick={() => set('language', o.value)}
                  >
                    {o.flag} {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>장르</label>
              <select value={form.genre} onChange={e => set('genre', e.target.value)}>
                <option value="">선택 안함</option>
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>상태</label>
              <select value={form.status} onChange={e => set('status', e.target.value as ReadingStatus)}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>전체 페이지</label>
              <input type="number" value={form.totalPages} onChange={e => set('totalPages', e.target.value)} placeholder="0" min="1" />
            </div>
            <div className="form-group">
              <label>현재 페이지</label>
              <input type="number" value={form.currentPage} onChange={e => set('currentPage', e.target.value)} placeholder="0" min="0" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>시작일</label>
              <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>
            <div className="form-group">
              <label>완독일</label>
              <input type="date" value={form.finishDate} onChange={e => set('finishDate', e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label>별점</label>
            <StarRating value={form.rating} onChange={v => set('rating', v)} size={22} />
          </div>

          <div className="form-group">
            <label>리뷰</label>
            <textarea value={form.review} onChange={e => set('review', e.target.value)} placeholder="이 책에 대한 생각을 남겨보세요..." rows={3} />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>취소</button>
            <button type="submit" className="btn-primary">추가하기</button>
          </div>
        </form>
      </div>
    </div>
  );
}
