/**
 * Service Worker for Push Notifications
 */

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Polyscope Alert';
  const options = {
    body: data.body || 'New prediction available',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: 'polyscope-notification',
    requireInteraction: true,
    data: data.data || {},
    actions: data.actions || [],
    timestamp: data.timestamp || Date.now()
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  const targetUrl = event.notification?.data?.url || '/';
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (let client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
