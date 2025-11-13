/*
  Firebase Cloud Messaging Service Worker (minimal)
  - Must be hosted at /firebase-messaging-sw.js
  - Required for getToken() and background messages.
  - You can enhance this later to show notifications from background messages.
*/

self.addEventListener("install", () => {
  self.skipWaiting?.();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients?.claim?.());
});

// Optional: handle push events if backend sends raw Web Push payloads
self.addEventListener("push", () => {
  // Intentionally empty for now.
});
