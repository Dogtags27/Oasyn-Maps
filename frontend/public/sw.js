/*
 * sw.js — app-shell caching service worker (R17.3) [T3].
 *
 * Caches the app shell so the app opens offline. Routing needs a connection; API
 * calls are never cached and fail normally offline, which the UI surfaces as the
 * unreachable-backend notice. This is app-shell caching only — no data caching.
 *
 * Strategy:
 *  - Page navigations (HTML) are NETWORK-FIRST, falling back to the cached shell
 *    offline. Cache-first HTML would pin returning visitors to an old build (and
 *    an old API base URL) forever after a redeploy.
 *  - Content-hashed build assets (/assets/*) are cache-first: their URL changes
 *    whenever their content does, so a cached copy is never stale.
 *  - Cross-origin requests (API, map tiles) are not intercepted at all.
 */
const CACHE = "oasyn-shell-v2";
const SHELL = ["/", "/index.html", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

function putInCache(request, response) {
  if (!response || !response.ok) return;
  const copy = response.clone();
  caches.open(CACHE).then((cache) => cache.put(request, copy));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Only same-origin shell traffic; the API and tiles live on other origins.
  if (url.origin !== self.location.origin) return;
  // Never cache API requests, even if one is ever served same-origin.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          putInCache("/index.html", res);
          return res;
        })
        .catch(() => caches.match("/index.html")),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            putInCache(request, res);
            return res;
          }),
      ),
    );
    return;
  }

  // Everything else (manifest, icons, sw-adjacent files): network, cache fallback.
  event.respondWith(
    fetch(request)
      .then((res) => {
        putInCache(request, res);
        return res;
      })
      .catch(() => caches.match(request)),
  );
});
