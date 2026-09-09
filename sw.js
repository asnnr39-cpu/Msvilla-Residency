// ms-villa-app / sw.js
//
// Two jobs:
//   1. Cache the app shell so it opens instantly (and still opens at all
//      when offline) — a network-first strategy so residents always get
//      the latest build the moment they're online, falling back to cache
//      when they're not.
//   2. Receive Web Push events from netlify/functions/send-notification.js
//      (directly, or via scheduled-reminders.js) and show them as OS
//      notifications, even when the app isn't open.

const CACHE_NAME = "ms-villa-cache-v2";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/database.js",
  "/auth.js",
  "/admin.js",
  "/notifications.js",
  "/app.js",
  "/icon-192.png",
  "/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Never cache calls to the shared data/notification functions — they
  // must always hit the network so residents see live, shared state.
  if (request.url.includes("/.netlify/functions/")) return;
  if (request.method !== "GET") return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/index.html")))
  );
});

self.addEventListener("push", (event) => {
  let payload = { title: "Ms Villa", body: "You have a new update." };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (e) { /* keep default payload */ }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: payload.data || {}
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data && event.notification.data.link;
  const target = link || "/index.html";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => "focus" in c);
      if (existing) { existing.focus(); if (link) existing.navigate(link); return; }
      return self.clients.openWindow(target);
    })
  );
});
