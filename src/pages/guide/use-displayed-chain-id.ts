import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import useUrlChainId from 'hooks/use-url-chain-id'
import { useWeb3Context } from 'hooks/use-web3-context'
import { SAVED_NETWORK_KEY } from 'utils/string'

/**
 * The chain the app bar shows: the one in the URL, else the last one the
 * reader picked, else the wallet's. Launch links use it so they open the
 * chooser on the chain in the header. Same lookup as the app bar and menu.
 */
const useDisplayedChainId = (): number => {
  const urlChainId = useUrlChainId()
  const { networkId } = useWeb3Context()
  const { pathname } = useLocation()
  const savedChainId = useMemo(() => {
    try {
      const saved = Number(localStorage.getItem(SAVED_NETWORK_KEY))
      return Number.isInteger(saved) && saved > 0 ? saved : null
    } catch {
      return null
    }
    // Re-read on every navigation, like the app bar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])
  return urlChainId ?? savedChainId ?? networkId
}

export default useDisplayedChainId
