import { useEffect, useMemo, useState } from 'react'
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

/** Sent on this page whenever the saved chain changes. */
const SAVED_CHAIN_EVENT = 'curate:saved-chain'

/**
 * Remembers a chain for the pages with no chain in their address (the
 * guide, a profile): the app bar's chip and every launch link
 * read it. Whatever reads it through useSavedChainId follows at once, with
 * no navigation needed.
 */
export const saveChainId = (chainId: number) => {
  try {
    if (localStorage.getItem(SAVED_NETWORK_KEY) === String(chainId)) return
    localStorage.setItem(SAVED_NETWORK_KEY, String(chainId))
  } catch {
    // Storage can be blocked: the choice is not kept.
    return
  }
  window.dispatchEvent(new Event(SAVED_CHAIN_EVENT))
}

/**
 * The saved chain, read again after every navigation (so another tab's
 * choice shows on the next one) and whenever this page saves one.
 */
export const useSavedChainId = (): number | null => {
  const { key } = useLocation()
  const [saves, setSaves] = useState(0)
  useEffect(() => {
    const onSave = () => setSaves((count) => count + 1)
    window.addEventListener(SAVED_CHAIN_EVENT, onSave)
    return () => window.removeEventListener(SAVED_CHAIN_EVENT, onSave)
  }, [])
  // location.key and the save count only say when to read it again.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(readSavedChainId, [key, saves])
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
  const savedChainId = useSavedChainId()
  return useMemo(() => {
    if (location.pathname === '/') {
      const scope = validChain(
        new URLSearchParams(location.search).get('chain'),
      )
      return scope === 'all' ? NETWORKS.gnosis : scope
    }
    return urlChainId ?? savedChainId ?? networkId
  }, [location.pathname, location.search, urlChainId, savedChainId, networkId])
}

export default useLaunchChainId
