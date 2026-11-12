import { useEffect } from 'react'
import { useAccount } from 'wagmi'
import { appKitModal } from 'config/wagmi'
import { getChainById } from 'config/chains'
import useUrlChainId from 'hooks/use-url-chain-id'

/*
 * The wallet modal asks a wallet to switch to the modal's own network as it
 * connects: Ethereum until told otherwise. Connecting on a Gnosis or Sepolia
 * page therefore asked the wallet to switch to Ethereum, and the page asked
 * right after to switch back. While no wallet is connected, the modal's
 * network follows the page's chain, so connecting asks for that chain, or
 * for nothing when the wallet is already on it. Without a wallet,
 * switchNetwork only sets the modal's network; it sends nothing to a wallet.
 */
const WalletNetworkFollowsPage = () => {
  const urlChainId = useUrlChainId()
  const { isConnected, isConnecting, isReconnecting } = useAccount()

  useEffect(() => {
    if (!appKitModal || isConnected || isConnecting || isReconnecting) return
    const chain = urlChainId ? getChainById(urlChainId) : undefined
    if (!chain || appKitModal.getCaipNetwork()?.id === chain.id) return
    appKitModal.switchNetwork(chain).catch((err: unknown) => {
      console.warn('Could not set the wallet modal network', err)
    })
  }, [urlChainId, isConnected, isConnecting, isReconnecting])

  return null
}

export default WalletNetworkFollowsPage
