/* Service worker: casca em cache-first, dados em network-first com fallback.
   Assim a app abre offline com os últimos eventos descarregados. */
var VERSAO = "gratislx-v1";
var CASCA = [
  "./",
  "./index.html",
  "./estilo.css",
  "./app.js",
  "./manifest.json",
  "./icone-192.png",
  "./icone-512.png",
  "./icone-maskable-512.png"
];

self.addEventListener("install", function (ev) {
  ev.waitUntil(
    caches.open(VERSAO).then(function (c) {
      return c.addAll(CASCA);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (ev) {
  ev.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.map(function (k) {
        return k === VERSAO ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (ev) {
  var req = ev.request;
  if (req.method !== "GET") return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Dados: tenta a rede primeiro (para apanhar atualizações), cai no cache.
  if (url.pathname.indexOf("/dados/") >= 0) {
    ev.respondWith(
      fetch(req).then(function (r) {
        var copia = r.clone();
        caches.open(VERSAO).then(function (c) { c.put(req, copia); });
        return r;
      }).catch(function () {
        return caches.match(req, { ignoreSearch: true });
      })
    );
    return;
  }

  // Casca: cache primeiro, rede em segundo plano.
  ev.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      var rede = fetch(req).then(function (r) {
        if (r && r.ok) {
          var copia = r.clone();
          caches.open(VERSAO).then(function (c) { c.put(req, copia); });
        }
        return r;
      }).catch(function () { return hit; });
      return hit || rede;
    })
  );
});
