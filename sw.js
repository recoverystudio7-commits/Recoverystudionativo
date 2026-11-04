/* Recovery Studio — Service worker (solo cuando se sirve por HTTP/HTTPS) */
const CACHE = 'recovery-studio-v7';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './sitemap.xml',
  './robots.txt',
  './assets/icon.svg',
  './assets/css/styles.css',
  './assets/css/views.css',
  './assets/css/landing.css',
  './assets/js/data.js',
  './assets/js/ui.js',
  './assets/js/auth.js',
  './assets/js/user.js',
  './assets/js/admin-base.js',
  './assets/js/admin-people.js',
  './assets/js/admin-money.js',
  './assets/js/admin-system.js',
  './assets/js/reviews.js',
  './assets/js/app.js',
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
