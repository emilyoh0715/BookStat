import { supabase } from '../lib/supabase';

/**
 * 완독 후기 포인트 계산
 * 페이지 수 기준 × 언어 배율 (외국어 ×1.5), 소수점 올림
 */
export function calcReviewPoints(totalPages?: number, language?: string): number {
  const pages = totalPages ?? 0;
  const base =
    pages <= 100 ? 3 :
    pages <= 300 ? 5 :
    pages <= 500 ? 8 : 12;
  const multiplier = language === 'korean' ? 1.0 : 1.5;
  return Math.ceil(base * multiplier);
}

export interface PointLog {
  id: string;
  user_id: string;
  book_id: string;
  reason: 'book_added' | 'review_approved';
  points: number;
  created_at: string;
}

/** Remove points for a book+reason (e.g. when review is deleted). */
export async function removePoints(
  bookId: string,
  reason: 'book_added' | 'review_approved'
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase
    .from('point_logs')
    .delete()
    .eq('user_id', session.user.id)
    .eq('book_id', bookId)
    .eq('reason', reason);
}

/**
 * 책의 현재 상태를 기반으로 포인트 로그를 동기화.
 * - 후기 삭제 또는 완독 해제 → review_approved 포인트 제거
 * - 읽고 싶음으로 변경 → book_added 포인트 제거
 * - 그 외 상태로 복귀 → book_added 재부여 (idempotent)
 * (review_approved는 AI 검증 통과 시에만 추가, 여기서는 제거만)
 */
export async function syncBookPoints(
  bookId: string,
  status: string,
  review: string | undefined,
  _totalPages: number | undefined,
  _language: string | undefined,
  rating?: number
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const userId = session.user.id;

  // book_added 동기화
  if (status === 'want-to-read') {
    await supabase.from('point_logs')
      .delete()
      .eq('user_id', userId).eq('book_id', bookId).eq('reason', 'book_added');
  } else {
    await awardPoints(bookId, 'book_added', 1); // idempotent
  }

  // review_approved 동기화 — 완독 + 후기 + 별점 모두 있을 때만 유지
  const hasReview = status === 'finished' && !!review?.trim() && (rating ?? 0) > 0;
  if (!hasReview) {
    await supabase.from('point_logs')
      .delete()
      .eq('user_id', userId).eq('book_id', bookId).eq('reason', 'review_approved');
  }
}

/** Award points for a book action. Idempotent — won't double-award the same book+reason. */
export async function awardPoints(
  bookId: string,
  reason: 'book_added' | 'review_approved',
  points: number
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const userId = session.user.id;

  // Idempotency check: skip if already awarded for this book+reason
  const { data: existing } = await supabase
    .from('point_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .eq('reason', reason)
    .maybeSingle();
  if (existing) return;

  await supabase.from('point_logs').insert({ user_id: userId, book_id: bookId, reason, points });
}

/** Fetch total points and full log for the currently authenticated user. */
export async function getUserPoints(): Promise<{ total: number; logs: PointLog[] }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { total: 0, logs: [] };

  const { data } = await supabase
    .from('point_logs')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  const logs = (data ?? []) as PointLog[];
  const total = logs.reduce((acc, log) => acc + log.points, 0);
  return { total, logs };
}
