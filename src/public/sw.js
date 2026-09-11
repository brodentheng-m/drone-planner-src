const VERSION = 'drone-planner-v2';
const CACHE = VERSION + '-assets';
const SHELL_CACHE = VERSION + '-shell';
const OFFLINE_HTML = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline</title></head><body style="font-family:sans-serif;text-align:center;padding:40px;color:#333;"><h1>You are offline. Reconnect to run Drone Planner.</h1></body></html>';

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(SHELL_CACHE).then(function (c) {
    return c.addAll(['./']);
  }));
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) {
          return key.indexOf(VERSION) !== 0;
        }).map(function (key) {
          return caches.delete(key);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.destination === 'document') {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});

self.addEventListener('message', function (event) {
  const data = event.data || {};
  if (data.type === 'WARM' && Array.isArray(data.urls)) {
    event.waitUntil(caches.open(CACHE).then(function (cache) {
      return Promise.all(data.urls.map(function (u) {
        return cache.add(u).catch(function () {});
      }));
    }));
  }
});

function networkFirst(request) {
  return fetch(request).then(function (response) {
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(SHELL_CACHE).then(function (cache) {
        cache.put(request, copy);
      });
      return response;
    }
    throw new Error('network-failed');
  }).catch(function () {
    return caches.open(SHELL_CACHE).then(function (cache) {
      return cache.match(request).then(function (cached) {
        if (cached) return cached;
        return new Response(OFFLINE_HTML, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      });
    });
  });
}

function cacheFirst(request) {
  const network = fetch(request).then(function (response) {
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then(function (cache) {
        cache.put(request, copy);
      });
    }
    return response;
  });
  return caches.match(request).then(function (cached) {
    if (cached) {
      network.catch(function () {});
      return cached;
    }
    return network;
  });
}