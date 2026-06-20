import { useState, useMemo } from 'react';
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

type Step = 'books' | 'rate' | 'emotion' | 'q1' | 'q2' | 'review' | 'done';

interface Props {
  books: Book[];
  isChild: boolean;
  onComplete: (bookId: string, updates: {
    rating: number;
    childEmotion: string;
    childAnswers: { question: string; answer: string }[];
    review: string;
  }) => Promise<void>;
  onClose: () => void;
}

export default function ChildReadingComplete({ books, isChild, onComplete, onClose }: Props) {
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

  const isReviewOnly = selectedBook?.status === 'finished';
  const hasMeaningfulAnswer =
    answer1.trim().length >= MIN_MEANINGFUL_ANSWER_LENGTH ||
    answer2.trim().length >= MIN_MEANINGFUL_ANSWER_LENGTH;

  const [q1, q2] = useMemo(() => {
    const pool = isChild ? CHILD_QUESTION_POOL : ADULT_QUESTION_POOL;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return [shuffled[0], shuffled[1]];
  }, [isChild]);

  const handleSelectBook = (book: Book) => {
    setSelectedBook(book);
    setRating(book.rating ?? 0);
    setStep('rate');
  };

  const handleGenerateReview = async () => {
    if (!selectedBook || generating) return;
    setGenerating(true);
    const review = await generateChildReview(
      selectedBook.title,
      rating,
      emotion,
      [{ question: q1, answer: answer1 }, { question: q2, answer: answer2 }],
      isChild,
    );
    setEditedReview(review);
    setGenerating(false);
    setStep('review');
  };

  const handleComplete = async () => {
    if (!selectedBook || saving) return;
    setSaving(true);
    await onComplete(selectedBook.id, {
      rating,
      childEmotion: emotion,
      childAnswers: [
        { question: q1, answer: answer1 },
        { question: q2, answer: answer2 },
      ],
      review: editedReview,
    });
    setSaving(false);
    setStep('done');
  };

  return (
    <div className="modal-overlay modal-overlay--center" onClick={onClose}>
      <div className="modal child-complete-modal" onClick={e => e.stopPropagation()}>

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
            <button className="btn-secondary" style={{ width: '100%', marginTop: 8 }} onClick={onClose}>취소</button>
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
                  className={`child-emotion-btn ${emotion === e.key ? 'selected' : ''}`}
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

        {/* Step: 질문 1 */}
        {step === 'q1' && (
          <div className="child-step">
            <div className="child-step-emoji">✏️</div>
            <div className="child-step-title">{q1}</div>
            <textarea
              className="child-answer-input"
              placeholder={isChild ? '기억나는 장면이나 이유를 한 문장 이상 써봐.' : '기억나는 장면이나 이유를 한 문장 이상 작성해주세요.'}
              value={answer1}
              onChange={e => setAnswer1(e.target.value)}
              rows={4}
            />
            <button
              className="btn-primary child-next-btn"
              onClick={() => setStep('q2')}
            >{answer1.trim() ? '다음 →' : '건너뛰기 →'}</button>
          </div>
        )}

        {/* Step: 질문 2 */}
        {step === 'q2' && (
          <div className="child-step">
            <div className="child-step-emoji">🌟</div>
            <div className="child-step-title">{q2}</div>
            <textarea
              className="child-answer-input"
              placeholder={isChild ? '책 내용과 내 생각이 드러나게 써봐.' : '책 내용과 내 생각이 드러나게 작성해주세요.'}
              value={answer2}
              onChange={e => setAnswer2(e.target.value)}
              rows={4}
            />
            {!hasMeaningfulAnswer && (
              <div className="child-step-sub">
                질문 중 하나에는 {MIN_MEANINGFUL_ANSWER_LENGTH}자 이상 답해야 독후감을 만들 수 있어요.
              </div>
            )}
            <button
              className="btn-primary child-next-btn"
              disabled={generating || !hasMeaningfulAnswer}
              onClick={handleGenerateReview}
            >
              {generating ? '독후감 만드는 중... ✍️' : '다음 →'}
            </button>
          </div>
        )}

        {/* Step: 독후감 확인·수정 */}
        {step === 'review' && (
          <div className="child-step">
            <div className="child-step-emoji">✨</div>
            <div className="child-step-title">독후감이 완성됐어!</div>
            <div className="child-step-sub">
              30자 이상, 책의 인물·사건·새로 알게 된 점·내 생각 중 하나가 들어가면 좋아
            </div>
            <textarea
              className="child-answer-input child-review-textarea"
              value={editedReview}
              onChange={e => setEditedReview(e.target.value)}
              rows={7}
            />
            <div className="child-step-sub">
              현재 {editedReview.trim().length}자
            </div>
            <button
              className="btn-primary child-next-btn"
              disabled={saving || editedReview.trim().length < 30}
              onClick={handleComplete}
            >{saving ? '저장 중...' : '저장하기 🎊'}</button>
          </div>
        )}

        {/* Step: 완료 */}
        {step === 'done' && (
          <div className="child-step child-step--done">
            <div className="child-done-trophy">{isReviewOnly ? '⭐' : '🏆'}</div>
            <div className="child-step-title">{isReviewOnly ? '후기 저장 완료!' : '완독 성공!'}</div>
            <div className="child-step-sub">
              {isReviewOnly
                ? (isChild ? '멋진 독후감이야! 👏' : '좋은 후기를 남겨주셨어요! 👏')
                : (isChild ? '정말 잘했어! 다음 책도 기대돼 📚' : '훌륭해요! 다음 책도 기대할게요 📚')}
            </div>
            <button className="btn-primary child-next-btn" onClick={onClose}>닫기</button>
          </div>
        )}
      </div>
    </div>
  );
}
