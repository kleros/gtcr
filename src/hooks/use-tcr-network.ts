import { useEffect, useRef } from 'react'
import { useAccount, useSwitchChain, useWalletClient } from 'wagmi'
import useUrlChainId from 'hooks/use-url-chain-id'
import { getChainById, DEFAULT_CHAIN } from 'config/chains'

/**
 * Asks a connected wallet, once, to move to the chain of the page it opens.
 *
 * The page never follows the wallet the other way. It used to: a wallet
 * that changed network sent every open list, entry and submit page to that
 * network's list of lists, so a second tab on another chain (or a switch in
 * the wallet) threw away a half-filled submission or an evidence draft. The
 * URL names the page's chain, reads use it, and every write has its own
 * "Switch to <chain>" step.
 */
const useTcrNetwork = () => {
  const urlChainId = useUrlChainId()
  // The wallet's own chain. useChainId() stays on the last chain the app
  // supports while the wallet sits on one it does not (wagmi only follows
  // configured chains), so it alone cannot tell whether writes can go out.
  const { isConnected, chainId: connectedChainId } = useAccount()
  const { switchChain } = useSwitchChain()
  // wagmi keys the wallet client by useChainId(), so coming back from an
  // unsupported chain to that same chain keeps the lookup that failed there,
  // and every write on the page would quietly do nothing. Read without
  // fetching (the pages' own hooks fetch it) and look it up again then.
  const { isError: walletClientFailed, refetch: refetchWalletClient } =
    useWalletClient({ query: { enabled: false } })

  // The chain the URL says we should be on
  const targetChainId =
    urlChainId && getChainById(urlChainId) ? urlChainId : DEFAULT_CHAIN.id

  // Whether the wallet is on the correct chain for write operations
  const isCorrectChain = connectedChainId === targetChainId

  useEffect(() => {
    if (isConnected && isCorrectChain && walletClientFailed)
      void refetchWalletClient({ cancelRefetch: false })
  }, [isConnected, isCorrectChain, walletClientFailed, refetchWalletClient])

  // Which targetChainId we already attempted to switch to (never re-arms on URL change)
  const switchAttemptedForChain = useRef<number | null>(null)
  // Stable ref for switchChain (wagmi's mutate is unstable across renders)
  const switchChainRef = useRef(switchChain)
  switchChainRef.current = switchChain

  // Attempt to switch the wallet to the URL's chain (best-effort).
  // Uses a ref to track which chain was attempted — never resets on URL change,
  // only when the target chain actually changes to a NEW value.
  useEffect(() => {
    if (!isConnected) return
    if (isCorrectChain) {
      // Wallet is already on the right chain — mark as attempted
      switchAttemptedForChain.current = targetChainId
      return
    }
    if (switchAttemptedForChain.current === targetChainId) return

    switchAttemptedForChain.current = targetChainId
    try {
      switchChainRef.current({ chainId: targetChainId })
    } catch {
      // User rejected or error — that's fine, show content in read-only
    }
  }, [isConnected, isCorrectChain, targetChainId])
}

export default useTcrNetwork
