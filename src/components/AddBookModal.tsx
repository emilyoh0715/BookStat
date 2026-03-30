import { useState } from 'react';
import type { Book, ReadingStatus, BookLanguage } from '../types';
import StarRating from './StarRating';
import { X } from 'lucide-react';

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
    cover: '',
  });

  const set = (key: string, value: unknown) => setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
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
      cover: form.cover || undefined,
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
              <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="책 제목" required />
            </div>
            <div className="form-group">
              <label>저자 *</label>
              <input value={form.author} onChange={e => set('author', e.target.value)} placeholder="저자명" required />
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
              <input value={form.genre} onChange={e => set('genre', e.target.value)} placeholder="소설, 에세이, 자기계발..." />
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
            <label>커버 이미지 URL</label>
            <input value={form.cover} onChange={e => set('cover', e.target.value)} placeholder="https://..." />
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
