const VERSION = "serenitype-v2.0.4";
const SHELL = [
  "/", "/index.html", "/styles/app.css", "/src/app.js", "/src/core/store.js", "/src/core/api.js", "/src/core/transitions.js",
  "/src/core/audio.js", "/src/core/garden.js", "/src/experiences/typing.js", "/src/experiences/focus.js",
  "/src/experiences/breathe.js", "/src/experiences/reflect.js", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const request = event.request; if (request.method !== "GET") return; const url = new URL(request.url); if (url.origin !== location.origin || url.pathname.startsWith("/api/") || url.pathname.endsWith(".mp3")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => { const copy = response.clone(); caches.open(VERSION).then((cache) => cache.put(request, copy)); return response; }).catch(() => caches.match(request).then((cached) => cached || caches.match("/index.html"))));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => { if (response.ok) { const copy = response.clone(); caches.open(VERSION).then((cache) => cache.put(request, copy)); } return response; })));
});
