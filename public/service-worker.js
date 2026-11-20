/*
 * Removes the Create React App service worker that production registered
 * until Jan 2026. Browsers that installed it still run it and it keeps
 * serving them the precached 2025 app: its update check fetches this path,
 * and while the path answered with the app's HTML the browser refused that as
 * a worker script and kept the old one. This file is what the check now
 * finds. It takes over at once, unregisters itself, deletes every cache (the
 * current app keeps nothing in Cache Storage) and reloads each tab the old
 * worker served, which then loads the current app from the network. It has
 * no fetch handler, so it never serves anything itself. Nothing registers a
 * worker any more (src/bootstrap/service-worker.ts only unregisters), and
 * public/_headers serves this file with no-cache so the check always gets it.
 */
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.registration.unregister()
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
      const tabs = await self.clients.matchAll({ type: 'window' })
      await Promise.all(
        tabs.map((tab) =>
          // A browser without navigate() shows the current app on the next
          // reload: the worker is already gone.
          typeof tab.navigate === 'function'
            ? tab.navigate(tab.url).catch(() => undefined)
            : undefined,
        ),
      )
    })(),
  )
})
