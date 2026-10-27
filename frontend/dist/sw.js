/* Murago ERP service worker: offline support WITHOUT stale-app risk.
   Rules that keep the live deployment always visible:
   - Navigations / app shell: NETWORK-FIRST (new deploys appear immediately),
     cache only as an offline fallback.
   - Hashed static assets (their URL changes with content): cache-first.
   - API GET: network-first; cache ONLY successful (2xx) responses for
     offline viewing; error responses are NEVER cached.
   Bump CACHE on any breaking change to purge old caches on activate. */
const CACHE = 'murago-v9'
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/app/', '/app/manifest.json', '/app/icon.svg'])).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET') return
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request).then((r) => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)) }
      return r
    }).catch(() => caches.match(e.request)))
    return
  }
  if (e.request.mode === 'navigate' || url.pathname === '/app/' || url.pathname.endsWith('/index.html')) {
    // App shell: always try the network first so deploys are seen at once.
    e.respondWith(fetch(e.request).then((r) => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put('/app/', copy)) }
      return r
    }).catch(() => caches.match('/app/')))
    return
  }
  // Static assets: cache-first (hashed names make this safe), fill on miss.
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)) }
    return r
  }).catch(() => caches.match('/app/'))))
})
self.addEventListener('sync', (e) => {
  if (e.tag === 'murago-sync') {
    e.waitUntil(self.clients.matchAll().then((cs) => cs.forEach((c) => c.postMessage({ type: 'BG_SYNC' }))))
  }
})
