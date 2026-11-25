import { useEffect, useRef } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import useUrlChainId from 'hooks/use-url-chain-id'
import { getChainById, DEFAULT_CHAIN } from 'config/chains'

/*
 * The chains the wallet was already asked to move to, for the life of the
 * page load. List, entry and submit pages remount on every link, so a
 * per-mount memory asked again on each page after the reader had said no.
 */
const askedChains = new Set<number>()

/**
 * Asks a connected wallet, once per visit, to move to the chain of the page
 * it opens.
 *
 * The page never follows the wallet the other way. It used to: a wallet
 * that changed network sent every open list, entry and submit page to that
 * network's list of lists, so a second tab on another chain (or a switch in
 * the wallet) threw away a half-filled submission or an evidence draft. The
 * URL names the page's chain, reads use it, and every write has its own
 * "Switch to <chain>" step. (A wallet client lost on an unsupported chain
 * is looked up again app-wide, in contexts/wallet-context.tsx.)
 *
 * `ready`: the page knows the list is on this chain. A link naming another
 * chain is sent on to the list's own (use-check-standard-curate): asking the
 * wallet before that would move it to the wrong chain, and that chain would
 * count as asked for the rest of the visit.
 */
const useTcrNetwork = (ready = true) => {
  const urlChainId = useUrlChainId()
  // The wallet's own chain. useChainId() stays on the last chain the app
  // supports while the wallet sits on one it does not (wagmi only follows
  // configured chains), so it alone cannot tell whether writes can go out.
  const { isConnected, chainId: connectedChainId } = useAccount()
  const { switchChain } = useSwitchChain()

  // The chain the URL says we should be on. A chain Curate does not run on
  // gets its own "Chain not supported" page: nothing to move the wallet to.
  const supported = !urlChainId || !!getChainById(urlChainId)
  const targetChainId =
    urlChainId && getChainById(urlChainId) ? urlChainId : DEFAULT_CHAIN.id

  // Whether the wallet is on the correct chain for write operations
  const isCorrectChain = connectedChainId === targetChainId

  // Stable ref for switchChain (wagmi's mutate is unstable across renders)
  const switchChainRef = useRef(switchChain)
  switchChainRef.current = switchChain

  // Attempt to switch the wallet to the URL's chain (best-effort), at most
  // once per chain and visit: a wallet already there counts as asked, and a
  // refusal is not met with the same request on the next page.
  useEffect(() => {
    if (!isConnected || !supported || !ready) return
    if (isCorrectChain) {
      // Wallet is already on the right chain — mark as attempted
      askedChains.add(targetChainId)
      return
    }
    if (askedChains.has(targetChainId)) return

    askedChains.add(targetChainId)
    try {
      switchChainRef.current({ chainId: targetChainId })
    } catch {
      // User rejected or error — that's fine, show content in read-only
    }
  }, [isConnected, isCorrectChain, targetChainId, supported, ready])
}

export default useTcrNetwork
