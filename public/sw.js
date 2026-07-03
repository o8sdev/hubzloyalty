// Minimal service worker: makes the app installable and shows a friendly
// offline page for navigations. Deliberately does NOT cache API responses or
// pages — this is an online tool; stale data at a counter is worse than a
// clear offline notice.
const OFFLINE_URL = "/offline.html";
const CACHE = "lcrm-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(OFFLINE_URL).then((hit) => hit ?? Response.error())
    )
  );
});
