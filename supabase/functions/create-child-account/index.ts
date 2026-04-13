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

    // 호출한 사용자 검증
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) throw new Error('인증되지 않은 사용자입니다.');

    // 서비스 롤 클라이언트 (이메일 확인 없이 유저 생성)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { name, pin, birthDate, avatarEmoji } = await req.json() as {
      name: string;
      pin: string;
      birthDate: string;
      avatarEmoji?: string;
    };

    if (!name?.trim()) throw new Error('이름을 입력해주세요.');
    if (!pin || pin.length < 4) throw new Error('PIN은 4자리 이상이어야 합니다.');

    const childId = crypto.randomUUID();
    const childEmail = `child.${childId}@bookstat.internal`;

    // 이메일 확인 없이 자녀 계정 생성
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
      display_name: name.trim(),
      handle: `child_${childId.replace(/-/g, '').slice(0, 10)}`,
      full_name: name.trim(),
      birth_date: birthDate || null,
      is_child: true,
      parent_id: user.id,
      avatar_emoji: avatarEmoji ?? '🧒',
    });
    if (profileError) throw profileError;

    // 부모가 속한 그룹에 자녀도 추가
    const { data: parentMembership } = await supabaseAdmin
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (parentMembership) {
      await supabaseAdmin.from('group_members').insert({
        group_id: parentMembership.group_id,
        user_id: childUserId,
        role: 'member',
        status: 'active',
      });
    }

    return new Response(
      JSON.stringify({
        childId: childUserId,
        childEmail,
        name: name.trim(),
        avatarEmoji: avatarEmoji ?? '🧒',
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
