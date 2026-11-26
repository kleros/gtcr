import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import {
  fetchPolicyHistory,
  PolicyFetchMode,
  PolicyHistoryEntry,
  PolicyListKind,
} from 'utils/fetch-policy-history'

// v2: until 2026-11-26 a Standard list's history held its clearing files
// (odd ids) and a Stake list's lost every other policy; those cached
// answers are never read again.
const CACHE_KEY_PREFIX = 'policyHistory.v2'
const CACHE_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours
const LATEST_STALE_MS = 60 * 60 * 1000 // 1 hour

interface CachedEntry {
  data: PolicyHistoryEntry[]
  timestamp: number
}

const cacheKey = (
  chainId: number,
  address: string,
  kind: PolicyListKind,
  mode: PolicyFetchMode,
): string => `${CACHE_KEY_PREFIX}-${mode}-${kind}-${chainId}-${address}`

const getCachedEntry = (
  chainId: number,
  address: string,
  kind: PolicyListKind,
  mode: PolicyFetchMode,
): CachedEntry | null => {
  try {
    const key = cacheKey(chainId, address, kind, mode)
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed: CachedEntry = JSON.parse(raw)
    if (Date.now() - parsed.timestamp > CACHE_EXPIRY) {
      localStorage.removeItem(key)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

/** The key the cache used before v2, followed by `-{mode}-…`. */
const FORMER_PREFIX = 'policyHistory-'

let swept = false

/**
 * Entries nothing reads any more go, once a page load, before the first
 * write: every one under the former key (`policyHistory-…`, never read again
 * since v2), and v2 entries past their day, which are otherwise removed only
 * when their list is opened again. Hundreds of lists browsed would keep
 * taking the origin's storage, which drafts and settings share.
 */
export const sweepPolicyCache = (now = Date.now()) => {
  if (swept) return
  swept = true
  try {
    const keys: string[] = []
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index)
      if (key) keys.push(key)
    }
    for (const key of keys) {
      if (key.startsWith(FORMER_PREFIX)) {
        localStorage.removeItem(key)
        continue
      }
      if (!key.startsWith(`${CACHE_KEY_PREFIX}-`)) continue
      let fresh = false
      try {
        const { timestamp } = JSON.parse(
          localStorage.getItem(key) ?? '',
        ) as CachedEntry
        fresh = now - timestamp <= CACHE_EXPIRY
      } catch {
        // Unreadable: nothing could use it.
      }
      if (!fresh) localStorage.removeItem(key)
    }
  } catch {
    // Storage blocked: there is nothing to sweep.
  }
}

/** For tests: the next write sweeps again. */
export const resetPolicyCacheSweep = () => {
  swept = false
}

const setCachedEntry = (
  chainId: number,
  address: string,
  kind: PolicyListKind,
  mode: PolicyFetchMode,
  data: PolicyHistoryEntry[],
) => {
  sweepPolicyCache()
  try {
    const entry: CachedEntry = { data, timestamp: Date.now() }
    localStorage.setItem(
      cacheKey(chainId, address, kind, mode),
      JSON.stringify(entry),
    )
  } catch (err) {
    console.error('Error caching policy history:', err)
  }
}

/**
 * The kind of list a router has found, for the policy history; undefined
 * while it is still looking (or for a retired Classic list, which shows no
 * policy), so nothing is read with the wrong kind.
 */
export const policyKindOf = ({
  checking,
  isStandardCurate,
  isPermanentCurate,
}: {
  checking: boolean
  isStandardCurate: boolean
  isPermanentCurate: boolean
}): PolicyListKind | undefined =>
  checking
    ? undefined
    : isPermanentCurate
      ? 'permanent'
      : isStandardCurate
        ? 'standard'
        : undefined

/**
 * Returns the policy history for a registry.
 *
 * @param registryAddress - The TCR / StandardTCR / PermanentTCR address.
 * @param chainId - Chain ID of the registry.
 * @param kind - Standard or Stake: which MetaEvidence events are the policy
 *   (fetch-policy-history isPolicyLog). Nothing is read until it is known.
 * @param mode
 *   - `'full'` (default): every policy ever. Used by the Previous Policies
 *     modal and the attachment display's past-policy banner.
 *   - `'latest'`: a single-entry array with the current active policy.
 *
 * When `'latest'` is requested and a fresh `'full'` cache exists, the current
 * entry is derived from it without any network call.
 */
export function usePolicyHistory(
  registryAddress: string | undefined,
  chainId: number | undefined,
  kind: PolicyListKind | undefined,
  mode: PolicyFetchMode = 'full',
) {
  const normalized = registryAddress?.toLowerCase()
  const enabled = !!normalized && typeof chainId === 'number' && !!kind

  const cachedEntry = useMemo(
    () => (enabled ? getCachedEntry(chainId, normalized, kind, mode) : null),
    [enabled, chainId, normalized, kind, mode],
  )

  return useQuery({
    queryKey: ['policyHistory', chainId, normalized, kind, mode],
    queryFn: async (): Promise<PolicyHistoryEntry[]> => {
      if (!enabled) return []

      // Cross-mode reuse: if the 'full' cache is fresh within the 'latest'
      // staleness window, derive 'latest' from it for free instead of doing
      // another RPC scan. Bounded by LATEST_STALE_MS (not CACHE_EXPIRY) so
      // we don't serve day-old derived data as a fresh 'latest' refetch.
      if (mode === 'latest') {
        const fullCached = getCachedEntry(chainId, normalized, kind, 'full')
        if (fullCached && Date.now() - fullCached.timestamp < LATEST_STALE_MS) {
          const current = fullCached.data.find((e) => e.endDate === null)
          const derived = current ? [current] : []
          setCachedEntry(chainId, normalized, kind, 'latest', derived)
          return derived
        }
      }

      const entries = await fetchPolicyHistory(normalized, chainId, kind, mode)
      setCachedEntry(chainId, normalized, kind, mode, entries)

      // Write-through: a fresh 'full' fetch also warms the 'latest' cache.
      if (mode === 'full' && entries.length > 0) {
        const current = entries.find((e) => e.endDate === null)
        if (current)
          setCachedEntry(chainId, normalized, kind, 'latest', [current])
      }

      return entries
    },
    enabled,
    initialData: cachedEntry?.data,
    initialDataUpdatedAt: cachedEntry?.timestamp,
    // 'latest' is cheaper and refreshes the badge roughly hourly;
    // 'full' is expensive and stable for the whole cache lifetime.
    staleTime: mode === 'latest' ? LATEST_STALE_MS : CACHE_EXPIRY,
    gcTime: CACHE_EXPIRY,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })
}
