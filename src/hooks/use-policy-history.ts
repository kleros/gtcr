import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import {
  fetchPolicyHistory,
  PolicyFetchMode,
  PolicyHistoryEntry,
} from 'utils/fetch-policy-history'

const CACHE_KEY_PREFIX = 'policyHistory'
const CACHE_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours
const LATEST_STALE_MS = 60 * 60 * 1000 // 1 hour

interface CachedEntry {
  data: PolicyHistoryEntry[]
  timestamp: number
}

const cacheKey = (
  chainId: number,
  address: string,
  mode: PolicyFetchMode,
): string =>
  mode === 'full'
    ? `${CACHE_KEY_PREFIX}-${chainId}-${address}`
    : `${CACHE_KEY_PREFIX}-${mode}-${chainId}-${address}`

const getCachedEntry = (
  chainId: number,
  address: string,
  mode: PolicyFetchMode,
): CachedEntry | null => {
  try {
    const key = cacheKey(chainId, address, mode)
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

const setCachedEntry = (
  chainId: number,
  address: string,
  mode: PolicyFetchMode,
  data: PolicyHistoryEntry[],
) => {
  try {
    const entry: CachedEntry = { data, timestamp: Date.now() }
    localStorage.setItem(
      cacheKey(chainId, address, mode),
      JSON.stringify(entry),
    )
  } catch (err) {
    console.error('Error caching policy history:', err)
  }
}

/**
 * Returns the registration-policy history for a registry.
 *
 * @param registryAddress - The TCR / LightTCR / PermanentTCR address.
 * @param chainId - Chain ID of the registry.
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
  mode: PolicyFetchMode = 'full',
) {
  const normalized = registryAddress?.toLowerCase()
  const enabled = !!normalized && typeof chainId === 'number'

  const cachedEntry = useMemo(
    () => (enabled ? getCachedEntry(chainId!, normalized!, mode) : null),
    [enabled, chainId, normalized, mode],
  )

  return useQuery({
    queryKey: ['policyHistory', chainId, normalized, mode],
    queryFn: async (): Promise<PolicyHistoryEntry[]> => {
      if (!enabled) return []

      // Cross-mode reuse: if the 'full' cache is fresh within the 'latest'
      // staleness window, derive 'latest' from it for free instead of doing
      // another RPC scan. Bounded by LATEST_STALE_MS (not CACHE_EXPIRY) so
      // we don't serve day-old derived data as a fresh 'latest' refetch.
      if (mode === 'latest') {
        const fullCached = getCachedEntry(chainId!, normalized!, 'full')
        if (fullCached && Date.now() - fullCached.timestamp < LATEST_STALE_MS) {
          const current = fullCached.data.find((e) => e.endDate === null)
          const derived = current ? [current] : []
          setCachedEntry(chainId!, normalized!, 'latest', derived)
          return derived
        }
      }

      const entries = await fetchPolicyHistory(normalized!, chainId!, mode)
      setCachedEntry(chainId!, normalized!, mode, entries)

      // Write-through: a fresh 'full' fetch also warms the 'latest' cache.
      if (mode === 'full' && entries.length > 0) {
        const current = entries.find((e) => e.endDate === null)
        if (current) setCachedEntry(chainId!, normalized!, 'latest', [current])
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
