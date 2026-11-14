/*
 * Page code loaded ahead of a likely click (hovering "Launch a list"). In a
 * tab still running the previous release that code is gone, and the reload
 * that fixes a failed page load (src/index.tsx) would throw away the page in
 * view, and anything typed into it, for a click that may never come. So a
 * failure while only such preloads are loading is let go. The click, if it
 * comes, is a navigation: its own load fails too and reloads the tab then.
 */

let inFlight = 0
let navigatedAt = 0

/** How long after a route change a failed load counts as that navigation's. */
const NAVIGATION_WINDOW_MS = 10_000

/** Loads a page's code ahead of a likely click, quietly. */
export const preloadInBackground = (load: () => Promise<unknown>): void => {
  inFlight += 1
  load()
    .finally(() => {
      inFlight -= 1
    })
    .catch(() => undefined)
}

/** Called on every route change. */
export const noteNavigation = (): void => {
  navigatedAt = Date.now()
}

/** Whether a failed load can only have been a background preload's. */
export const onlyBackgroundLoadsPending = (): boolean =>
  inFlight > 0 && Date.now() - navigatedAt > NAVIGATION_WINDOW_MS
