const fs = require('fs');
const path = require('path');

function wf(p, c) {
  const d = path.dirname(p);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(p, c, 'utf8');
  console.log('[OK] ' + p);
}

console.log('=== generate-v2: ClassHub ===');

// === PART SW FIX: HTML SELALU FRESH, CACHE LAMA DIBUANG ===

wf('public/sw.js', `var CACHE = 'classhub-v2';

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var accept = e.request.headers.get('accept') || '';
  if (accept.indexOf('text/html') !== -1) return;
  e.respondWith(
    fetch(e.request)
      .then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) {
          c.put(e.request, copy);
        }).catch(function () {});
        return res;
      })
      .catch(function () {
        return caches.match(e.request);
      })
  );
});
`);

console.log('[OK] Part SW Fix done: HTML selalu fresh');