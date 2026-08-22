const CACHE_NAME = 'zenolet-v2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './curator/config.json',
  './curator/catalog.json',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[Zenolet SW] Pre-cache warning:', err);
      });
    })
  );
  self.skipWaiting();
});

const PROTECTED_CACHES = new Set([CACHE_NAME, 'zenolet-books-v1']);

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter((key) => !PROTECTED_CACHES.has(key)).map((key) => caches.delete(key)));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Bypass SW cache for local development, Vite HMR, and source modules
  if (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.pathname.startsWith('/src/') ||
    url.pathname.includes('node_modules') ||
    event.request.url.includes('token=')
  ) {
    return;
  }

  // Network-First strategy for HTML navigation & site config to prevent 404s on newly deployed asset hashes
  const isHtmlOrConfig =
    event.request.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/curator/config.json') ||
    url.pathname.endsWith('/zenolet.config.json');

  if (isHtmlOrConfig) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || caches.match('./index.html');
          });
        })
    );
    return;
  }

  // Cache-First strategy for static assets & cached books with network fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // Do not return HTML index fallback for static subresources (JS/CSS/fonts/images)
          return new Response(null, { status: 404, statusText: 'Offline Resource Not Found' });
        });
    })
  );
});
