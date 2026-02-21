import { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { getChainById, DEFAULT_CHAIN } from 'config/chains'
import { defaultTcrAddresses } from 'config/tcr-addresses'

/**
 * Hook that manages chain switching for the TCR app.
 *
 * Key design decisions (matching kleros-v2/web patterns):
 * - Uses wagmi's `useSwitchChain` instead of raw `window.ethereum.request()`
 * - Never blocks rendering — content is always shown (read-only mode for wrong chain)
 * - Chain switching is best-effort: if the user rejects, we still show content
 *
 * Anti-loop design:
 * - ALL tracking uses refs (never state) to avoid re-render cascades
 * - switchChain is called via a stable ref to avoid dependency churn
 * - Navigation from wallet changes is debounced to let wagmi settle
 * - Self-initiated navigations are tracked to prevent re-triggering
 */
const useTcrNetwork = () => {
  const navigate = useNavigate()
  const { chainId: urlChainId } = useParams()
  const walletChainId = useChainId()
  const { isConnected } = useAccount()
  const { switchChain } = useSwitchChain()

  // The chain the URL says we should be on
  const targetChainId = getChainById(urlChainId)
    ? Number(urlChainId)
    : DEFAULT_CHAIN.id

  // Whether the wallet is on the correct chain for write operations
  const isCorrectChain = walletChainId === targetChainId

  // --- All refs for loop prevention ---
  // Which targetChainId we already attempted to switch to (never re-arms on URL change)
  const switchAttemptedForChain = useRef<number | null>(null)
  // Stable ref for switchChain (wagmi's mutate is unstable across renders)
  const switchChainRef = useRef(switchChain)
  switchChainRef.current = switchChain
  // Track previous wallet chain for detecting actual changes
  const prevWalletChainRef = useRef(walletChainId)
  // Debounce timer for navigation on wallet chain change
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Effect 1: Attempt to switch the wallet to the URL's chain (best-effort).
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

  // Effect 2: Navigate to the matching TCR when the wallet chain changes.
  // Debounced to let wagmi's state settle before acting, preventing
  // rapid-fire navigations from intermediate chain states.
  useEffect(() => {
    const prevChain = prevWalletChainRef.current
    prevWalletChainRef.current = walletChainId

    // Only act on actual changes, not initial render
    if (prevChain === walletChainId) return
    // Don't navigate on disconnect
    if (!isConnected) return
    // Don't navigate if wallet switched to the URL's chain
    // (likely from our own switchChain call above)
    if (walletChainId === targetChainId) return

    // Clear any pending navigation from a previous rapid chain change
    if (navTimerRef.current) clearTimeout(navTimerRef.current)

    const chainToNavigate = walletChainId
    navTimerRef.current = setTimeout(() => {
      navTimerRef.current = null
      const tcrAddress = defaultTcrAddresses[chainToNavigate]
      if (tcrAddress) navigate(`/tcr/${chainToNavigate}/${tcrAddress}`)
    }, 150)

    return () => {
      if (navTimerRef.current) {
        clearTimeout(navTimerRef.current)
        navTimerRef.current = null
      }
    }
  }, [walletChainId, isConnected, targetChainId, navigate])

  return {
    targetChainId,
    isCorrectChain,
    isConnected,
  }
}

export default useTcrNetwork
