const CACHE_NAME = 'squirrel-shell-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/notification.mp3',
  '/chat-bg.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // addAll with individual error handling so one bad asset doesn't break everything
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url =>
          cache.add(url).catch(() => { /* silently skip if not found */ })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept blob: URLs — they are ephemeral and can't be cached
  if (event.request.url.startsWith('blob:')) return;

  // Never intercept Firebase / API / Cloudinary requests
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('apis.google.com') ||
    url.hostname.includes('cloudinary.com')
  ) {
    return;
  }

  // Next.js navigation and chunks — network first, cache fallback
  if (event.request.mode === 'navigate' || url.pathname.startsWith('/_next/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then(res => res || caches.match('/'))
      )
    );
    return;
  }

  // Static assets — cache first
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => { /* offline silent failure */ });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const title = 'Squirrel';
    const options = {
      body: 'You have a new message.',
      tag: 'new-message',
      data: { url: '/' }
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      let matchingClient = null;
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(targetUrl)) {
          matchingClient = client;
          break;
        }
      }
      
      if (matchingClient && 'focus' in matchingClient) {
        if ('navigate' in matchingClient) {
          matchingClient.navigate(targetUrl);
        }
        return matchingClient.focus();
      } else if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const title = data.notification?.title || 'AI Plus';
    const body = data.notification?.body || 'System optimization complete.';
    const icon = data.notification?.image || data.notification?.icon || 'https://raw.githubusercontent.com/hstudio08/squirrel/main/public/iconii.png';

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon,
        tag: 'ai-plus-update',
        vibrate: [200, 100, 200],
        data: { url: '/' }
      })
    );
  }
});
