/* Recovery Studio — Service worker (solo cuando se sirve por HTTP/HTTPS) */
const CACHE = 'recovery-studio-v39';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './sitemap.xml',
  './robots.txt',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/apple-touch-icon.png',
  './assets/css/styles.css?v=2',
  './assets/css/views.css?v=5',
  './assets/css/landing.css',
  './assets/css/legal.css',
  './assets/js/data.js?v=10',
  './assets/js/ui.js?v=2',
  './assets/js/auth.js?v=16',
  './assets/js/user.js?v=22',
  './assets/js/admin-base.js?v=9',
  './assets/js/admin-people.js?v=11',
  './assets/js/admin-club.js?v=3',
  './assets/js/admin-alerts.js?v=1',
  './assets/js/admin-money.js?v=7',
  './assets/js/admin-system.js?v=3',
  './assets/js/content.js?v=4',
  './assets/js/reviews.js?v=3',
  './assets/js/supabase-client.js?v=5',
  './assets/js/supabase-sync.js?v=7',
  './assets/js/routine-sync.js?v=2',
  './assets/js/app.js?v=10',
  './kinesiologia.html',
  './masajes.html',
  './sauna.html',
  './asesorias.html',
  './precios.html',
  './privacidad.html',
  './terminos.html',
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

/* Push notifications */
self.addEventListener('push', (event) => {
  let data = { title: 'Recovery Studio', body: 'Tienes una nueva notificación.' };
  try { data = event.data.json(); } catch (e) { /* usar default */ }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Recovery Studio', {
      body: data.body || '',
      icon: '/assets/icon-192.png',
      badge: '/assets/icon-192.png',
      tag: data.tag || 'rs-notification',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
