var CACHE = 'classhub-v4';

self.addEventListener('install', function (e) {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigasi (halaman): WAJIB network-first, jangan pernah respondWith(undefined)
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
          return res;
        })
        .catch(function () {
          return caches.match(req).then(function (m) {
            return m || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
          });
        })
    );
    return;
  }

  // Aset statis: cache-first + update di belakang
  if (/\.(png|jpg|jpeg|webp|svg|ico|css|js|woff2?)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(function (cached) {
        var network = fetch(req)
          .then(function (res) {
            if (res.ok) {
              var copy = res.clone();
              caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
            }
            return res;
          })
          .catch(function () { return cached; });
        return cached || network;
      })
    );
  }
});

self.addEventListener('push', function (e) {
  if (!e.data) return;
  var data = e.data.json();
  var title = data.title || 'ClassHub';
  var options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/dashboard' },
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = e.notification.data && e.notification.data.url ? e.notification.data.url : '/dashboard';
  e.waitUntil(clients.openWindow(url));
});
