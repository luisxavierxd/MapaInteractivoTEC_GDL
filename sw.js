/* ============================================================
   sw.js — Service worker · Borrego Merodeador
   Estrategia mixta (Fase 8.2):
     · Cache-first para el app shell.
     · Stale-while-revalidate para tiles, con caché dedicada
       y límite LRU de ~300 entradas.
   ============================================================ */
const VERSION = 'bm-v1';
const SHELL_CACHE = `shell-${VERSION}`;
const TILE_CACHE  = 'tiles';
const TILE_MAX = 300;

const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './assets/css/tokens.css', './assets/css/style.css',
  './assets/js/map.js', './assets/js/router.js',
  './data/campus.geojson', './data/paths.geojson',
  './assets/img/icon-192.png', './assets/img/icon-512.png',
];
const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js',
  'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js',
];

const isTile = (url) => /basemaps\.cartocdn\.com|server\.arcgisonline\.com/.test(url);

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(SHELL);                                  // mismo origen: debe existir
    await Promise.allSettled(CDN.map(u => cache.add(u)));       // CDN: best-effort
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, TILE_CACHE]);
    for (const k of await caches.keys()) if (!keep.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function trimTiles() {
  const cache = await caches.open(TILE_CACHE);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - TILE_MAX; i++) await cache.delete(keys[i]); // LRU manual
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = req.url;

  // Tiles → stale-while-revalidate
  if (isTile(url)) {
    e.respondWith((async () => {
      const cache = await caches.open(TILE_CACHE);
      const cached = await cache.match(req);
      const network = fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) { cache.put(req, res.clone()); trimTiles(); }
        return res;
      }).catch(() => null);
      return cached || (await network) || Response.error();
    })());
    return;
  }

  // App shell + CDN → cache-first con revalidación en segundo plano
  if (SHELL.some(s => url.endsWith(s.replace('./', '/')) || url.endsWith(s.slice(1))) || CDN.includes(url) || req.mode === 'navigate') {
    e.respondWith((async () => {
      const cached = await caches.match(req, { ignoreSearch: false });
      if (cached) {
        fetch(req).then(res => { if (res && res.ok) caches.open(SHELL_CACHE).then(c => c.put(req, res.clone())); }).catch(() => {});
        return cached;
      }
      try {
        const res = await fetch(req);
        return res;
      } catch {
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      }
    })());
  }
});
