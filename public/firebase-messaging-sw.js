self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: "Baumdienst Flow", body: event.data.text() };
  }

  const payload = data.notification ?? data.data ?? data;
  const title = payload.title ?? "Baumdienst Flow";
  const url = payload.url ?? payload.click_action ?? "/workzone";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body ?? "",
      icon: payload.icon ?? "/branding/logoholz.png",
      badge: payload.badge ?? "/branding/logoholz.png",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url ?? "/workzone", self.location.origin).href;

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
