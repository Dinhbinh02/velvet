// Velvet Service Worker - Offline Caching & App Shell
const CACHE_NAME = 'velvet-pwa-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon16.png',
  '/icons/icon32.png',
  '/icons/icon48.png',
  '/icons/icon128.png',
  '/icons/icon192.png',
  '/icons/icon512.png',
  '/icons/apple-touch-icon.png',
  '/fonts/fonts.css',
  '/src/styles/tailwind.css',
  '/src/styles/themes.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Cache addAll non-critical error:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-HTTP(S) schemes (e.g. chrome-extension://) and non-GET requests
  if (!request.url.startsWith('http://') && !request.url.startsWith('https://')) {
    return;
  }

  // Skip non-GET and API / proxy requests
  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  // Network-first for navigation requests (HTML), fallback to cache / offline app shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match('/');
        })
    );
    return;
  }

  // Stale-While-Revalidate for static assets, fonts, icons, styles
  if (
    url.origin === self.location.origin ||
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff2|woff|ttf|eot)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const resClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
