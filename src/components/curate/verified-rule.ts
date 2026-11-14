import type { QueryClient } from '@tanstack/react-query'
import { gql } from 'graphql-request'
import { request } from 'utils/indexer-request'
import { subgraphUrl } from 'config/tcr-addresses'
import { getListOfListsAddresses } from 'config/list-of-lists'
import type { TrustStatus } from 'pages/dashboard/types'

/*
 * One rule for "Kleros Verified", shared by the dashboard, Browse, the
 * registry pages, the profile and the landing page: a registry is Kleros
 * Verified when it is the chain's Kleros list of lists (the Light one in
 * config/list-of-lists.ts), or a Registered entry of it, and then carries
 * the approval seal (verified-badge.tsx). Every other list is a Community
 * list, the lists only on the retired Classic lists of lists included.
 *
 * A chain's set is one small read (the list of lists' Registered entries,
 * a few dozen rows, paged). This module holds no React, so the landing page
 * can use it; the hooks (registry-shared-verified.ts) cache it per chain.
 */

const ADDRESS = /^0x[a-fA-F0-9]{40}$/

/**
 * The registry address an entry of a list of lists points to: the first
 * address-shaped field of a Light entry, else the address in a Classic
 * entry's RLP data (0xd594 + 20 bytes), else the first address in the data.
 * Lowercase, or null.
 */
export const extractRegistryAddress = (
  value?: string | null,
  props?: ({ value?: unknown } | null | undefined)[] | null,
): string | null => {
  const propAddress = props
    ?.map((prop) => prop?.value)
    .find(
      (candidate): candidate is string =>
        typeof candidate === 'string' && ADDRESS.test(candidate),
    )
  if (propAddress) return propAddress.toLowerCase()

  if (!value) return null
  const encodedAddress = value.match(/0xd594([a-fA-F0-9]{40})/)
  if (encodedAddress) return `0x${encodedAddress[1]}`.toLowerCase()

  const rawAddress = value.match(/0x[a-fA-F0-9]{40}/)
  return rawAddress ? rawAddress[0].toLowerCase() : null
}

const PAGE = 500
/** Pages read at most (a few dozen entries today): a bound, not a guess. */
const MAX_PAGES = 20
/** How long one page may take before the read counts as failed. */
const PAGE_TIMEOUT_MS = 10_000

/** The list of lists' Registered entries (Light LItem), a page. */
const VERIFIED_REGISTRIES_QUERY = gql`
  query VerifiedRegistries(
    $chainId: Int!
    $listsOfLists: [String!]!
    $offset: Int!
  ) {
    verifiedLight: LItem(
      limit: ${PAGE}
      offset: $offset
      order_by: [{ id: asc }]
      where: {
        chainId: { _eq: $chainId }
        registry_id: { _in: $listsOfLists }
        status: { _eq: "Registered" }
      }
    ) {
      id
      data
      registry_id
      props(order_by: { label: asc }) {
        value
      }
    }
  }
`

interface VerifiedEntry {
  data?: string | null
  props?: { value?: unknown }[] | null
}

interface VerifiedRegistriesResult {
  verifiedLight?: VerifiedEntry[] | null
}

/** The registries the list of lists vouches for, plus the list itself. */
export const verifiedSetFrom = (
  chainId: number,
  entries: VerifiedEntry[],
): Set<string> => {
  const verified = new Set(getListOfListsAddresses(chainId))
  for (const entry of entries) {
    const address = extractRegistryAddress(entry.data, entry.props)
    if (address) verified.add(address)
  }
  return verified
}

/** One page, aborted past PAGE_TIMEOUT_MS so no page can wait on it forever. */
const readPage = async (
  url: string,
  variables: { chainId: number; listsOfLists: string[]; offset: number },
): Promise<VerifiedRegistriesResult> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS)
  try {
    return await request<VerifiedRegistriesResult>({
      url,
      document: VERIFIED_REGISTRIES_QUERY,
      variables,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Every Kleros Verified registry on a chain, lowercase. Throws when the
 * indexer fails, times out or pages past MAX_PAGES, so no page shows a trust
 * mark it cannot back.
 */
export const fetchVerifiedRegistries = async (
  chainId: number,
): Promise<string[]> => {
  const listsOfLists = getListOfListsAddresses(chainId)
  if (listsOfLists.length === 0) return []
  const url = subgraphUrl[chainId]
  if (!url) throw new Error(`No indexer for chain ${chainId}`)
  const entries: VerifiedEntry[] = []
  for (let page = 0; ; page += 1) {
    if (page >= MAX_PAGES)
      throw new Error(`Kleros Verified read past ${MAX_PAGES} pages`)
    const result = await readPage(url, {
      chainId,
      listsOfLists,
      offset: page * PAGE,
    })
    const light = result.verifiedLight ?? []
    entries.push(...light)
    if (light.length < PAGE) break
  }
  return [...verifiedSetFrom(chainId, entries)]
}

/** The shared query for one chain's set (registry pages, Browse, profile). */
export const verifiedRegistriesQuery = (chainId: number) => ({
  queryKey: ['verifiedRegistries', chainId] as const,
  queryFn: () => fetchVerifiedRegistries(chainId),
  staleTime: 10 * 60_000,
  retry: 1,
})

/** chainId → that chain's Kleros Verified registries (lowercase). */
export type VerifiedSets = ReadonlyMap<number, ReadonlySet<string>>

/**
 * The registries with their trust stamped by this rule: "verified",
 * "unverified" (Community), or "unknown" where their chain's set is not in
 * (loading or failed), so nothing is called Community without data.
 */
export const withVerified = <
  T extends { chainId: number; address: string; trustStatus: TrustStatus },
>(
  registries: T[],
  sets: VerifiedSets,
): T[] =>
  registries.map((registry) => {
    const set = sets.get(registry.chainId)
    const trustStatus: TrustStatus = !set
      ? 'unknown'
      : set.has(registry.address.toLowerCase())
        ? 'verified'
        : 'unverified'
    return registry.trustStatus === trustStatus
      ? registry
      : { ...registry, trustStatus }
  })

/**
 * The sets for several chains, read outside React. A chain whose read fails
 * is left out (its lists read as "unknown"). Pass a query client to share
 * the pages' cache.
 */
export const readVerifiedSets = async (
  chainIds: number[],
  queryClient?: QueryClient,
): Promise<VerifiedSets> => {
  const reads = await Promise.all(
    [...new Set(chainIds)].map(async (chainId) => {
      try {
        const addresses = queryClient
          ? await queryClient.fetchQuery(verifiedRegistriesQuery(chainId))
          : await fetchVerifiedRegistries(chainId)
        return [chainId, new Set(addresses)] as const
      } catch {
        return null
      }
    }),
  )
  return new Map(reads.filter((read) => read !== null))
}
