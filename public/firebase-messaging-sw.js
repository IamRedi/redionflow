self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: "Workzone", body: event.data.text() };
  }

  const payload = { ...(data.data ?? data), ...(data.notification ?? {}) };
  const title = payload.title ?? "Workzone";
  const url = payload.url ?? payload.click_action ?? "/workzone";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body ?? "",
      icon: payload.icon ?? "/app-icon/192",
      badge: payload.badge ?? "/app-icon/192",
      tag: payload.tag,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let targetUrl = new URL('/workzone', self.location.origin).href;
  try { const target = new URL(event.notification.data?.url ?? '/workzone', self.location.origin); if (target.origin === self.location.origin) targetUrl = target.href; } catch { /* Keep the authenticated Workzone destination. */ }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
