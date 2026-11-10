import {
  type AppKitNetwork,
  mainnet as mainnetBase,
  gnosis as gnosisBase,
  sepolia,
} from '@reown/appkit/networks'

// The chain's default public node (eth.merkle.io) refuses browser requests:
// it answers the CORS preflight with 405, so the Ethereum fallback behind
// Alchemy failed in every browser. dRPC's public node allows browser
// requests and archive reads (eth_getLogs is capped at 10,000 blocks).
const ETHEREUM_PUBLIC_RPC = 'https://eth.drpc.org'

export const mainnet = {
  ...mainnetBase,
  rpcUrls: {
    ...mainnetBase.rpcUrls,
    default: { http: [ETHEREUM_PUBLIC_RPC] },
  },
}

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
  const currency = chain?.nativeCurrency ?? {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  }
  // viem spells Gnosis's coin "XDAI"; the app (useNativeCurrency) and the
  // Kleros docs write xDAI, so every page shows the same symbol.
  return currency.symbol === 'XDAI' ? { ...currency, symbol: 'xDAI' } : currency
}

export { sepolia }
export type { AppKitNetwork }
