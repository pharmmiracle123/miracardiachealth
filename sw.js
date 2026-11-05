// ============================================================
// MiracardiacHealth - Service Worker
// Place at the ROOT (same folder as index.html)
// Bump CACHE_VERSION whenever you change any cached file.
// ============================================================

const CACHE_VERSION = 'v3';
const STATIC_CACHE = `mh-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `mh-runtime-${CACHE_VERSION}`;

// Core app shell (cached on install). Missing files are skipped safely.
const PRECACHE = [
  './',
  'index.html',
  'manifest.json',
  'css/styles.css',
  'js/config.js',
  'icons/icon.svg'
];

// Trusted third-party hosts whose static assets are safe to cache
const CACHEABLE_CDNS = [
  'cdn.tailwindcss.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'www.gstatic.com' // Firebase SDK modules
];

// NEVER cache these (live data, payments, paid content, news, APIs)
const NEVER_CACHE_HOSTS = [
  'firestore.googleapis.com',
  'firebasestorage.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'api.rss2json.com',
  'js.paystack.co',
  'checkout.paystack.com',
  'api.paystack.co',
  'api.emailjs.com',
  'api.cloudinary.com',
  'res.cloudinary.com'
];

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline | MiracardiacHealth</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;
  background:linear-gradient(120deg,#0f766e,#059669,#0ea5e9);color:#fff;text-align:center;padding:24px}
  .card{max-width:340px}
  h1{font-size:22px;margin:12px 0 6px} p{opacity:.9;font-size:14px;line-height:1.5}
  button{margin-top:16px;background:#fff;color:#0f766e;border:0;border-radius:12px;padding:12px 24px;font-weight:700;font-size:14px}
</style></head>
<body><div class="card"><div style="font-size:52px">📡</div>
<h1>You're offline</h1>
<p>MiracardiacHealth needs an internet connection for chats, payments and orders. Check your connection and try again.</p>
<button onclick="location.reload()">Try again</button></div></body></html>`;

// ---------- Install ----------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      await Promise.all(
        PRECACHE.map((url) => cache.add(url).catch(() => console.warn('[SW] skip precache:', url)))
      );
    }).then(() => self.skipWaiting())
  );
});

// ---------- Activate: remove old caches ----------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
        .filter((k) => k.startsWith('mh-') && k !== STATIC_CACHE && k !== RUNTIME_CACHE)
        .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ---------- Fetch strategies ----------
async function networkFirstPage(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  try {
    // Wait at most 2.5s for the network, then fall back to the saved page
    const fresh = await Promise.race([
      fetch(request),
      new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 2500))
    ]);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const fallback = cached || (await caches.match('index.html'));
    if (fallback) return fallback;
    return new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  
  const url = new URL(request.url);
  
  // Never touch live data / payment / paid content hosts
  if (NEVER_CACHE_HOSTS.includes(url.hostname)) return;
  
  // Same-origin
  if (url.origin === self.location.origin) {
    // HTML pages: network first, fallback to cache, then offline page
    if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
      event.respondWith(networkFirstPage(request));
      return;
    }
    // CSS, JS, icons, manifest: stale-while-revalidate
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }
  
  // Trusted CDNs: stale-while-revalidate
  if (CACHEABLE_CDNS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
  }
  // Everything else: default browser behaviour
});

// ---------- Messages (allow page to trigger instant update) ----------
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// ---------- Push notifications (ready for later) ----------
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'MiracardiacHealth', body: event.data ? event.data.text() : '' }; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'MiracardiacHealth', {
      body: data.body || 'You have a new update.',
      icon: 'icons/icon.svg',
      badge: 'icons/icon.svg',
      data: { url: data.url || 'Dashboard.html' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || 'Dashboard.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) { client.navigate(target); return client.focus(); }
      }
      return self.clients.openWindow(target);
    })
  );
});