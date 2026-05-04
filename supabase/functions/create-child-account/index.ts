import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('인증 헤더가 없습니다.');

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) throw new Error('인증되지 않은 사용자입니다.');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { name, pin, birthDate, avatarEmoji, legacyUserId, nickname } = await req.json() as {
      name: string;
      pin: string;
      birthDate: string;
      avatarEmoji?: string;
      legacyUserId?: string;
      nickname?: string;
    };
    const displayName = nickname?.trim() || name.trim();

    if (!name?.trim()) throw new Error('이름을 입력해주세요.');
    if (!birthDate) throw new Error('생년월일을 입력해주세요.');
    if (!pin || pin.length < 4) throw new Error('PIN은 4자리 이상이어야 합니다.');

    const childId = crypto.randomUUID();
    const childEmail = `child.${childId}@bookstat.internal`;

    // 자녀 계정 생성 (이메일 확인 없이)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: childEmail,
      password: pin,
      email_confirm: true,
      user_metadata: { is_child: true, parent_id: user.id },
    });
    if (createError) throw createError;

    const childUserId = newUser.user.id;

    // 자녀 프로필 생성
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: childUserId,
      display_name: displayName,
      handle: `child_${childId.replace(/-/g, '').slice(0, 10)}`,
      full_name: name.trim(),
      birth_date: birthDate,
      is_child: true,
      parent_id: user.id,
      avatar_emoji: avatarEmoji ?? '🧒',
    });
    if (profileError) throw profileError;

    // 부모 그룹에 자녀 추가
    const { data: parentMembership } = await supabaseAdmin
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id)
      .eq('status', 'accepted')
      .maybeSingle();

    if (parentMembership) {
      await supabaseAdmin.from('group_members').insert({
        group_id: parentMembership.group_id,
        user_id: childUserId,
        role: 'member',
        status: 'accepted',
      });
    }

    // 기존 레거시 서재 데이터 통합 (예: user_id = 'suyeon')
    let migratedBooks = 0;
    if (legacyUserId?.trim()) {
      const { count } = await supabaseAdmin
        .from('books')
        .update({ user_id: childUserId })
        .eq('user_id', legacyUserId.trim())
        .select('id', { count: 'exact', head: true });
      migratedBooks = count ?? 0;

      // child_accounts 테이블에도 저장
      await supabaseAdmin.from('child_accounts').insert({
        parent_id: user.id,
        child_user_id: childUserId,
        name: name.trim(),
        avatar_emoji: avatarEmoji ?? '🧒',
        birth_date: birthDate,
        child_email: childEmail,
      });
    } else {
      await supabaseAdmin.from('child_accounts').insert({
        parent_id: user.id,
        child_user_id: childUserId,
        name: name.trim(),
        avatar_emoji: avatarEmoji ?? '🧒',
        birth_date: birthDate,
        child_email: childEmail,
      });
    }

    return new Response(
      JSON.stringify({
        childId: childUserId,
        childEmail,
        name: name.trim(),
        avatarEmoji: avatarEmoji ?? '🧒',
        birthDate,
        migratedBooks,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
