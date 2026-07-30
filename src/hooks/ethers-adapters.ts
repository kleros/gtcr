import { useMemo } from 'react'
import { useClient, useConnectorClient } from 'wagmi'
import { providers } from 'ethers'

// Cap per-endpoint stalls so a hanging endpoint falls through to the next
// URL instead of holding requests for ethers' 120s default.
const RPC_TIMEOUT_MS = 30_000

interface ViemTransport {
  type?: string
  config?: { type?: string }
  value?: { transports?: ViemTransport[]; url?: string }
  transports?: ViemTransport[]
  url?: string
}

interface ViemClient {
  chain: {
    id: number
    name: string
    contracts?: { ensRegistry?: { address?: string } }
  }
  transport: ViemTransport
  account?: { address: string }
}

/**
 * Collect the http RPC URLs from a viem transport, in fallback order.
 *
 * Two shapes appear here: the client's top-level transport is flattened
 * ({...config, ...value}) while nested child transports keep their fields
 * under `config`/`value`. WagmiAdapter from @reown/appkit-adapter-wagmi
 * wraps whatever we configure in config/rpc.ts in another fallback() with
 * Reown's RPC proxy appended, so our own fallback list arrives nested one
 * level deep — hence the recursion. The proxy is kept as a last-resort leg.
 */
function getUrlsFromTransport(transport: ViemTransport | undefined): string[] {
  if (!transport) return []
  const type = transport.type ?? transport.config?.type
  if (type === 'fallback') {
    const children = transport.value?.transports ?? transport.transports ?? []
    return children.flatMap(getUrlsFromTransport)
  }
  const url = transport.value?.url ?? transport.url
  return typeof url === 'string' && url.startsWith('http') ? [url] : []
}

/**
 * JsonRpcProvider that retries each request on the next URL when the
 * current one errors, in order — the same sequential-pool strategy as
 * utils/fetch-policy-history.ts. Built on StaticJsonRpcProvider because
 * plain JsonRpcProvider re-verifies the chain with an `eth_chainId`
 * round-trip on every getNetwork(), which makes a dead endpoint fail
 * calls that never needed it. (ethers' own FallbackProvider has exactly
 * that flaw: its detectNetwork() Promise.alls every member, so one dead
 * member poisons all reads.)
 */
class SequentialFallbackProvider extends providers.StaticJsonRpcProvider {
  private fallbacks: providers.StaticJsonRpcProvider[]

  constructor(urls: string[], network: providers.Networkish) {
    super({ url: urls[0], timeout: RPC_TIMEOUT_MS }, network)
    this.fallbacks = urls
      .slice(1)
      .map(
        (url) =>
          new providers.StaticJsonRpcProvider(
            { url, timeout: RPC_TIMEOUT_MS },
            network,
          ),
      )
  }

  async perform(method: string, params: unknown): Promise<unknown> {
    let lastError: unknown
    try {
      return await super.perform(method, params)
    } catch (err) {
      lastError = err
    }
    for (const fallbackProvider of this.fallbacks)
      try {
        return await fallbackProvider.perform(method, params)
      } catch (err) {
        lastError = err
      }
    throw lastError
  }
}

function clientToProvider(
  client: ViemClient | undefined,
): providers.JsonRpcProvider | undefined {
  if (!client) return undefined
  const { chain, transport } = client
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  }

  const urls = getUrlsFromTransport(transport)
  if (urls.length === 0) return undefined
  if (urls.length === 1)
    return new providers.StaticJsonRpcProvider(
      { url: urls[0], timeout: RPC_TIMEOUT_MS },
      network,
    )

  return new SequentialFallbackProvider(urls, network)
}

function clientToSigner(
  client: ViemClient | undefined,
): providers.JsonRpcSigner | undefined {
  if (!client) return undefined
  const { account, chain, transport } = client
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  }
  const provider = new providers.Web3Provider(
    transport as unknown as providers.ExternalProvider,
    network,
  )
  if (!account) return undefined
  return provider.getSigner(account.address)
}

export function useEthersProvider({ chainId }: { chainId?: number } = {}):
  | providers.JsonRpcProvider
  | undefined {
  const client = useClient({ chainId })
  return useMemo(
    () => clientToProvider(client as unknown as ViemClient | undefined),
    [client],
  )
}

export function useEthersSigner({ chainId }: { chainId?: number } = {}):
  | providers.JsonRpcSigner
  | undefined {
  const { data: client } = useConnectorClient({ chainId })
  return useMemo(
    () => clientToSigner(client as unknown as ViemClient | undefined),
    [client],
  )
}
