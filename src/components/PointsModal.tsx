import { X, Award, BookPlus, Star } from 'lucide-react';
import type { Book } from '../types';
import type { PointLog } from '../services/points';

interface Props {
  total: number;
  logs: PointLog[];
  books: Book[];
  onClose: () => void;
}

const REASON_META: Record<string, { label: string; icon: React.ReactNode; pts: string }> = {
  book_added: { label: '책 추가', icon: <BookPlus size={14} />, pts: '+1' },
  review_approved: { label: '후기 승인', icon: <Star size={14} />, pts: '+5' },
};

export default function PointsModal({ total, logs, books, onClose }: Props) {
  const getBook = (bookId: string) => books.find(b => b.id === bookId);

  const addedCount = logs.filter(l => l.reason === 'book_added').length;
  const reviewCount = logs.filter(l => l.reason === 'review_approved').length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>나의 포인트</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-form">

          {/* Hero */}
          <div className="points-hero">
            <Award size={44} className="points-hero-icon" />
            <div className="points-total">{total}</div>
            <div className="points-label">총 포인트</div>
          </div>

          {/* Breakdown */}
          <div className="points-breakdown">
            <div className="points-breakdown-item">
              <span><BookPlus size={13} style={{ display: 'inline', marginRight: 4 }} />책 추가 (+1점)</span>
              <span className="points-breakdown-count">{addedCount}회 · {addedCount}점</span>
            </div>
            <div className="points-breakdown-item">
              <span><Star size={13} style={{ display: 'inline', marginRight: 4 }} />후기 승인 (+5점)</span>
              <span className="points-breakdown-count">{reviewCount}회 · {reviewCount * 5}점</span>
            </div>
          </div>

          {/* Log list */}
          {logs.length > 0 ? (
            <>
              <h3 className="points-log-heading">획득 내역</h3>
              <div className="points-log-list">
                {logs.map(log => {
                  const book = getBook(log.book_id);
                  const meta = REASON_META[log.reason] ?? { label: log.reason, icon: null, pts: `+${log.points}` };
                  return (
                    <div key={log.id} className="points-log-item">
                      <div className="points-log-icon">{meta.icon}</div>
                      <div className="points-log-info">
                        <span className="points-log-reason">{meta.label}</span>
                        {book && <span className="points-log-book">{book.title}</span>}
                      </div>
                      <div className="points-log-right">
                        <span className="points-log-pts">{meta.pts}</span>
                        <span className="points-log-date">{log.created_at.split('T')[0]}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="points-empty">
              아직 포인트가 없어요.<br />
              책을 추가하거나 완독 후기를 작성해보세요!
            </p>
          )}

          <div className="modal-footer" style={{ marginTop: 8 }}>
            <button type="button" className="btn-secondary" onClick={onClose}>닫기</button>
          </div>
        </div>
      </div>
    </div>
  );
}
