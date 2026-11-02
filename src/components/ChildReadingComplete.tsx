import type { ReviewCompletion } from '../services/completeReview';
import { useEffect, useRef, useState } from 'react';
import type { Book } from '../types';
import { generateChildReview } from '../services/geminiAi';

const EMOTIONS = [
  { key: 'fun',       emoji: '😄', label: '재밌었어!' },
  { key: 'moving',    emoji: '❤️', label: '감동받았어' },
  { key: 'surprised', emoji: '😮', label: '놀라웠어' },
  { key: 'sad',       emoji: '😢', label: '슬펐어' },
  { key: 'hard',      emoji: '🤔', label: '어려웠어' },
  { key: 'boring',    emoji: '😴', label: '지루했어' },
];

const CHILD_QUESTION_POOL = [
  '이 책에서 가장 기억에 남는 장면은 뭐야?',
  '이 책에서 가장 마음에 든 캐릭터는 누구야? 왜 좋았어?',
  '내가 주인공이었다면 어떻게 했을까?',
  '이 책을 친구한테 추천할 거야? 이유가 뭐야?',
  '주인공에게 하고 싶은 말이 있어?',
  '이 책을 읽고 새로 알게 된 것이 있어?',
  '이 책에 새 제목을 붙인다면 뭐라고 할 거야?',
  '이 책을 읽고 나서 하고 싶어진 것이 생겼어?',
];

const ADULT_QUESTION_POOL = [
  '이 책에서 가장 인상적인 장면이나 구절은 무엇이었나요?',
  '주인공 또는 주요 인물에 대해 어떻게 생각하셨나요?',
  '이 책을 읽고 새롭게 알게 되거나 생각이 바뀐 것이 있나요?',
  '이 책이 삶이나 관점에 어떤 영향을 주었나요?',
  '이 책을 다른 분께 추천한다면 어떤 분께 추천하시겠어요?',
  '저자가 가장 말하고 싶었던 것은 무엇이라고 생각하시나요?',
  '이 책에서 가장 공감이 갔던 부분은 무엇인가요?',
  '이 책을 읽으며 특별히 기억에 남는 것이 있다면요?',
];

const MIN_MEANINGFUL_ANSWER_LENGTH = 15;

type Step = 'books' | 'rate' | 'emotion' | 'q1' | 'review' | 'done';

interface Props {
  books: Book[];
  isChild: boolean;
  onComplete: (bookId: string, updates: {
    rating: number;
    childEmotion: string;
    childAnswers: { question: string; answer: string }[];
    review: string;
  }) => Promise<ReviewCompletion>;
  onClose: () => void;
}

