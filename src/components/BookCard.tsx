import type { Book } from '../types';
import StatusBadge from './StatusBadge';
import StarRating from './StarRating';
import { BookOpen, Trash2, AlertCircle } from 'lucide-react';

interface Props {
  book: Book;
  number?: number;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  reviewPending?: boolean;
  readOnly?: boolean;
}

export default function BookCard({ book, number, onClick, onDelete, reviewPending, readOnly }: Props) {
  const progress = book.totalPages && book.currentPage
    ? Math.round((book.currentPage / book.totalPages) * 100)
    : null;

  const coverColors = ['#152238', '#1a3a5c', '#2a5a8c', '#1e4d6e', '#163a52', '#0d2b45'];
  const colorIdx = book.title.charCodeAt(0) % coverColors.length;

  return (
    <div className="book-card" onClick={onClick}>
      {number !== undefined && <span className="book-number">{number}</span>}
      <div className="book-cover" style={{ backgroundColor: book.cover ? undefined : coverColors[colorIdx] }}>
        {book.cover
          ? <img src={book.cover} alt={book.title} />
          : <BookOpen size={32} color="rgba(255,255,255,0.6)" />
        }
        {reviewPending && (
          <div className="review-pending-cover-icon" title="후기 미승인 — 후기를 다시 저장하면 AI 검증을 재시도합니다">
            <AlertCircle size={14} />
          </div>
        )}
      </div>
      <div className="book-info">
        <div className="book-header">
          <div>
            <h3 className="book-title">{book.title}</h3>
            <p className="book-author">{book.author}</p>
          </div>
          {!readOnly && (
            <button className="delete-btn" onClick={onDelete} title="삭제">
              <Trash2 size={15} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <StatusBadge status={book.status} />
          {book.language === 'korean' && <span className="lang-badge">🇰🇷 한국어</span>}
          {book.language === 'english' && <span className="lang-badge">🇺🇸 영어</span>}
          {book.language === 'other' && <span className="lang-badge">🌐 기타</span>}
        </div>

        {book.genre && <span className="book-genre">{book.genre}</span>}

        {book.rating ? (
          <div className="book-rating">
            <StarRating value={book.rating} size={14} />
          </div>
        ) : null}

        {progress !== null && book.status === 'reading' && (
          <div className="progress-wrap">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="progress-text">{progress}% ({book.currentPage}/{book.totalPages}p)</span>
          </div>
        )}

        <div className="book-meta">
          {book.vocab.length > 0 && <span>단어 {book.vocab.length}</span>}
          {book.notes.length > 0 && <span>메모 {book.notes.length}</span>}
        </div>
      </div>
    </div>
  );
}
