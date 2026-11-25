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

/**
 * Code a page loads by itself while in view, not for a click (the evidence
 * Markdown renderer, once a description needs it), counted with the
 * preloads: in a tab on an older release its failure keeps the page, and a
 * draft in it, in view. The caller shows something else instead.
 */
export const loadInBackground = <T>(load: () => Promise<T>): Promise<T> => {
  inFlight += 1
  return load().finally(() => {
    inFlight -= 1
  })
}

/** Loads a page's code ahead of a likely click, quietly. */
export const preloadInBackground = (load: () => Promise<unknown>): void => {
  loadInBackground(load).catch(() => undefined)
}

/** Called on every route change. */
export const noteNavigation = (): void => {
  navigatedAt = Date.now()
}

/** Whether a failed load can only have been a background preload's. */
export const onlyBackgroundLoadsPending = (): boolean =>
  inFlight > 0 && Date.now() - navigatedAt > NAVIGATION_WINDOW_MS
