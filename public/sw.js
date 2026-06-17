self.addEventListener('push', (event) => {
  if (!event.data) return

  let data = {}
  try { data = event.data.json() } catch { data = { title: 'dropathot', body: event.data.text() } }

  const title = data.title ?? 'dropathot'
  const options = {
    body: data.body ?? '',
    icon: data.icon ?? '/favicon.svg',
    badge: '/favicon.svg',
    data: { url: data.url ?? '/' },
    vibrate: [100, 50, 100],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
