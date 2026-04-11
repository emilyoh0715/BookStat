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
