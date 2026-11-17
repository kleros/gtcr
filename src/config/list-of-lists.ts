import { NETWORKS } from './networks'

/**
 * The Kleros lists of lists on Standard Curate, where new lists are submitted
 * for the Kleros Verified badge. They alone grant it.
 */
export const VERIFIED_LIST_OF_LISTS_ADDRESSES = {
  [NETWORKS.ethereum]: '0x2acf59a420ca888f46d46974f62570f8a38cd4da',
  [NETWORKS.gnosis]: '0x5f688a4bac5e2787ef1d9de325831e537ee4cffa',
  [NETWORKS.sepolia]: '0xd965ce430afe0423ff19a5eb08f7c5722efabcaf',
} as const

/**
 * The Classic lists of lists Kleros used before it moved to the Standard ones
 * above (the app's homepages switched on 11 Aug 2026). The lists it still
 * vouches for were registered again on the new ones; the rest were not, and
 * had been idle for a year or more. Being registered on one makes no list
 * Kleros Verified; like every Classic list they show the retired page
 * (pages/classic-retired), which points to the new list of lists.
 */
const RETIRED_LIST_OF_LISTS_ADDRESSES = {
  [NETWORKS.ethereum]: '0xba0304273a54dfec1fc7f4bccbf4b15519aecf15',
  [NETWORKS.gnosis]: '0x2442d40b0aecad0298c2724a97f2f1bbdf2c2615',
} as const

/**
 * Standard lists of lists Kleros has replaced with the ones above. Gnosis
 * moved to 0x5f68…cffa on 17 Nov 2026. Its governor seeded it on 16 Nov
 * with the six Standard and Stake lists Verified on the old one, under
 * starter settings (Agent Skills, a retired Classic list, was left out),
 * then gave it the old list's settings: the same governor, court 19 with 3
 * jurors, 300 xDAI deposits and a 3.5-day challenge period. Its policy also
 * rejects lists that are not Standard (Light) or Stake.
 * A former list of lists keeps working on chain, but grants nothing: like
 * the lists of lists it is counted under All only, never as a Community
 * list, and its page shows no trust tag.
 */
const FORMER_LIST_OF_LISTS_ADDRESSES: Partial<Record<number, string>> = {
  [NETWORKS.gnosis]: '0x2418d887d0d0fe03b793a6af4321fa488226a0b5',
}

/**
 * The chain's current and former Kleros lists of lists, lowercase: where a
 * Verified list's first registration (the date it has held the badge since)
 * may sit. Only the current ones decide whether a list is Verified.
 */
export const getListOfListsHistory = (chainId: number): string[] => {
  const former = FORMER_LIST_OF_LISTS_ADDRESSES[chainId]
  return [...getListOfListsAddresses(chainId), ...(former ? [former] : [])]
}

/**
 * When `address` is a former Standard list of lists of the chain, the list
 * of lists that replaced it (lowercase); otherwise null.
 */
export const succeededListOfLists = (
  chainId: number | null | undefined,
  address: string | null | undefined,
): string | null => {
  if (!chainId || !address) return null
  if (FORMER_LIST_OF_LISTS_ADDRESSES[chainId] !== address.toLowerCase())
    return null
  return getListOfListsAddresses(chainId)[0] ?? null
}

/**
 * The chain's Kleros list of lists, lowercase, as a list (none on a chain
 * without one): the list that grants Kleros Verified
 * (components/curate/verified-rule.ts).
 */
export const getListOfListsAddresses = (chainId: number): string[] => {
  const address: string | undefined =
    VERIFIED_LIST_OF_LISTS_ADDRESSES[
      chainId as keyof typeof VERIFIED_LIST_OF_LISTS_ADDRESSES
    ]
  return address ? [address.toLowerCase()] : []
}

/** True when `address` is the chain's Kleros list of lists. */
export const isListOfLists = (
  chainId: number | null | undefined,
  address: string | null | undefined,
): boolean =>
  !!chainId &&
  !!address &&
  getListOfListsAddresses(chainId).includes(address.toLowerCase())

/**
 * When `address` is the chain's retired Classic list of lists, the list of
 * lists that replaced it (lowercase); otherwise null.
 */
export const replacedListOfLists = (
  chainId: number | null | undefined,
  address: string | null | undefined,
): string | null => {
  if (!chainId || !address) return null
  const retired: string | undefined =
    RETIRED_LIST_OF_LISTS_ADDRESSES[
      chainId as keyof typeof RETIRED_LIST_OF_LISTS_ADDRESSES
    ]
  if (retired !== address.toLowerCase()) return null
  return getListOfListsAddresses(chainId)[0] ?? null
}
