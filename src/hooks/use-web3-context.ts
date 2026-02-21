import { useMemo } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { providers } from 'ethers'
import { useEthersProvider, useEthersSigner } from './ethers-adapters'
import { DEFAULT_NETWORK } from 'config/networks'

/**
 * Compatibility hook that provides the same interface as the old
 * web3-react v5 `useWeb3Context()`, powered by wagmi v2 under the hood.
 *
 * This allows existing consumer code to work with minimal changes.
 */
interface Web3Context {
  account: string | null
  active: boolean
  networkId: number
  library: providers.JsonRpcProvider | providers.FallbackProvider | undefined
  error: null
  connector: null
  connectorName: null
  setConnector: () => void
  setFirstValidConnector: () => void
}

export function useWeb3Context(): Web3Context {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const provider = useEthersProvider({ chainId })
  const signer = useEthersSigner({ chainId })

  const library = useMemo(() => {
    if (!provider) return undefined
    // Patch provider.getSigner() to return the wagmi-backed signer
    // so existing code like `library.getSigner(account)` keeps working
    const patched = Object.create(provider)
    patched.getSigner = () => signer
    return patched
  }, [provider, signer])

  return {
    account: address ?? null,
    active: isConnected || !!provider,
    networkId: chainId ?? DEFAULT_NETWORK,
    library,
    error: null,
    connector: null,
    connectorName: null,
    setConnector: () => {},
    setFirstValidConnector: () => {},
  }
}
