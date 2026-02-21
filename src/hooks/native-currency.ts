import { useWeb3Context } from 'hooks/use-web3-context'
import useUrlChainId from 'hooks/use-url-chain-id'
import { NETWORKS } from '../config/networks'

/**
 * Get the ticker for the chain's native currency.
 * Uses the URL chain (source of truth) with a wagmi fallback.
 * @returns {string} The ticker for the chain's native currency.
 */
export default function useNativeCurrency(): string {
  const { networkId } = useWeb3Context()
  const urlChainId = useUrlChainId()

  const chainId = urlChainId ?? networkId
  if (!chainId) return 'ETH'
  if (chainId === NETWORKS.gnosis) return 'xDAI'

  return 'ETH'
}
