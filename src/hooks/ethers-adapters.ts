import { useMemo } from 'react'
import { useClient, useConnectorClient } from 'wagmi'
import { providers } from 'ethers'

/**
 * Extract usable RPC URLs from a viem transport.
 *
 * WagmiAdapter from @reown/appkit-adapter-wagmi wraps all transports
 * in a fallback() transport. The child transports live at
 * `transport.value.transports`, NOT `transport.transports`.
 */
function getUrlsFromTransport(transport: any): string[] {
  // Fallback transport: child transports are at value.transports
  if (transport.type === 'fallback') {
    const children = transport.value?.transports ?? transport.transports ?? []
    return children.map(t => t.value?.url).filter(Boolean)
  }
  // Plain http transport
  const url = transport.value?.url ?? transport.url
  return url ? [url] : []
}

function clientToProvider(client: any): providers.JsonRpcProvider | providers.FallbackProvider | undefined {
  if (!client) return undefined
  const { chain, transport } = client
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address
  }

  const urls = getUrlsFromTransport(transport)
  if (urls.length === 0) return undefined

  if (urls.length === 1)
    return new providers.JsonRpcProvider(urls[0], network)

  return new providers.FallbackProvider(
    urls.map(url => new providers.JsonRpcProvider(url, network))
  )
}

function clientToSigner(client: any): providers.JsonRpcSigner | undefined {
  if (!client) return undefined
  const { account, chain, transport } = client
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address
  }
  const provider = new providers.Web3Provider(transport, network)
  return provider.getSigner(account.address)
}

export function useEthersProvider({ chainId }: { chainId?: number } = {}): providers.JsonRpcProvider | providers.FallbackProvider | undefined {
  const client = useClient({ chainId })
  return useMemo(() => clientToProvider(client), [client])
}

export function useEthersSigner({ chainId }: { chainId?: number } = {}): providers.JsonRpcSigner | undefined {
  const { data: client } = useConnectorClient({ chainId })
  return useMemo(() => clientToSigner(client), [client])
}
