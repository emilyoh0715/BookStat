import { supabase } from '../lib/supabase';

export interface BookComment {
  id: string;
  group_id: string;
  book_id: string;
  book_owner_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { display_name: string; avatar_url: string | null };
}

export interface ActivityLogItem {
  id: string;
  type: 'book_added' | 'book_finished';
  user_id: string;
  book_id: string;
  points: number;
  created_at: string;
}

async function getMyGroupId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', session.user.id)
    .eq('status', 'accepted')
    .limit(1)
    .maybeSingle();
  return data?.group_id ?? null;
}

export async function getBookComments(bookId: string): Promise<BookComment[]> {
  const { data } = await supabase
    .from('book_comments')
    .select('*')
    .eq('book_id', bookId)
    .order('created_at', { ascending: true });
  return (data ?? []) as BookComment[];
}

export async function addBookComment(
  bookId: string,
  bookOwnerId: string,
  content: string
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const groupId = await getMyGroupId();
  if (!groupId) return;
  await supabase.from('book_comments').insert({
    group_id: groupId,
    book_id: bookId,
    book_owner_id: bookOwnerId,
    user_id: session.user.id,
    content: content.trim(),
  });
}

export async function deleteBookComment(commentId: string): Promise<void> {
  await supabase.from('book_comments').delete().eq('id', commentId);
}

export async function getGroupActivityComments(limit = 50): Promise<BookComment[]> {
  const { data } = await supabase
    .from('book_comments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as BookComment[];
}

export async function getGroupActivityLogs(
  memberIds: string[],
  limit = 50
): Promise<ActivityLogItem[]> {
  if (memberIds.length === 0) return [];
  const { data } = await supabase
    .from('point_logs')
    .select('id, user_id, book_id, reason, points, created_at')
    .in('user_id', memberIds)
    .in('reason', ['book_added', 'book_finished'])
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []).map(d => ({
    id: d.id,
    type: d.reason as 'book_added' | 'book_finished',
    user_id: d.user_id,
    book_id: d.book_id,
    points: d.points,
    created_at: d.created_at,
  }));
}
