const CACHE_NAME = 'ghadas-journey-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/game.js',
  '/manifest.json',
  '/assets/ghada_run.png',
  '/assets/ghada_jump.png',
  '/assets/ghada_fly.png',
  '/assets/husband.png',
  '/assets/cozy_home.png',
  '/assets/cairo_bg.png',
  '/assets/plane_bg.png',
  '/assets/jfk_bg.png',
  '/assets/nyc_bg.png',
  '/assets/ryebrook_bg.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request);
    })
  );
});
