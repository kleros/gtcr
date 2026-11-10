import type { QueryClient } from '@tanstack/react-query'
import { gql, request } from 'graphql-request'
import { subgraphUrl } from 'config/tcr-addresses'
import { getListOfListsAddresses } from 'config/list-of-lists'
import type { TrustStatus } from 'pages/dashboard/types'

/*
 * One rule for "Kleros Verified", shared by the dashboard, Browse, the
 * registry pages, the profile and the landing page: a registry is Kleros
 * Verified when it is one of the chain's Kleros lists of lists, or a
 * Registered entry of one. The lists of lists are the Light ones and the
 * older Classic ones (config/list-of-lists.ts: getListOfListsAddresses), and
 * a list registered on any of them carries the approval seal
 * (verified-badge.tsx). Every other list is a Community list.
 *
 * A chain's set is one small read (its lists of lists' Registered entries,
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

/** The lists of lists' Registered entries (Classic Item or Light LItem), a page. */
const VERIFIED_REGISTRIES_QUERY = gql`
  query VerifiedRegistries(
    $chainId: Int!
    $listsOfLists: [String!]!
    $offset: Int!
  ) {
    verifiedClassic: Item(
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
    }
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
  verifiedClassic?: VerifiedEntry[] | null
  verifiedLight?: VerifiedEntry[] | null
}

/** The registries the lists of lists vouch for, plus the lists themselves. */
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

/**
 * Every Kleros Verified registry on a chain, lowercase. Throws when the
 * indexer fails, so no page shows a trust mark it cannot back.
 */
export const fetchVerifiedRegistries = async (
  chainId: number,
): Promise<string[]> => {
  const listsOfLists = getListOfListsAddresses(chainId)
  if (listsOfLists.length === 0) return []
  const url = subgraphUrl[chainId]
  if (!url) throw new Error(`No indexer for chain ${chainId}`)
  const entries: VerifiedEntry[] = []
  for (let offset = 0; ; offset += PAGE) {
    const result = await request<VerifiedRegistriesResult>(
      url,
      VERIFIED_REGISTRIES_QUERY,
      { chainId, listsOfLists, offset },
    )
    const classic = result.verifiedClassic ?? []
    const light = result.verifiedLight ?? []
    entries.push(...classic, ...light)
    if (classic.length < PAGE && light.length < PAGE) break
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
