/*
 * sw.js — app-shell caching service worker (R17.3) [T3].
 *
 * Caches the app shell so the app opens offline. Routing needs a connection; API
 * calls are never cached and fail normally offline, which the UI surfaces as the
 * unreachable-backend notice. This is app-shell caching only — no data caching.
 */
const CACHE = "oasyn-shell-v1";
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

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Never cache API requests; let them hit the network (and fail offline).
  if (url.pathname.startsWith("/api/")) return;
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((res) => {
          // Cache same-origin shell assets as they are fetched.
          if (url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() => caches.match("/index.html"));
    }),
  );
});
