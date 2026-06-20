import { supabase } from '../lib/supabase';
import { sendGroupPush } from './pushNotifications';

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
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const { data } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', session.user.id)
      .in('status', ['accepted', 'pending'])
      .limit(1)
      .maybeSingle();
    return data?.group_id ?? null;
  } catch {
    return null;
  }
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
): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return '로그인이 필요해요.';

    const groupId = await getMyGroupId();
    if (!groupId) return '그룹에 가입되어 있지 않아요.';

    const { error } = await supabase.from('book_comments').insert({
      group_id: groupId,
      book_id: bookId,
      book_owner_id: bookOwnerId,
      user_id: session.user.id,
      content: content.trim(),
    });

    if (error) {
      console.error('[addBookComment]', error);
      return error.message;
    }

    // 같은 그룹 다른 멤버에게 푸시 알림 발송 (실패해도 댓글 작성은 성공)
    await sendGroupPush({
      groupId:  groupId,
      senderId: session.user.id,
      title:    '📖 가족 한마디',
      body:     content.trim().slice(0, 80),
      url:      '/',
      type:     'book_comment',
    });

    return null;
  } catch (e) {
    console.error('[addBookComment] unexpected error', e);
    return '댓글 작성 중 오류가 발생했어요.';
  }
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
