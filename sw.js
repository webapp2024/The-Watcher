/* The Watcher service worker — network-first เพื่อให้ได้เวอร์ชันล่าสุดเสมอเมื่อออนไลน์
   และมี cache สำรองให้เปิด shell ได้ตอนออฟไลน์ */
const CACHE = 'tw-v2';
const SHELL = [
  './',
  './index.html',
  './css/app.css',
  './js/api.js',
  './js/core.js',
  './js/dashboard.js',
  './js/categories.js',
  './js/plan.js',
  './js/purchase.js',
  './js/result.js',
  './js/report.js',
  './js/settings.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // เฉพาะ GET ภายในโดเมนเดียวกันเท่านั้นที่ใช้ cache (API ปล่อยผ่าน network ปกติ)
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((m) => m || caches.match('./index.html')))
  );
});
