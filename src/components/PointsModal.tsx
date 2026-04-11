import { useState } from 'react';
import { X, Award, BookPlus, Star, Sparkles, CheckCircle, XCircle, Loader } from 'lucide-react';
import type { Book } from '../types';
import type { PointLog } from '../services/points';
import { awardPoints } from '../services/points';
import { validateReview, getApiKey } from '../services/claudeVocab';

interface Props {
  total: number;
  logs: PointLog[];
  books: Book[];
  userId: string;
  onClose: () => void;
}

interface ValidationResult {
  bookId: string;
  title: string;
  valid: boolean;
  reason?: string;
  alreadyHadPoints: boolean;
}

const REASON_META: Record<string, { label: string; icon: React.ReactNode; pts: string }> = {
  book_added:      { label: '책 추가',  icon: <BookPlus size={14} />, pts: '+1' },
  review_approved: { label: '후기 승인', icon: <Star size={14} />,    pts: '+5' },
};

export default function PointsModal({ total, logs, books, userId, onClose }: Props) {
  const getBook = (bookId: string) => books.find(b => b.id === bookId);

  const addedCount  = logs.filter(l => l.reason === 'book_added').length;
  const reviewCount = logs.filter(l => l.reason === 'review_approved').length;

  // 기존 후기 AI 검증
  const [validating, setValidating]         = useState(false);
  const [currentBook, setCurrentBook]       = useState('');
  const [progress, setProgress]             = useState({ done: 0, total: 0 });
  const [results, setResults]               = useState<ValidationResult[] | null>(null);
  const [noApiKey, setNoApiKey]             = useState(false);

  const approvedBookIds = new Set(
    logs.filter(l => l.reason === 'review_approved').map(l => l.book_id)
  );

  const reviewBooks = books.filter(
    b => b.userId === userId && b.status === 'finished' && b.review && b.review.trim().length >= 30
  );

  const handleBulkValidate = async () => {
    if (!getApiKey()) { setNoApiKey(true); return; }
    setNoApiKey(false);
    setValidating(true);
    setResults(null);
    setProgress({ done: 0, total: reviewBooks.length });

    const out: ValidationResult[] = [];
    for (const book of reviewBooks) {
      setCurrentBook(book.title);
      const result = await validateReview(book.review!, book.title);
      const alreadyHad = approvedBookIds.has(book.id);
      if (result.valid && !alreadyHad) {
        await awardPoints(book.id, 'review_approved', 5).catch(console.error);
      }
      out.push({ bookId: book.id, title: book.title, valid: result.valid, reason: result.reason, alreadyHadPoints: alreadyHad });
      setProgress(p => ({ ...p, done: p.done + 1 }));
    }

    setCurrentBook('');
    setValidating(false);
    setResults(out);
  };

  const passed  = results?.filter(r => r.valid)  ?? [];
  const failed  = results?.filter(r => !r.valid) ?? [];
  const newPts  = passed.filter(r => !r.alreadyHadPoints).length * 5;

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

          {/* 기존 후기 AI 검증 */}
          {reviewBooks.length > 0 && (
            <div className="points-validate-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  기존 후기 AI 검증
                </span>
                <button
                  className="btn-secondary"
                  style={{ fontSize: 12, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5 }}
                  onClick={handleBulkValidate}
                  disabled={validating}
                >
                  {validating
                    ? <><Loader size={13} className="spin" /> 검증 중...</>
                    : <><Sparkles size={13} /> 검증 시작</>}
                </button>
              </div>

              {noApiKey && (
                <p style={{ fontSize: 12, color: 'var(--danger)', margin: 0 }}>
                  설정에서 Claude API 키를 먼저 입력해주세요.
                </p>
              )}

              {/* 진행 상태 */}
              {validating && (
                <div className="points-validate-progress">
                  <div className="points-validate-bar-track">
                    <div
                      className="points-validate-bar-fill"
                      style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    {progress.done}/{progress.total} — {currentBook}
                  </span>
                </div>
              )}

              {/* 결과 */}
              {results && (
                <div className="points-validate-results">
                  {newPts > 0 && (
                    <p style={{ fontSize: 13, color: '#2ecc71', fontWeight: 600, margin: '0 0 8px' }}>
                      +{newPts}점 추가로 획득했어요!
                    </p>
                  )}
                  {results.map(r => (
                    <div key={r.bookId} className="points-validate-row">
                      {r.valid
                        ? <CheckCircle size={14} style={{ color: '#2ecc71', flexShrink: 0 }} />
                        : <XCircle    size={14} style={{ color: 'var(--danger)', flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span className="points-log-book">{r.title}</span>
                        {!r.valid && r.reason && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>{r.reason}</span>
                        )}
                        {r.valid && r.alreadyHadPoints && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>이미 포인트 획득</span>
                        )}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: r.valid ? '#f5a623' : 'var(--text-muted)', flexShrink: 0 }}>
                        {r.valid ? (r.alreadyHadPoints ? '✓' : '+5') : '—'}
                      </span>
                    </div>
                  ))}
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 0', textAlign: 'center' }}>
                    통과 {passed.length} / 탈락 {failed.length}
                  </p>
                </div>
              )}
            </div>
          )}

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
