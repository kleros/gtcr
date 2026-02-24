import {
  mainnet,
  gnosis,
  sepolia,
  DEFAULT_CHAIN,
  getChainById,
  getExplorerUrl,
  getNativeCurrency,
} from './chains'

export const NETWORKS = Object.freeze({
  ethereum: mainnet.id,
  gnosis: gnosis.id,
  sepolia: sepolia.id,
})

export const DEFAULT_NETWORK = DEFAULT_CHAIN.id

/**
 * Chain metadata derived from @reown/appkit/networks definitions.
 * Replaces the old hand-maintained NETWORKS_INFO object and REACT_APP_RPC_URLS.
 */
export const NETWORKS_INFO = Object.freeze({
  [mainnet.id]: {
    name: mainnet.name,
    color: '#29b6af',
    chainId: mainnet.id,
    nativeCurrency: mainnet.nativeCurrency,
    rpc: mainnet.rpcUrls?.default?.http ?? [],
    explorers: [
      {
        name: mainnet.blockExplorers?.default?.name ?? 'Etherscan',
        url: mainnet.blockExplorers?.default?.url ?? 'https://etherscan.io',
      },
    ],
  },
  [gnosis.id]: {
    name: gnosis.name,
    color: '#E6A817',
    chainId: gnosis.id,
    nativeCurrency: gnosis.nativeCurrency,
    rpc: gnosis.rpcUrls?.default?.http ?? [],
    explorers: [
      {
        name: gnosis.blockExplorers?.default?.name ?? 'Gnosisscan',
        url: gnosis.blockExplorers?.default?.url ?? 'https://gnosisscan.io',
      },
    ],
  },
  [sepolia.id]: {
    name: sepolia.name,
    color: '#9B59B6',
    chainId: sepolia.id,
    nativeCurrency: sepolia.nativeCurrency,
    rpc: sepolia.rpcUrls?.default?.http ?? [],
    explorers: [
      {
        name: sepolia.blockExplorers?.default?.name ?? 'Etherscan',
        url:
          sepolia.blockExplorers?.default?.url ??
          'https://sepolia.etherscan.io',
      },
    ],
  },
})

export { getChainById, getExplorerUrl, getNativeCurrency }

export default NETWORKS_INFO
