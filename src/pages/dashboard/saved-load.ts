import { useEffect, useState } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import localforage from 'localforage'
import { DASHBOARD_QUERY_KEY, TESTNET_DASHBOARD_QUERY_KEY } from './query'
import type { DashboardData } from './types'

/*
 * The dashboard load, kept across page loads. It is the app's heaviest read
 * (both indexers, the rulings ledger, a few hundred list files) and the
 * indexer's request limit is shared by every visitor, so a reload, a second
 * tab, or the step from the landing page into the app should not pay for it
 * again while it is still fresh. The pages already say when what they show
 * is not live (query.ts: isLiveLoad), so an older saved load paints at once,
 * labelled with its time, while the refresh runs.
 *
 * It lives in IndexedDB (most of a megabyte: too much to parse out of
 * localStorage on every page). A saved load is read back only by the build
 * that wrote it (its shape can change between releases) and for a day at
 * most. A partial load, with a chain missing, is never kept: the next visit
 * should ask again.
 */

const PREFIX = 'curate:dashboard-load:'
const MAX_AGE_MS = 24 * 60 * 60_000
/** Storage that never answers must not hold a page back. */
const SEED_TIMEOUT_MS = 500

const BUILD_ID: string = import.meta.env.VITE_BUILD_ID ?? 'dev'

interface SavedLoad {
  build?: string
  data?: DashboardData
}

export const readSavedLoad = async (
  name: string,
): Promise<DashboardData | undefined> => {
  try {
    const saved = await localforage.getItem<SavedLoad>(PREFIX + name)
    const data = saved?.data
    if (saved?.build !== BUILD_ID || typeof data?.generatedAt !== 'number')
      return undefined
    if (Date.now() - data.generatedAt > MAX_AGE_MS) return undefined
    return data
  } catch {
    return undefined
  }
}

export const saveLoad = (name: string, data: DashboardData | undefined) => {
  if (!data || data.failedChains.length > 0) return
  // Storage full or blocked: the load is simply not kept.
  void localforage
    .setItem<SavedLoad>(PREFIX + name, { build: BUILD_ID, data })
    .catch(() => undefined)
}

const SAVED_KEYS = [DASHBOARD_QUERY_KEY, TESTNET_DASHBOARD_QUERY_KEY]

let seeding: Promise<void> | undefined
let seeded = false

/**
 * Puts the saved loads into the query cache, each with its own age (so it
 * is refreshed only once stale), and from then on saves every complete load
 * the app reads. Runs once; later calls wait for the same seeding.
 */
export const seedSavedLoads = (queryClient: QueryClient): Promise<void> => {
  seeding ??= (async () => {
    queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'success') return
      // A load put into the cache by hand is the saved one itself.
      if (event.action.manual) return
      const [scope, name] = event.query.queryKey
      if (scope === DASHBOARD_QUERY_KEY[0] && typeof name === 'string')
        saveLoad(name, event.query.state.data as DashboardData | undefined)
    })
    await Promise.all(
      SAVED_KEYS.map(async (key) => {
        const saved = await readSavedLoad(key[1])
        if (saved && queryClient.getQueryData(key) === undefined)
          queryClient.setQueryData(key, saved, { updatedAt: saved.generatedAt })
      }),
    )
    seeded = true
  })()
  return seeding
}

/**
 * False until the saved loads have been looked up: a page holds its
 * dashboard query until then (`enabled`), so a saved load that is still
 * fresh is used instead of being fetched again.
 */
export const useSavedLoadsReady = (): boolean => {
  const queryClient = useQueryClient()
  const [ready, setReady] = useState(seeded)
  useEffect(() => {
    if (ready) return
    let live = true
    const markReady = () => {
      if (live) setReady(true)
    }
    const timer = window.setTimeout(markReady, SEED_TIMEOUT_MS)
    void (async () => {
      try {
        await seedSavedLoads(queryClient)
      } finally {
        markReady()
      }
    })()
    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [queryClient, ready])
  return ready
}
