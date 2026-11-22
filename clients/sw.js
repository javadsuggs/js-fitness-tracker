/*
  Offline helper for the client tracker and the trainer dashboard.
  Always tries the network first, so updates and new logs show right away.
  When there is no signal, it falls back to the last copy saved on this device.
  It never touches saves (POST requests): those always go straight to the sheet.
*/
var CACHE = 'tracker-v1';
var CHART_LIB = 'https://cdnjs.cloudflare.com/';
var SHEET_HOSTS = ['script.google.com', 'script.googleusercontent.com'];

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('tracker-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// The pages add ?t=<time> to data links so they never get a stale copy. Drop it for the saved copy's name.
function keyFor(req) {
  var u = new URL(req.url);
  u.searchParams.delete('t');
  return u.href;
}

function networkFirst(req) {
  var key = keyFor(req);
  return fetch(req).then(function (res) {
    if (res && (res.ok || res.type === 'opaque')) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { return c.put(key, copy); });
    }
    return res;
  }).catch(function (err) {
    return caches.open(CACHE).then(function (c) { return c.match(key); }).then(function (hit) {
      if (hit) return hit;
      throw err;
    });
  });
}

function cacheFirst(req) {
  return caches.open(CACHE).then(function (c) {
    return c.match(req.url).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) c.put(req.url, res.clone());
        return res;
      });
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var u = new URL(req.url);
  if (req.url.indexOf(CHART_LIB) === 0) return e.respondWith(cacheFirst(req));
  var scope = new URL(self.registration.scope);
  var mine = u.origin === location.origin && (u.pathname.indexOf(scope.pathname) === 0 || u.pathname.indexOf('/clients/') > -1);
  if (mine || SHEET_HOSTS.indexOf(u.hostname) > -1) return e.respondWith(networkFirst(req));
});
