/* Service worker do Meus Plantões — v2
   A página busca a versão nova na rede primeiro (até 2,5s) e, se não
   conseguir, usa a guardada. Assim a atualização chega sozinha e o
   app continua abrindo offline. */
var CACHE = "plantoes-v2";
var TIMEOUT = 2500;
var ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) { return caches.delete(k); }
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function fromNetwork(req) {
  return new Promise(function (resolve, reject) {
    var done = false;
    var timer = setTimeout(function () {
      if (!done) { done = true; reject(new Error("timeout")); }
    }, TIMEOUT);
    fetch(req).then(function (res) {
      if (done) { return; }
      done = true;
      clearTimeout(timer);
      if (res && res.status === 200 && res.type === "basic") {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      resolve(res);
    }).catch(function (err) {
      if (done) { return; }
      done = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") { return; }

  var isPage = e.request.mode === "navigate" || e.request.destination === "document";

  if (isPage) {
    e.respondWith(
      fromNetwork(e.request).catch(function () {
        return caches.match(e.request).then(function (hit) {
          return hit || caches.match("./index.html");
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fromNetwork(e.request).catch(function () { return hit; });
    })
  );
});
