import { supabase } from '../lib/supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;
const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL     as string;
const SUPABASE_ANON    = import.meta.env.VITE_SUPABASE_KEY     as string;

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export const isPushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export async function isPushSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const reg = await navigator.serviceWorker.ready;
  return !!(await reg.pushManager.getSubscription());
}

export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
    });
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;

  const { data: membership } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', session.user.id)
    .eq('status', 'accepted')
    .limit(1)
    .maybeSingle();
  if (!membership) return false;

  await supabase.from('push_subscriptions').upsert({
    user_id:      session.user.id,
    group_id:     membership.group_id,
    endpoint:     sub.endpoint,
    subscription: sub.toJSON(),
  }, { onConflict: 'user_id,endpoint' });

  return true;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', session.user.id)
      .eq('endpoint', sub.endpoint);
  }
  await sub.unsubscribe();
}

export async function sendGroupPush(params: {
  groupId:  string;
  senderId: string;
  title:    string;
  body:     string;
}): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON}`,
      },
      body: JSON.stringify(params),
    });
  } catch {
    // push failure is non-critical
  }
}

export async function clearBadge(): Promise<void> {
  if ('clearAppBadge' in navigator) {
    (navigator as Navigator & { clearAppBadge(): Promise<void> })
      .clearAppBadge()
      .catch(() => {});
  }
}
