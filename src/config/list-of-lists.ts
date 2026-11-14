import { NETWORKS } from './networks'

/**
 * The Kleros lists of lists on Light Curate, where new lists are submitted
 * for the Kleros Verified badge. They alone grant it.
 */
export const VERIFIED_LIST_OF_LISTS_ADDRESSES = {
  [NETWORKS.ethereum]: '0x2acf59a420ca888f46d46974f62570f8a38cd4da',
  [NETWORKS.gnosis]: '0x2418d887d0d0fe03b793a6af4321fa488226a0b5',
  [NETWORKS.sepolia]: '0xd965ce430afe0423ff19a5eb08f7c5722efabcaf',
} as const

/**
 * The Classic lists of lists Kleros used before it moved to the Light ones
 * above (the app's homepages switched on 11 Aug 2026). The lists it still
 * vouches for were registered again on the new ones; the rest were not, and
 * had been idle for a year or more. The contracts still take submissions, so
 * being registered on one makes no list Kleros Verified, and their pages
 * send submitters to the new list of lists.
 */
const RETIRED_LIST_OF_LISTS_ADDRESSES = {
  [NETWORKS.ethereum]: '0xba0304273a54dfec1fc7f4bccbf4b15519aecf15',
  [NETWORKS.gnosis]: '0x2442d40b0aecad0298c2724a97f2f1bbdf2c2615',
} as const

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
