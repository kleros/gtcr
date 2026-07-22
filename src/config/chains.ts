import {
  type AppKitNetwork,
  mainnet,
  gnosis as gnosisBase,
  sepolia,
} from '@reown/appkit/networks'

// Gnosisscan is being deprecated; override the chain default with the
// official Blockscout instance. Single source of truth for this URL —
// everything else derives from the `gnosis` object below.
const GNOSIS_BLOCKSCOUT_URL = 'https://gnosis.blockscout.com'

export const gnosis = {
  ...gnosisBase,
  blockExplorers: {
    default: {
      name: 'Blockscout',
      url: GNOSIS_BLOCKSCOUT_URL,
      apiUrl: `${GNOSIS_BLOCKSCOUT_URL}/api`,
    },
  },
}

// All chains supported by this app.
// Unlike kleros-v2 which is single-chain-at-a-time,
// gtcr supports all chains simultaneously via URL routing (/tcr/:chainId/:tcrAddress).
export const SUPPORTED_CHAINS: [AppKitNetwork, ...AppKitNetwork[]] = [
  mainnet,
  gnosis,
  sepolia,
]

export const DEFAULT_CHAIN = mainnet

/**
 * Look up a chain object by its numeric ID.
 */
export const getChainById = (
  chainId: number | string,
): AppKitNetwork | undefined =>
  SUPPORTED_CHAINS.find((chain) => chain.id === Number(chainId))

/**
 * Map of chain IDs to explorer base URLs, derived from the chain definitions.
 */
export const getExplorerUrl = (chainId: number | string): string => {
  const chain = getChainById(chainId)
  return chain?.blockExplorers?.default?.url ?? 'https://etherscan.io'
}

/**
 * Map of chain IDs to native currency info.
 */
export const getNativeCurrency = (
  chainId: number | string,
): { name: string; symbol: string; decimals: number } => {
  const chain = getChainById(chainId)
  return chain?.nativeCurrency ?? { name: 'Ether', symbol: 'ETH', decimals: 18 }
}

export { mainnet, sepolia }
export type { AppKitNetwork }
