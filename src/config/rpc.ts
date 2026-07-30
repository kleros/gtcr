import { fallback, http, type Transport } from 'wagmi'
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

/**
 * Ordered RPC endpoints per chain: the first URL is the primary, the rest
 * are fallbacks. Both the wagmi transports below and the ethers provider
 * built in hooks/ethers-adapters.ts walk this list in order, so a single
 * endpoint outage no longer takes down all chain reads (which previously
 * blanked every item card, since their status computation waits on
 * `fetchArbitrable` and a block-timestamp fetch).
 *
 * Gnosis is public-first: its public RPC doesn't enforce Alchemy's
 * 10k-result cap on `getLogs` (see utils/fetch-policy-history.ts) and
 * handles the app's read volume fine — scout already runs entirely on it.
 * Mainnet and Sepolia stay Alchemy-first because public mainnet endpoints
 * reject the wide-range `getLogs` scans used by the badges views.
 */
// Only Alchemy is batched: its batch support is known-good, while public
// endpoints vary — a batching quirk on a primary endpoint would defeat the
// fallback ordering. `batch` is tagged where each URL is built so no code
// needs to re-derive an endpoint's provenance from its URL string.
interface RpcEndpoint {
  url: string
  batch: boolean
}

const getOrderedRpcEndpoints = (chainId: number): RpcEndpoint[] => {
  const publicUrl = SUPPORTED_CHAINS.find((c) => Number(c.id) === chainId)
    ?.rpcUrls.default.http[0]
  const alchemyUrl = getAlchemyRpcUrl(chainId)
  const publicEndpoint = publicUrl ? [{ url: publicUrl, batch: false }] : []
  const alchemyEndpoint = alchemyUrl ? [{ url: alchemyUrl, batch: true }] : []
  return chainId === gnosis.id
    ? [...publicEndpoint, ...alchemyEndpoint]
    : [...alchemyEndpoint, ...publicEndpoint]
}

export const transports: Record<number, Transport> = Object.fromEntries(
  SUPPORTED_CHAINS.map((chain) => [
    chain.id,
    fallback(
      getOrderedRpcEndpoints(Number(chain.id)).map(({ url, batch }) =>
        http(url, batch ? { batch: true } : undefined),
      ),
    ),
  ]),
)
