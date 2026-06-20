import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushRequest {
  groupId: string;
  senderId: string;
  title: string;
  body: string;
  url?: string;
  type?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) throw new Error('인증 헤더가 없습니다.');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    const callerId = userData.user?.id;
    if (userError || !callerId) throw new Error('인증되지 않은 사용자입니다.');

    const { groupId, senderId, title, body, url, type } = await req.json() as PushRequest;
    if (!groupId || !senderId || !title || !body) {
      throw new Error('groupId, senderId, title, body가 필요합니다.');
    }
    if (callerId !== senderId) throw new Error('발신자 정보가 일치하지 않습니다.');

    const { data: membership } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', callerId)
      .eq('status', 'accepted')
      .maybeSingle();
    if (!membership) throw new Error('그룹 알림 발송 권한이 없습니다.');

    const vapidPub = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPriv = Deno.env.get('VAPID_PRIVATE_KEY');
    if (!vapidPub || !vapidPriv) throw new Error('VAPID 키가 설정되지 않았습니다.');

    webpush.setVapidDetails('mailto:admin@bookstat.app', vapidPub, vapidPriv);

    const { data: subs, error: subError } = await supabase
      .from('push_subscriptions')
      .select('id, subscription')
      .eq('group_id', groupId)
      .neq('user_id', senderId);
    if (subError) throw subError;

    const payload = JSON.stringify({
      title,
      body,
      url: url ?? '/',
      type: type ?? 'group_activity',
    });

    let sent = 0;
    let failed = 0;
    const staleIds: string[] = [];

    await Promise.all((subs ?? []).map(async ({ id, subscription }) => {
      try {
        await webpush.sendNotification(subscription, payload, {
          TTL: 86400,
          urgency: 'normal',
        });
        sent++;
      } catch (err) {
        failed++;
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) staleIds.push(id);
        console.error('[send-push] failed', { id, statusCode, err: String(err) });
      }
    }));

    if (staleIds.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', staleIds);
    }

    return new Response(JSON.stringify({ ok: true, sent, failed, stale: staleIds.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[send-push] error', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
