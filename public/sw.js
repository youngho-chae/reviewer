/* CATCHPASS 서비스 워커 (2026-08-13) — 웹푸시 수신 전용.
   push 이벤트 → OS 알림 표시, 클릭 → 페이로드의 내부 링크로 이동(열린 탭 재사용). */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = { title: "CATCHPASS", body: "", link: "/" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { link: data.link || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
      for (const tab of tabs) {
        if ("focus" in tab) {
          tab.navigate(link);
          return tab.focus();
        }
      }
      return self.clients.openWindow(link);
    }),
  );
});
