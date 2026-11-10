import { NETWORKS } from './networks'

/**
 * The Kleros lists of lists on Light Curate, where new lists are submitted
 * for the Kleros Verified badge.
 */
export const VERIFIED_LIST_OF_LISTS_ADDRESSES = {
  [NETWORKS.ethereum]: '0x2acf59a420ca888f46d46974f62570f8a38cd4da',
  [NETWORKS.gnosis]: '0x2418d887d0d0fe03b793a6af4321fa488226a0b5',
  [NETWORKS.sepolia]: '0xd965ce430afe0423ff19a5eb08f7c5722efabcaf',
} as const

/**
 * The older Kleros lists of lists on Classic Curate. They count the same as
 * the ones above: each is a Kleros list of lists, and the lists registered on
 * it are Kleros Verified.
 */
export const FALLBACK_LIST_OF_LISTS_ADDRESSES = {
  [NETWORKS.ethereum]: ['0xba0304273a54dfec1fc7f4bccbf4b15519aecf15'],
  [NETWORKS.gnosis]: [
    '0x2442d40b0aecad0298c2724a97f2f1bbdf2c2615',
    // Kept as on the live app. No contract is deployed at this address on
    // Gnosis, so it marks nothing; do not point anyone to it.
    '0xe456c79446c4de1a0ba4d06f294db42ba2fd4f7f',
  ],
} as const

/**
 * Every Kleros list of lists on a chain, Light and Classic, lowercase: the
 * lists that grant Kleros Verified (components/curate/verified-rule.ts).
 */
export const getListOfListsAddresses = (chainId: number): string[] => {
  const light: string | undefined =
    VERIFIED_LIST_OF_LISTS_ADDRESSES[
      chainId as keyof typeof VERIFIED_LIST_OF_LISTS_ADDRESSES
    ]
  const classic: readonly string[] =
    FALLBACK_LIST_OF_LISTS_ADDRESSES[
      chainId as keyof typeof FALLBACK_LIST_OF_LISTS_ADDRESSES
    ] ?? []
  return [
    ...new Set(
      [light, ...classic]
        .filter((address): address is string => !!address)
        .map((address) => address.toLowerCase()),
    ),
  ]
}

/** True when `address` is one of the chain's Kleros lists of lists. */
export const isListOfLists = (
  chainId: number | null | undefined,
  address: string | null | undefined,
): boolean =>
  !!chainId &&
  !!address &&
  getListOfListsAddresses(chainId).includes(address.toLowerCase())
