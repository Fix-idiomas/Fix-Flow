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

// Handle push events and show a notification (works for notification or data payloads)
self.addEventListener("push", (event) => {
  try {
    const payload = event.data?.json?.() ?? {};
    const notif = payload.notification || payload;
    const title = notif.title || "Fix Flow";
    const body = notif.body || "";
    const link = (payload.webpush && payload.webpush.fcmOptions && payload.webpush.fcmOptions.link)
      || (payload.fcmOptions && payload.fcmOptions.link)
      || notif.click_action
      || payload.link
      || "/";

    const options = {
      body,
      // icon: notif.icon || "/icons/icon-192.png", // add if you have an icon in public/
      data: { link },
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    event.waitUntil(self.registration.showNotification("Fix Flow", { body: "" }));
  }
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
