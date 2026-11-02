import type { Book } from '../types.ts';
import type { ReviewValidationResult } from './geminiAi.ts';

export interface ReviewSubmission {
  rating: number;
  childEmotion: string;
  childAnswers: { question: string; answer: string }[];
  review: string;
}

export interface ReviewCompletion {
  newlyFinished: boolean;
  pointsAwarded: number;
  pointsPending: boolean;
}

interface Dependencies {
  validate: (review: string, title: string, answers: ReviewSubmission['childAnswers']) => Promise<ReviewValidationResult>;
  save: (id: string, updates: Partial<Book>) => Promise<boolean>;
  award: (id: string, reason: 'book_finished' | 'review_approved', points: number, finishDate?: string) => Promise<boolean>;
  finishedPoints: number;
  reviewPoints: number;
  now?: Date;
}

// No book mutation, completion or reward is allowed before a conclusive verdict.
export async function completeReview(book: Book, submission: ReviewSubmission, deps: Dependencies): Promise<ReviewCompletion> {
  const review = submission.review.trim();
  if (review.length < 30 || !Number.isInteger(submission.rating) || submission.rating < 1 || submission.rating > 5) {
    throw new Error('별점과 30자 이상의 감상문을 확인해주세요.');
  }
  const verdict = await deps.validate(review, book.title, submission.childAnswers);
  if (verdict.valid !== true || verdict.uncertain === true || verdict.source !== 'gemini') {
    throw new Error(verdict.reason ?? '감상문 승인을 확인하지 못했어요. 내용을 보완하거나 다시 검증해주세요.');
  }
  const now = deps.now ?? new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const newlyFinished = book.status === 'reading';
  if (!newlyFinished && book.status !== 'finished') throw new Error('읽는 중이거나 다 읽은 책에 감상문을 남겨주세요.');
  const finishDate = newlyFinished ? today : book.finishDate;
  const saved = await deps.save(book.id, {
    ...submission, review, reviewCreatedAt: now.toISOString(),
    ...(newlyFinished ? { status: 'finished', finishDate } : {}),
  });
  if (!saved) throw new Error('감상문을 저장하지 못했어요. 다시 시도해주세요.');

  let pointsAwarded = 0;
  let pointsPending = false;
  const eligible = !finishDate || Number(finishDate.slice(0, 4)) === now.getFullYear();
  if (eligible) {
    const awards: ['book_finished' | 'review_approved', number][] = [
      ...(newlyFinished ? [['book_finished', deps.finishedPoints] as ['book_finished', number]] : []),
      ['review_approved', deps.reviewPoints],
    ];
    for (const [reason, points] of awards) {
      try {
        if (await deps.award(book.id, reason, points, finishDate)) pointsAwarded += points;
        else pointsPending = true;
      } catch { pointsPending = true; }
    }
  }
  return { newlyFinished, pointsAwarded, pointsPending };
}
