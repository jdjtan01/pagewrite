/* Offline cache: serve from cache, refresh in the background. OCR files are cached the first time they are used. */
const CACHE = 'pagewright-v1';
const FILES = [
 "./",
 "index.html",
 "css/styles.css",
 "css/fonts.css",
 "js/app.js",
 "manifest.webmanifest",
 "icons/icon-192.png",
 "icons/icon-512.png",
 "vendor/jszip.min.js",
 "vendor/pdf-lib.min.js",
 "vendor/pdf.min.js",
 "vendor/pdf.worker.min.js",
 "fonts/allura-latin-400-normal.woff2",
 "fonts/bricolage-grotesque-latin-wght-normal.woff2",
 "fonts/caveat-latin-600-normal.woff2",
 "fonts/instrument-sans-latin-400-normal.woff2",
 "fonts/instrument-sans-latin-500-normal.woff2",
 "fonts/instrument-sans-latin-600-normal.woff2",
 "fonts/jetbrains-mono-latin-400-normal.woff2",
 "fonts/jetbrains-mono-latin-500-normal.woff2"
];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
