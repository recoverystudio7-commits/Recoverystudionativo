/* Recovery Studio — Service worker (solo cuando se sirve por HTTP/HTTPS) */
const CACHE = 'recovery-studio-v23';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './sitemap.xml',
  './robots.txt',
  './assets/icon.svg',
  './assets/css/styles.css?v=2',
  './assets/css/views.css?v=5',
  './assets/css/landing.css',
  './assets/js/data.js?v=9',
  './assets/js/ui.js?v=2',
  './assets/js/auth.js?v=11',
  './assets/js/user.js?v=12',
  './assets/js/admin-base.js?v=8',
  './assets/js/admin-people.js?v=9',
  './assets/js/admin-club.js?v=3',
  './assets/js/admin-alerts.js?v=1',
  './assets/js/admin-money.js?v=7',
  './assets/js/admin-system.js?v=3',
  './assets/js/content.js?v=3',
  './assets/js/reviews.js?v=3',
  './assets/js/supabase-client.js?v=1',
  './assets/js/supabase-sync.js?v=1',
  './assets/js/routine-sync.js?v=1',
  './assets/js/app.js?v=8',
  './kinesiologia.html',
  './masajes.html',
  './sauna.html',
  './asesorias.html',
  './precios.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

/* Red primero: así las actualizaciones del sitio se ven de inmediato.
   Si no hay conexión, se responde con la copia en caché. */
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request, { cache: 'reload' })
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
  );
});
