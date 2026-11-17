/* Service Worker «Мій день». Версію й список файлів підставляє збірка (vite.config.ts). */
const VERSION = '__VERSION__';
const CACHE = 'day-planner-' + VERSION;
const PRECACHE = "__PRECACHE__";
const MATCH = { ignoreVary: true, ignoreSearch: false };
const scopeURL = (p) => new URL(p, self.registration.scope).toString();

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(['./', ...PRECACHE].map(scopeURL))).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('day-planner-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

// Офлайн: спершу кеш; навігація завжди повертає закешований index.html (SPA).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // запити до push/AI-сервера не чіпаємо
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match(scopeURL('./'), MATCH).then((hit) => hit || fetch(req)).catch(() => caches.match(scopeURL('./'), MATCH)),
    );
    return;
  }
  event.respondWith(
    caches.match(req, MATCH).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })),
  );
});

// Web Push: сервер надсилає {title, body, tag, url}
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'Мій день', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Мій день';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    tag: data.tag || data.id || undefined,
    icon: scopeURL('icons/icon-192.png'),
    badge: scopeURL('icons/icon-192.png'),
    data: { url: data.url || scopeURL('./') },
    renotify: !!data.tag,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || scopeURL('./');
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      return self.clients.openWindow(target);
    }),
  );
});

self.addEventListener('message', (event) => { if (event.data === 'SKIP_WAITING') self.skipWaiting(); });
