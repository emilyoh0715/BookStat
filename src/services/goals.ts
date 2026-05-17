import { supabase } from '../lib/supabase';

export interface ReadingGoal {
  id: string;
  group_id: string;
  user_id: string;
  item_name: string;
  item_image_url: string | null;
  item_emoji: string | null;
  points_required: number;
  status: 'pending_approval' | 'active' | 'completed' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  reject_note: string | null;
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

export async function uploadGoalImage(file: File): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const ext  = file.name.split('.').pop() ?? 'jpg';
  const path = `${session.user.id}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('goal-images')
    .upload(path, file, { upsert: true });
  if (error) return null;
  const { data } = supabase.storage.from('goal-images').getPublicUrl(path);
  return data.publicUrl;
}

export async function createGoal(params: {
  itemName: string;
  pointsRequired: number;
  imageUrl?: string | null;
  emoji?: string | null;
}): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const groupId = await getMyGroupId();
  if (!groupId) return;

  // 기존 활성/대기 목표 취소
  await supabase
    .from('reading_goals')
    .update({ status: 'rejected' })
    .eq('user_id', session.user.id)
    .in('status', ['pending_approval', 'active']);

  await supabase.from('reading_goals').insert({
    group_id:        groupId,
    user_id:         session.user.id,
    item_name:       params.itemName,
    item_image_url:  params.imageUrl  ?? null,
    item_emoji:      params.emoji     ?? null,
    points_required: params.pointsRequired,
    status:          'pending_approval',
  });
}

export async function getMyCurrentGoal(): Promise<ReadingGoal | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data } = await supabase
    .from('reading_goals')
    .select('*')
    .eq('user_id', session.user.id)
    .in('status', ['pending_approval', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as ReadingGoal | null;
}

export async function getGroupPendingGoals(): Promise<ReadingGoal[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  const { data } = await supabase
    .from('reading_goals')
    .select('*')
    .eq('status', 'pending_approval')
    .neq('user_id', session.user.id)
    .order('created_at', { ascending: false });
  return (data ?? []) as ReadingGoal[];
}

export async function approveGoal(goalId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase
    .from('reading_goals')
    .update({ status: 'active', approved_by: session.user.id, approved_at: new Date().toISOString() })
    .eq('id', goalId);
}

export async function rejectGoal(goalId: string, note?: string): Promise<void> {
  await supabase
    .from('reading_goals')
    .update({ status: 'rejected', reject_note: note ?? null })
    .eq('id', goalId);
}

export async function cancelGoal(goalId: string): Promise<void> {
  await supabase
    .from('reading_goals')
    .update({ status: 'rejected' })
    .eq('id', goalId);
}

export async function redeemGoal(goal: ReadingGoal): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return '로그인이 필요해요.';

    const groupId = await getMyGroupId();
    if (!groupId) return '그룹 정보를 찾을 수 없어요.';

    // point_redemptions에 보상 요청 삽입
    const { error } = await supabase.from('point_redemptions').insert({
      user_id:      session.user.id,
      group_id:     groupId,
      item_id:      `goal:${goal.id}`,
      item_name:    goal.item_name,
      points_cost:  goal.points_required,
    });
    if (error) return error.message;

    // 목표 상태를 completed로 변경
    await supabase
      .from('reading_goals')
      .update({ status: 'completed' })
      .eq('id', goal.id);

    return null;
  } catch (e) {
    console.error('[redeemGoal]', e);
    return '보상 요청 중 오류가 발생했어요.';
  }
}
