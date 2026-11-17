import type { QueryClient } from '@tanstack/react-query'
import { gql } from 'graphql-request'
import { request } from 'utils/indexer-request'
import { subgraphUrl } from 'config/tcr-addresses'
import {
  getListOfListsAddresses,
  isListOfLists,
  succeededListOfLists,
} from 'config/list-of-lists'
import type { TrustStatus } from 'pages/dashboard/types'

/*
 * One rule for "Kleros Verified", shared by the dashboard, Browse, the
 * registry pages, the profile and the landing page: a registry is Kleros
 * Verified when it is the chain's Kleros list of lists (the Standard one in
 * config/list-of-lists.ts), or an entry on it (Registered, or Registered
 * with a removal request still open: it stays on the list until that
 * request is executed), and then carries the approval seal
 * (verified-badge.tsx); a retired Classic list on it is not. Every other
 * list is a Community list.
 *
 * A chain's set is one small read (the list of lists' Registered entries,
 * a few dozen rows, paged). This module holds no React, so the landing page
 * can use it; the hooks (registry-shared-verified.ts) cache it per chain.
 */

const ADDRESS = /^0x[a-fA-F0-9]{40}$/

/**
 * The label of the field a Kleros list of lists holds a list's address in:
 * its only column ("Address", type GTCR address) on every chain.
 */
export const LIST_OF_LISTS_ADDRESS_LABEL = 'Address'

/**
 * The registry a Standard entry of a list of lists points to: the value of its
 * field labelled like the list's GTCR address column, which is the field
 * its row and its page show (lowercase, or null).
 *
 * Nothing else may decide it. A Standard entry is a file its submitter writes,
 * columns included, and the indexer keeps every one of them: an extra
 * column whose label sorts first, or an address in the file's name, would
 * otherwise send the seal or the "Open list" link to a list the entry does
 * not show. An entry the indexer has no fields for points to nothing.
 */
export const listOfListsEntryAddress = (
  fields?: ({ label?: unknown; value?: unknown } | null | undefined)[] | null,
  label: string = LIST_OF_LISTS_ADDRESS_LABEL,
): string | null => {
  const value = fields?.find((field) => field?.label === label)?.value
  return typeof value === 'string' && ADDRESS.test(value)
    ? value.toLowerCase()
    : null
}

const PAGE = 500
/** Pages read at most (a few dozen entries today): a bound, not a guess. */
const MAX_PAGES = 20
/** How long one page may take before the read counts as failed. */
const PAGE_TIMEOUT_MS = 10_000

/** The list of lists' entries that are on it (Standard LItem), a page. */
const VERIFIED_REGISTRIES_QUERY = gql`
  query VerifiedRegistries(
    $chainId: Int!
    $listsOfLists: [String!]!
    $offset: Int!
  ) {
    verifiedStandard: LItem(
      limit: ${PAGE}
      offset: $offset
      order_by: [{ id: asc }]
      where: {
        chainId: { _eq: $chainId }
        registry_id: { _in: $listsOfLists }
        status: { _in: ["Registered", "ClearingRequested"] }
      }
    ) {
      id
      data
      registry_id
      props(order_by: { label: asc }) {
        label
        value
      }
    }
  }
`

/*
 * Which of the addresses the lists of lists hold are Classic lists. Classic
 * is retired (pages/classic-retired): a Classic list still registered on a
 * list of lists carries no seal, as no page counts it among the Kleros
 * Verified lists.
 */
const CLASSIC_AMONG_QUERY = gql`
  query ClassicAmong($ids: [String!]!) {
    classic: Registry(where: { id: { _in: $ids } }) {
      id
    }
  }
`

interface VerifiedEntry {
  data?: string | null
  props?: { label?: unknown; value?: unknown }[] | null
}

interface VerifiedRegistriesResult {
  verifiedStandard?: VerifiedEntry[] | null
}

/** The registries the list of lists vouches for, plus the list itself. */
export const verifiedSetFrom = (
  chainId: number,
  entries: VerifiedEntry[],
): Set<string> => {
  const verified = new Set(getListOfListsAddresses(chainId))
  for (const entry of entries) {
    const address = listOfListsEntryAddress(entry.props)
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
 * Every Kleros Verified registry on a chain, lowercase (Classic lists left
 * out). Throws when the
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
    const standard = result.verifiedStandard ?? []
    entries.push(...standard)
    if (standard.length < PAGE) break
  }
  const verified = verifiedSetFrom(chainId, entries)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS)
  try {
    const { classic } = await request<{ classic?: { id: string }[] | null }>({
      url,
      document: CLASSIC_AMONG_QUERY,
      variables: { ids: [...verified] },
      signal: controller.signal,
    })
    for (const { id } of classic ?? []) verified.delete(id.toLowerCase())
  } finally {
    clearTimeout(timer)
  }
  return [...verified]
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
 * Whether a registry is one of the Kleros Verified lists that pages list and
 * count: Verified by the rule, the lists of lists themselves aside. They
 * grant the badge and carry it on their own pages and rows, but counting
 * them with the lists they accepted counts the verifier among its verdicts
 * (13 "Kleros Verified lists" where Kleros vouched for 11). Browse shows
 * them under All and links them from its "Get Kleros Verified" panel.
 */
export const countsAsVerifiedList = (registry: {
  chainId: number
  address: string
  trustStatus: TrustStatus
}): boolean =>
  registry.trustStatus === 'verified' &&
  !isListOfLists(registry.chainId, registry.address)

/**
 * Whether a registry is a Community list that pages list and count: not
 * Kleros Verified, and not a former Kleros list of lists, which grants
 * nothing any more but is Kleros' own, so it sits under All only, as the
 * lists of lists do.
 */
export const countsAsCommunityList = (registry: {
  chainId: number
  address: string
  trustStatus: TrustStatus
}): boolean =>
  registry.trustStatus === 'unverified' &&
  !succeededListOfLists(registry.chainId, registry.address)

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
