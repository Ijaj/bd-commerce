/* ShopName service worker (C28). Hand-written, no library.
   - precache: offline page + icons
   - cache-first: /_next/static/* (content-hashed) and product images (imgproxy), bounded
   - network-first for page navigations, falling back to /offline.html
   - everything else (API, cart, checkout, account JSON) is left to the network, never cached.
   Bump VERSION to drop old caches on the next activate. */
const VERSION = 'v1';
const PRECACHE = `bdc-precache-${VERSION}`;
const STATIC = `bdc-static-${VERSION}`;
const IMAGES = `bdc-images-${VERSION}`;
const CURRENT = [PRECACHE, STATIC, IMAGES];
const MAX_IMAGES = 150;
const MAX_STATIC = 120;
const PRECACHE_URLS = ['/offline.html', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((c) => c.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('bdc-') && !CURRENT.includes(k))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Drops the oldest entries (insertion order) beyond `max`. */
async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function cacheFirst(request, name, max) {
  const cache = await caches.open(name);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  // Opaque (cross-origin no-cors image) responses have status 0 and are fine to keep.
  if (res.ok || res.type === 'opaque') {
    await cache.put(request, res.clone());
    await trim(cache, max);
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // The whole API is network-only; this is what keeps /v1/customer, /v1/cart and /v1/checkout uncached.
  if (url.origin === self.location.origin && url.pathname.startsWith('/v1/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC, MAX_STATIC));
    return;
  }

  if (request.destination === 'image' && url.protocol.startsWith('http')) {
    event.respondWith(cacheFirst(request, IMAGES, MAX_IMAGES).catch(() => fetch(request)));
  }
});
