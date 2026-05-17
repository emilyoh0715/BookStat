/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;
declare const __WB_MANIFEST: Array<{ url: string; revision: string | null }>;

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

cleanupOutdatedCaches();
precacheAndRoute(__WB_MANIFEST);

// ─── Push notification ───────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  const payload = event.data?.json() as
    | { title: string; body: string; url?: string }
    | undefined;

  const title = payload?.title ?? '북스탯';
  const body  = payload?.body  ?? '가족이 새 활동을 남겼어요!';
  const url   = payload?.url   ?? '/';

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, {
        body,
        icon:  '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data:  { url },
        requireInteraction: false,
      });
      // App icon badge
      if ('setAppBadge' in (self.navigator as Navigator)) {
        (self.navigator as Navigator & { setAppBadge(): Promise<void> })
          .setAppBadge()
          .catch(() => {});
      }
    })()
  );
});

// ─── Notification click ──────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data?.url ?? '/') as string;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const focused = clients.find((c) => 'focus' in c);
        if (focused) return (focused as WindowClient).focus();
        return self.clients.openWindow(url);
      })
  );
});
