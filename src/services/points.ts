import { supabase } from '../lib/supabase';

export type PointReason = 'book_added' | 'book_finished' | 'review_approved';

export interface PointLog {
  id: string;
  user_id: string;
  book_id: string;
  reason: PointReason;
  points: number;
  created_at: string;
}

/**
 * 완독 포인트 — 감상문 포인트보다 낮게 설정해 감상문 작성을 유도
 * 한국어: 5/10/15/20pt   외국어: ×1.5 올림
 */
export function calcFinishedPoints(totalPages?: number, language?: string): number {
  const pages = totalPages ?? 0;
  const base =
    pages <= 100 ?  5 :
    pages <= 300 ? 10 :
    pages <= 500 ? 15 : 20;
  return Math.ceil(base * (language === 'korean' ? 1.0 : 1.5));
}

/**
 * 감상문 포인트 — 완독 포인트보다 높게 설정
 * 한국어: 15/25/40/60pt   외국어: ×1.5 올림
 */
export function calcReviewPoints(totalPages?: number, language?: string): number {
  const pages = totalPages ?? 0;
  const base =
    pages <= 100 ? 15 :
    pages <= 300 ? 25 :
    pages <= 500 ? 40 : 60;
  return Math.ceil(base * (language === 'korean' ? 1.0 : 1.5));
}

/** Remove points for a book+reason (e.g. when review is deleted). */
export async function removePoints(
  bookId: string,
  reason: PointReason
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
 * - 읽고 싶음으로 변경 → book_added 제거
 * - 완독 아닌 상태 → book_finished / review_approved 제거
 * - 그 외 → book_added 재부여 (idempotent)
 */
export async function syncBookPoints(
  bookId: string,
  status: string,
  review: string | undefined,
  _totalPages: number | undefined,
  _language: string | undefined,
  rating?: number,
  finishDate?: string
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const userId = session.user.id;

  // book_added 동기화
  // 완독된 책은 완독일을 created_at 으로 사용 → 연도 집계가 완독 연도 기준으로 동작
  if (status === 'want-to-read') {
    await supabase.from('point_logs')
      .delete()
      .eq('user_id', userId).eq('book_id', bookId).eq('reason', 'book_added');
  } else if (status === 'finished' && finishDate) {
    // 완독 시 기존 book_added 로그를 삭제하고 완독일로 재삽입
    await supabase.from('point_logs')
      .delete()
      .eq('user_id', userId).eq('book_id', bookId).eq('reason', 'book_added');
    await awardPoints(bookId, 'book_added', 2, finishDate);
  } else {
    await awardPoints(bookId, 'book_added', 2); // idempotent (책 추가일 기준)
  }

  // book_finished / review_approved — 완독이 아닌 경우 제거
  if (status !== 'finished') {
    await supabase.from('point_logs').delete()
      .eq('user_id', userId).eq('book_id', bookId).eq('reason', 'book_finished');
    await supabase.from('point_logs').delete()
      .eq('user_id', userId).eq('book_id', bookId).eq('reason', 'review_approved');
    return;
  }

  // review_approved — 완독 + 후기 + 별점 모두 있을 때만 유지
  const hasReview = !!review?.trim() && (rating ?? 0) > 0;
  if (!hasReview) {
    await supabase.from('point_logs')
      .delete()
      .eq('user_id', userId).eq('book_id', bookId).eq('reason', 'review_approved');
  }
}

/**
 * Award points for a book action. Idempotent — won't double-award the same book+reason.
 * @param finishDate  책의 완독일 (YYYY-MM-DD). 전달하면 로그 created_at을 완독 연도 기준으로 설정해
 *                    연도별 포인트 집계가 완독 연도를 따르게 됩니다.
 *                    올해가 아닌 연도의 완독일이면 포인트를 적립하지 않습니다.
 */
export async function awardPoints(
  bookId: string,
  reason: PointReason,
  points: number,
  finishDate?: string
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const userId = session.user.id;

  // 완독일이 있으면 올해 완독한 책만 포인트 적립 (book_added 포함 — 완독일 기준으로 앵커됨)
  if (finishDate) {
    const finishYear = new Date(finishDate).getFullYear();
    if (finishYear !== new Date().getFullYear()) return;
  }

  const { data: existing } = await supabase
    .from('point_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .eq('reason', reason)
    .maybeSingle();
  if (existing) return;

  // book_finished / review_approved 는 완독일을 created_at 으로 사용해
  // 연도 필터가 완독 연도 기준으로 동작하게 함
  const created_at = finishDate
    ? `${finishDate}T12:00:00.000Z`
    : new Date().toISOString();

  await supabase.from('point_logs').insert({ user_id: userId, book_id: bookId, reason, points, created_at });
}

/** Fetch current-year points and log for the authenticated user. Resets each calendar year. */
export async function getUserPoints(): Promise<{ total: number; logs: PointLog[] }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { total: 0, logs: [] };

  const year = new Date().getFullYear();
  const { data } = await supabase
    .from('point_logs')
    .select('*')
    .eq('user_id', session.user.id)
    .gte('created_at', `${year}-01-01T00:00:00.000Z`)
    .lt('created_at',  `${year + 1}-01-01T00:00:00.000Z`)
    .order('created_at', { ascending: false });

  const logs = (data ?? []) as PointLog[];
  const total = logs.reduce((acc, log) => acc + log.points, 0);
  return { total, logs };
}
