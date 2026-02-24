import { useMemo } from 'react'
import { useClient, useConnectorClient } from 'wagmi'
import { providers } from 'ethers'

interface ViemTransport {
  type?: string
  value?: { transports?: Array<{ value?: { url?: string } }>; url?: string }
  transports?: Array<{ value?: { url?: string } }>
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
 * Extract the primary RPC URL from a viem transport.
 *
 * WagmiAdapter from @reown/appkit-adapter-wagmi wraps all transports
 * in a fallback() transport, appending its own RPC proxy as an extra
 * child.  We only need our own (first) transport — the Alchemy RPC
 * configured in config/rpc.ts — so we take just that.
 */
function getUrlFromTransport(transport: ViemTransport): string | undefined {
  if (transport.type === 'fallback') {
    const children = transport.value?.transports ?? transport.transports ?? []
    return children[0]?.value?.url
  }
  return transport.value?.url ?? transport.url
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

  const url = getUrlFromTransport(transport)
  if (!url) return undefined

  return new providers.JsonRpcProvider(url, network)
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
