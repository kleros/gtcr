import { useWeb3Context } from 'web3-react'
import { NETWORKS } from '../config/networks'

/**
 * Get the ticker for the chain's native currency.
 * @returns {string} The ticker for the chain's native currency.
 */
export default function useNativeCurrency() {
  const { networkId } = useWeb3Context()
  if (!networkId) return 'ETH'
  if (networkId === NETWORKS.gnosis) return 'DAI'

  return 'ETH'
}
