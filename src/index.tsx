import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './bootstrap/app'
import { onlyBackgroundLoadsPending } from './utils/background-preload'

/*
 * After a new release, a tab still running the previous one asks for page
 * chunks that no longer exist (the host answers with the app's HTML), so the
 * next page it opens fails to load. Load the new release instead, once: a
 * second failure within a minute is a real outage and reaches the error page.
 */
const RELOADED_AT_KEY = 'curate:reloaded-for-release'
window.addEventListener('vite:preloadError', (event) => {
  // Code loaded ahead of a likely click failed while nothing else was
  // loading: keep the page in view (utils/background-preload.ts).
  if (onlyBackgroundLoadsPending()) return
  try {
    const last = Number(sessionStorage.getItem(RELOADED_AT_KEY)) || 0
    if (Date.now() - last < 60_000) return
    sessionStorage.setItem(RELOADED_AT_KEY, String(Date.now()))
  } catch {
    return // No session storage: no way to tell a reload loop apart.
  }
  event.preventDefault()
  window.location.reload()
})

const container = document.querySelector('#root')
if (!container) throw new Error('Root element #root not found')
const root = createRoot(container)
root.render(<App />)
