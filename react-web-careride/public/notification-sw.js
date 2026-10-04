self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const path = event.notification.data?.path
  if (typeof path !== "string" || !/^\/rides\/[a-zA-Z0-9_-]+$/.test(path)) return
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      const matching = windows.find((window) => new URL(window.url).origin === self.location.origin)
      if (matching) {
        await matching.focus()
        return matching.navigate(path)
      }
      return clients.openWindow(path)
    })
  )
})
