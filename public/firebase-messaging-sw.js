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

// Optional: focus the client when a notification is clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification?.data?.link || event.notification?.data?.url;
  event.waitUntil((async () => {
    if (urlToOpen) {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const matching = allClients.find((c) => c.url.includes(urlToOpen));
      if (matching) return matching.focus();
      return self.clients.openWindow(urlToOpen);
    }
  })());
});
