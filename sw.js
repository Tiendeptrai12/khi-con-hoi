importScripts('./offline-assets.js');

const CACHE_NAME = 'khi-con-hoi-v3';
const assetPath = new URL('./assets/', self.location.href).pathname;
const APP_SHELL = [
  './index.html',
  ...self.OFFLINE_APP_ASSETS,
  './manifest.webmanifest',
  './favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith('khi-con-hoi-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isHtmlNavigation =
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html') ||
    url.pathname.endsWith('/index.html');

  // Always prefer network for HTML documents so deploys never reference deleted hashed bundles
  if (isHtmlNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  // Immutable hashed assets & icons: Cache-First with network fallback
  event.respondWith(
    // Vary: Origin can differ between precaching and anonymous module requests.
    caches.match(request, { ignoreVary: url.pathname.startsWith(assetPath) }).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
