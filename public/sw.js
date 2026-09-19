const CACHE_NAME = '30xcam-app-shell-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/icon?size=192',
  '/icon?size=512'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
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
  // Absolutely DO NOT CACHE Firebase / API requests
  const url = new URL(event.request.url);
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com')
  ) {
    return; // Fall through to standard network fetch
  }

  // App Shell caching strategy: Network first, fallback to cache
  if (event.request.mode === 'navigate' || url.pathname.startsWith('/_next/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request).then(res => res || caches.match('/')))
    );
    return;
  }

  // Static assets cache first
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Generic background notification handler
// (Since we don't have a backend pushing web push, this relies on the app triggering postMessage to the SW,
// or the SW doing something if it supports Background Sync, but we will mostly rely on client-side notification triggers.)

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const title = '30xCam';
    const options = {
      body: "Hey Official Haadi, let's zoom in 30x with our camera.",
      icon: '/icon?size=192',
      badge: '/icon?size=192',
      tag: 'new-message', // replaces previous notifications
      data: { url: '/chat' }
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if available
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes('/chat') && 'focus' in client) {
          return client.focus();
        }
      }
      // Or open a new one
      if (clients.openWindow) {
        return clients.openWindow('/chat');
      }
    })
  );
});
