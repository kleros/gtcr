import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { isListOfLists } from 'config/list-of-lists'
import { verifiedRegistriesQuery, type VerifiedSets } from './verified-rule'

/*
 * The Kleros Verified rule (verified-rule.ts) for React pages: one chain's
 * set, cached per chain for ten minutes and shared by every page that asks.
 * The rule's plain helpers are re-exported here.
 */

export * from './verified-rule'

/**
 * The sets for several chains in React: `pending` until every chain has
 * answered or failed, `failed` lists the chains that did not answer, and
 * `retry` asks those again.
 */
export const useVerifiedSets = (
  chainIds: number[],
): {
  sets: VerifiedSets
  pending: boolean
  failed: number[]
  /** Asks the chains that failed again. */
  retry: () => void
} => {
  const results = useQueries({
    queries: chainIds.map((chainId) => verifiedRegistriesQuery(chainId)),
  })
  const stamp = results
    .map((result, index) => `${chainIds[index]}:${result.dataUpdatedAt}`)
    .join(',')
  const sets = useMemo(
    () =>
      new Map(
        results.flatMap((result, index) =>
          result.data ? [[chainIds[index], new Set(result.data)] as const] : [],
        ),
      ),
    // The data changes only when a chain's dataUpdatedAt does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stamp],
  )
  return {
    sets,
    pending: results.some((result) => result.isPending),
    failed: chainIds.filter(
      (_, index) => results[index].isError && !results[index].data,
    ),
    retry: () => {
      results.forEach((result) => {
        if (result.isError) void result.refetch()
      })
    },
  }
}

export interface RegistryTrust {
  /**
   * True (Kleros Verified) or false (Community) once known; undefined while
   * loading or after a failure.
   */
  verified?: boolean
  /** The registry is one of the chain's Kleros lists of lists. */
  listOfLists: boolean
  /**
   * The chain's Kleros Verified registries, once read: a list of lists marks
   * the entries it vouches for with the seal.
   */
  verifiedSet?: ReadonlySet<string>
}

/** Whether one registry is Kleros Verified, by the shared rule. */
export const useRegistryVerified = (
  chainId: number | null | undefined,
  address: string | null | undefined,
): RegistryTrust => {
  const target = address?.toLowerCase()
  const listOfLists = isListOfLists(chainId, target)
  const query = useQuery({
    ...verifiedRegistriesQuery(chainId ?? 0),
    enabled: !!chainId && !!target,
  })
  const verifiedSet = useMemo(
    () => (query.data ? new Set(query.data) : undefined),
    [query.data],
  )

  if (!chainId || !target) return { listOfLists: false }
  if (listOfLists) return { verified: true, listOfLists, verifiedSet }
  if (verifiedSet)
    return { verified: verifiedSet.has(target), listOfLists, verifiedSet }
  return { listOfLists }
}
