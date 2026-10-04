self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim())
)
self.addEventListener("push", (event) => {
  let payload = {}
  try {
    payload = event.data?.json() ?? {}
  } catch {
    /* Show a safe fallback. */
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "CareRide", {
      body: payload.body || "You have a new update in CareRide.",
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      tag: payload.tag || "careride-update",
      data: { url: "/notifications" },
    })
  )
})
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const url = new URL("/notifications", self.location.origin).href
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })()
  )
})
