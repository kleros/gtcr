/*
 * The dashboard load (data.ts: fetchDashboardData) is shared under one key by
 * the dashboard, Browse, the curator profiles and the guide. It is the app's
 * heaviest read (both indexers, the rulings ledger), so it is refreshed every
 * few minutes while a page that shows it is on screen, and on focus only once
 * stale; never on a one-minute poll. The Sepolia testnet is a load of its own
 * (fetchTestnetDashboardData), read only when a page shows it. This module
 * holds no imports, so a page can name the keys without bundling the loader.
 */

/** The mainnet load ("All chains"): what every page opens on. */
export const DASHBOARD_QUERY_KEY = ['curateDashboard', 'mainnets'] as const

/** The Sepolia load, read only when a page shows the testnet. */
export const TESTNET_DASHBOARD_QUERY_KEY = [
  'curateDashboard',
  'testnet',
] as const

/** A load younger than this is reused as it is. */
export const DASHBOARD_STALE_MS = 5 * 60_000

/** How often a page on screen refreshes the load. */
export const DASHBOARD_REFRESH_MS = 5 * 60_000

/** How soon a load with a chain missing is asked for again. */
const PARTIAL_RETRY_MS = 60_000

/**
 * When a page on screen reads the load again: once it is
 * DASHBOARD_REFRESH_MS old. A load can arrive already aged (saved by an
 * earlier page load, see saved-load.ts), so the wait counts from the load's
 * own time, not from when this page opened.
 */
export const dashboardRefreshIn = (query: {
  state: { data?: { generatedAt?: number; failedChains?: unknown[] } }
}): number => {
  const generatedAt = query.state.data?.generatedAt
  if (typeof generatedAt !== 'number') return DASHBOARD_REFRESH_MS
  // A chain did not load (the page says so): ask again in a minute rather
  // than leave its lists out for the whole refresh period.
  if (query.state.data?.failedChains?.length) return PARTIAL_RETRY_MS
  const wait = generatedAt + DASHBOARD_REFRESH_MS - Date.now()
  // Overdue means the last refresh failed: try again in a minute, not at once.
  return wait > 0 ? Math.max(15_000, wait) : 60_000
}

/**
 * A load older than this is not called live: the page was in the
 * background, or the refresh is late (a minute of slack for the load itself).
 */
export const DASHBOARD_LIVE_MS = DASHBOARD_REFRESH_MS + 60_000

/** True while a load is recent enough to be called live. */
export const isLiveLoad = (generatedAt: number, nowSeconds: number) =>
  nowSeconds * 1000 - generatedAt <= DASHBOARD_LIVE_MS
