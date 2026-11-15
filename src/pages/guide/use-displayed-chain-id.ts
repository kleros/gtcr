import useUrlChainId from 'hooks/use-url-chain-id'
import { useWeb3Context } from 'hooks/use-web3-context'
import { useSavedChainId } from 'components/layout/launch-chain'

/**
 * The chain the app bar shows: the one in the URL, else the last one the
 * reader picked, else the wallet's. Launch links use it so they open the
 * chooser on the chain in the header. Same lookup as the app bar and menu,
 * and it follows a pick in the app bar at once (useSavedChainId).
 */
const useDisplayedChainId = (): number => {
  const urlChainId = useUrlChainId()
  const { networkId } = useWeb3Context()
  const saved = useSavedChainId()
  const savedChainId =
    saved !== null && Number.isInteger(saved) && saved > 0 ? saved : null
  return urlChainId ?? savedChainId ?? networkId
}

export default useDisplayedChainId