export default function ChildReadingComplete({ books, isChild, onComplete, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => previous?.focus();
  }, []);
  const startStep: Step = books.length === 1 ? 'rate' : 'books';
  const startBook = books.length === 1 ? books[0] : null;

  const [step, setStep] = useState<Step>(startStep);
  const [selectedBook, setSelectedBook] = useState<Book | null>(startBook);
  const [rating, setRating] = useState(startBook?.rating ?? 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [emotion, setEmotion] = useState('');
  const [answer1, setAnswer1] = useState('');
  const [answer2, setAnswer2] = useState('');
  const [editedReview, setEditedReview] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [completion, setCompletion] = useState<ReviewCompletion | null>(null);

  const isReviewOnly = selectedBook?.status === 'finished';
  const hasMeaningfulAnswer =
    answer1.trim().length >= MIN_MEANINGFUL_ANSWER_LENGTH ||
    answer2.trim().length >= MIN_MEANINGFUL_ANSWER_LENGTH;

  const [[q1, q2]] = useState(() => {
    const pool = isChild ? CHILD_QUESTION_POOL : ADULT_QUESTION_POOL;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return [shuffled[0], shuffled[1]];
  });

  const handleSelectBook = (book: Book) => {
    setSelectedBook(book);
    setRating(book.rating ?? 0);
    setStep('rate');
  };

  const handleGenerateReview = async () => {
    if (!selectedBook || generating) return;
    setGenerating(true);
    setError('');
    try {
      const review = await generateChildReview(
        selectedBook.title, rating, emotion,
        [{ question: q1, answer: answer1 }, { question: q2, answer: answer2 }], isChild,
      );
      setEditedReview(review);
      setStep('review');
    } catch (error) {
      setError(error instanceof Error ? error.message : '감상문을 만들지 못했어요. 다시 시도해주세요.');
    } finally {
      setGenerating(false);
    }
  };

  const handleComplete = async () => {
    if (!selectedBook || saving) return;
    setSaving(true);
    setError('');
    try {
      const result = await onComplete(selectedBook.id, {
        rating, childEmotion: emotion,
        childAnswers: [{ question: q1, answer: answer1 }, { question: q2, answer: answer2 }],
        review: editedReview,
      });
      setCompletion(result);
      setStep('done');
    } catch (error) {
      setError(error instanceof Error ? error.message : '저장하지 못했어요. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const requestClose = () => {
    if (saving || generating) return;
    if (step !== 'done' && (answer1.trim() || answer2.trim() || editedReview.trim())
      && !window.confirm('작성 중인 내용이 있어요. 닫을까요?')) return;
    onClose();
  };

  return (
    <div className="modal-overlay modal-overlay--center" onClick={requestClose}>
      <div className={`modal child-complete-modal review-dialog ${(step === 'q1' || step === 'review') ? 'review-dialog--editor' : ''}`} onClick={e => e.stopPropagation()}
        ref={dialogRef} role="dialog" aria-modal="true" aria-label="감상문 작성" tabIndex={-1}
        onKeyDown={e => {
          if (e.key === 'Escape') requestClose();
          if (e.key === 'Tab') {
            const items = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), select:not(:disabled), [href]');
            if (!items?.length) { e.preventDefault(); return; }
            const first = items[0], last = items[items.length - 1];
            if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { e.preventDefault(); first.focus(); }
          }
        }}>
        <header className="review-dialog-header"><span>감상문 쓰기</span><button className="icon-btn" onClick={requestClose} disabled={saving || generating} aria-label="감상문 닫기">✕</button></header>
        {step !== 'done' && <ol className="review-steps" aria-label="작성 단계">{['책과 느낌', '답변과 초안', '검증 후 저장'].map((label, index) => <li key={label} aria-current={index === (saving ? 2 : step === 'q1' || step === 'review' ? 1 : 0) ? 'step' : undefined}>{index + 1}. {label}</li>)}</ol>}

        {error && <div role="alert" className="review-feedback review-feedback--error"><strong>작업을 마치지 못했어요</strong><p>{error}</p><p>작성한 내용은 그대로 있어요. 내용을 확인하고 다시 시도해주세요.</p></div>}
        {/* Step: 책 선택 */}
        {step === 'books' && (
          <div className="child-step">
            <div className="child-step-title">📚 어떤 책에 대해 쓸 거야?</div>
            <div className="child-book-list">
              {books.map(book => (
                <button
                  key={book.id}
                  className="child-book-item"
                  onClick={() => handleSelectBook(book)}
                >
                  {book.cover
                    ? <img src={book.cover} alt={book.title} className="child-book-cover" />
                    : <div className="child-book-cover child-book-cover--empty">📖</div>
                  }
                  <div className="child-book-item-info">
                    <span className="child-book-title">{book.title}</span>
                    {book.status === 'finished' && (
                      <span className="child-book-badge">후기 없음</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <button className="btn-secondary" style={{ width: '100%', marginTop: 8 }} onClick={requestClose}>취소</button>
          </div>
        )}

        {/* Step: 별점 */}
        {step === 'rate' && selectedBook && (
          <div className="child-step">
            <div className="child-step-emoji">{isReviewOnly ? '✏️' : '🎉'}</div>
            <div className="child-step-title">
              {isReviewOnly
                ? (isChild ? '후기를 써보자!' : '후기를 작성해볼까요?')
                : (isChild ? '다 읽었어!' : '완독을 축하해요!')}
            </div>
            <div className="child-book-name">『{selectedBook.title}』</div>
            <div className="child-step-sub">이 책 몇 점짜리야?</div>
            <div className="child-stars">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  className={`child-star ${n <= (hoverRating || rating) ? 'active' : ''}`}
                  aria-label={`${n}점`} aria-pressed={rating === n}
                  onMouseEnter={() => setHoverRating(n)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(n)}
                >★</button>
              ))}
            </div>
            <button
              className="btn-primary child-next-btn"
              disabled={rating === 0}
              onClick={() => setStep('emotion')}
            >다음 →</button>
          </div>
        )}

        {/* Step: 감정 선택 */}
        {step === 'emotion' && (
          <div className="child-step">
            <div className="child-step-emoji">💭</div>
            <div className="child-step-title">{isChild ? '이 책 어땠어?' : '이 책 어떠셨나요?'}</div>
            <div className="child-emotions">
              {EMOTIONS.map(e => (
                <button
                  key={e.key}
                  className={`child-emotion-btn ${emotion === e.key ? 'selected' : ''}`} aria-pressed={emotion === e.key}
                  onClick={() => setEmotion(e.key)}
                >
                  <span className="child-emotion-emoji">{e.emoji}</span>
                  <span className="child-emotion-label">{e.label}</span>
                </button>
              ))}
            </div>
            <button
              className="btn-primary child-next-btn"
              disabled={!emotion}
              onClick={() => setStep('q1')}
            >다음 →</button>
          </div>
        )}

        {(step === 'q1' || step === 'review') && <div className="review-workspace" aria-busy={saving || generating}>
          <div className="review-workspace-heading"><h2>{selectedBook?.title}</h2><p>기억에 남는 책 내용과 내 생각을 함께 담아주세요.</p></div>
          <div className="review-editor-grid">
            <section className="review-answers"><h3>1. 내 생각 남기기</h3>
              {[{ question: q1, value: answer1, update: setAnswer1 }, { question: q2, value: answer2, update: setAnswer2 }].map((item, index) => <label key={item.question} className="review-field"><span>{item.question}</span><textarea className="child-answer-input" value={item.value} disabled={saving || generating} onChange={e => item.update(e.target.value)} rows={4} placeholder={index === 0 ? '기억나는 장면이나 구체적인 내용을 써주세요.' : '왜 그렇게 느꼈는지 내 생각을 써주세요.'} /></label>)}
              <p className="review-hint">두 질문 중 하나에는 {MIN_MEANINGFUL_ANSWER_LENGTH}자 이상 답해주세요. 답변을 바꿨다면 초안도 확인해주세요.</p>
              <button className="btn-secondary" disabled={generating || saving || !hasMeaningfulAnswer} onClick={() => {
                if (editedReview.trim() && !window.confirm('현재 초안을 새로 만든 내용으로 바꿀까요?')) return;
                void handleGenerateReview();
              }}>{generating ? '초안을 만들고 있어요…' : editedReview ? '답변으로 초안 다시 만들기' : '답변으로 초안 만들기'}</button>
            </section>
            <section className="review-draft"><h3>2. 감상문 확인하기</h3><p className="review-hint">초안을 만든 뒤 고치거나 직접 작성해도 좋아요.</p>
              <label className="review-field"><span className="sr-only">감상문 내용</span><textarea className="child-answer-input child-review-textarea" disabled={saving || generating} value={editedReview} onChange={e => { setEditedReview(e.target.value); setStep('review'); }} rows={12} placeholder="나의 답변을 바탕으로 감상문을 만들어보세요. 직접 작성할 수도 있어요." /></label>
              <p className="review-hint">{editedReview.trim().length}자 / 최소 30자</p>
              <div className="review-feedback" role="status">{saving ? '내용을 검증하고 있어요. 통과한 감상문만 저장해요.' : '아직 저장되지 않은 초안이에요. 검증과 저장이 끝나면 포인트 결과를 알려드려요.'}</div>
            </section>
          </div>
          <footer className="review-editor-footer"><button className="btn-secondary" disabled={saving || generating} onClick={() => setStep('emotion')}>느낌 수정</button><button className="btn-primary" disabled={saving || generating || !hasMeaningfulAnswer || editedReview.trim().length < 30} onClick={handleComplete}>{saving ? '검증 후 저장 중…' : '검증하고 저장하기'}</button></footer>
        </div>}

        {/* Step: 완료 */}
        {step === 'done' && (
          <div className="child-step child-step--done">
            <div className="child-done-trophy">{isReviewOnly ? '⭐' : '🏆'}</div>
            <div className="child-step-title">{completion?.newlyFinished ? '감상문 승인 · 완독 완료!' : '감상문 승인 · 저장 완료!'}</div>
            <div className="child-step-sub">
              {completion?.pointsPending
                ? '감상문은 승인되어 저장됐어요. 일부 포인트는 적립을 확인하지 못했어요. 포인트 내역에서 다시 확인해주세요.'
                : completion && completion.pointsAwarded > 0
                  ? `${completion.pointsAwarded}포인트를 적립했어요.`
                  : '감상문을 저장했어요. 새로 적립된 포인트는 없어요.'}
            </div>
            <button className="btn-primary child-next-btn" onClick={requestClose}>닫기</button>
          </div>
        )}
      </div>
    </div>
  );
}
