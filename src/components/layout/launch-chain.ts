import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { NETWORKS } from 'config/networks'
import { useWeb3Context } from 'hooks/use-web3-context'
import useUrlChainId from 'hooks/use-url-chain-id'
import { SAVED_NETWORK_KEY } from 'utils/string'
import { validChain } from 'pages/dashboard/view'

const readSavedChainId = (): number | null => {
  try {
    const saved = localStorage.getItem(SAVED_NETWORK_KEY)
    return saved ? Number(saved) : null
  } catch {
    return null
  }
}

/**
 * The chain "Launch a list" opens, one rule for every link to it (the nav,
 * the phone menu, the dashboard hero). On the dashboard it follows the page
 * scope (Gnosis for "All chains"); elsewhere the chain in the URL, then the
 * last chain used, then the wallet's.
 */
export const useLaunchChainId = (): number => {
  const location = useLocation()
  const { networkId } = useWeb3Context()
  const urlChainId = useUrlChainId()
  return useMemo(() => {
    if (location.pathname === '/') {
      const scope = validChain(
        new URLSearchParams(location.search).get('chain'),
      )
      return scope === 'all' ? NETWORKS.gnosis : scope
    }
    return urlChainId ?? readSavedChainId() ?? networkId
    // location.key re-reads the saved chain after every navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search, location.key, urlChainId, networkId])
}

export default useLaunchChainId
