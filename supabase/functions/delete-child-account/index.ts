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

    const { childId } = await req.json() as { childId: string };
    if (!childId) throw new Error('childId가 없습니다.');

    // 요청자가 이 자녀의 부모인지 확인
    const { data: childProfile } = await supabaseAdmin
      .from('profiles')
      .select('parent_id')
      .eq('id', childId)
      .maybeSingle();

    if (childProfile?.parent_id !== user.id) {
      throw new Error('권한이 없습니다.');
    }

    // 순서대로 삭제
    await supabaseAdmin.from('group_members').delete().eq('user_id', childId);
    await supabaseAdmin.from('point_redemptions').delete().eq('user_id', childId);
    await supabaseAdmin.from('point_logs').delete().eq('user_id', childId);
    await supabaseAdmin.from('child_accounts').delete().eq('child_user_id', childId);
    await supabaseAdmin.from('profiles').delete().eq('id', childId);
    await supabaseAdmin.auth.admin.deleteUser(childId);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
