const CACHE_NAME = 'pjsekai-hanabi-v5';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/base.css',
  '/css/theme.css',
  '/css/songs.css',
  '/css/cards.css',
  '/js/theme.js',
  '/js/i18n.js',
  '/js/sekai-data.js',
  '/js/image-store.js',
  '/js/scores.js',
  '/js/achievements.js',
  '/js/ranking.js',
  '/js/updates.js',
  '/js/feedback.js',
  '/js/main.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(r => {
      const clone = r.clone();
      caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      return r;
    }).catch(() => caches.match(e.request))
  );
});
