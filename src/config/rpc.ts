import { http, type Transport } from 'wagmi'
import { mainnet, gnosis, sepolia, SUPPORTED_CHAINS } from './chains'

const alchemyApiKey =
  import.meta.env.REACT_APP_ALCHEMY_API_KEY ||
  process.env.REACT_APP_ALCHEMY_API_KEY

if (!alchemyApiKey)
  throw new Error(
    'Alchemy API key is not set in REACT_APP_ALCHEMY_API_KEY environment variable.',
  )

const alchemyChainSlugs: Record<number, string> = {
  [mainnet.id]: 'eth-mainnet',
  [sepolia.id]: 'eth-sepolia',
  [gnosis.id]: 'gnosis-mainnet',
}

export const getAlchemyRpcUrl = (chainId: number): string | undefined => {
  const slug = alchemyChainSlugs[chainId]
  if (!slug) return undefined
  return `https://${slug}.g.alchemy.com/v2/${alchemyApiKey}`
}

export const transports: Record<number, Transport> = Object.fromEntries(
  SUPPORTED_CHAINS.map((chain) => [
    chain.id,
    http(getAlchemyRpcUrl(Number(chain.id)), { batch: true }),
  ]),
)
