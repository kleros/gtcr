import { http, type Transport } from 'wagmi'
import { mainnet, gnosis, sepolia, SUPPORTED_CHAINS } from './chains'

const alchemyApiKey =
  import.meta.env.REACT_APP_ALCHEMY_API_KEY ||
  process.env.REACT_APP_ALCHEMY_API_KEY

if (!alchemyApiKey) {
  throw new Error(
    'Alchemy API key is not set in REACT_APP_ALCHEMY_API_KEY environment variable.'
  )
}

// Alchemy network slug mapping
const alchemyChainSlugs: Record<number, string> = {
  [mainnet.id]: 'eth-mainnet',
  [sepolia.id]: 'eth-sepolia',
  [gnosis.id]: 'gnosis-mainnet'
}

/**
 * Create an Alchemy-backed HTTP transport for a given chain.
 */
const alchemyTransport = (chainId: number): Transport => {
  const slug = alchemyChainSlugs[chainId]
  return http(`https://${slug}.g.alchemy.com/v2/${alchemyApiKey}`)
}

/**
 * Build the transports map for all supported chains.
 * All chains use Alchemy RPCs.
 */
export const getTransports = (): Record<number, Transport> => {
  const transports: Record<number, Transport> = {}

  for (const chain of SUPPORTED_CHAINS) {
    transports[chain.id] = alchemyTransport(chain.id)
  }

  return transports
}

export const transports = getTransports()
