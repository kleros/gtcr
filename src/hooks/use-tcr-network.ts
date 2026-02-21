import { useEffect, useRef, useState } from 'react'
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
 */
const useTcrNetwork = () => {
  const navigate = useNavigate()
  const { chainId: urlChainId } = useParams()
  const walletChainId = useChainId()
  const { isConnected } = useAccount()
  const { switchChain } = useSwitchChain()

  const [switchAttempted, setSwitchAttempted] = useState(false)

  // The chain the URL says we should be on
  const targetChainId = getChainById(urlChainId)
    ? Number(urlChainId)
    : DEFAULT_CHAIN.id

  // Whether the wallet is on the correct chain for write operations
  const isCorrectChain = walletChainId === targetChainId

  // Attempt to switch the wallet to the URL's chain (best-effort, non-blocking)
  useEffect(() => {
    if (!isConnected) return
    if (isCorrectChain) return
    if (switchAttempted) return

    setSwitchAttempted(true)
    try {
      switchChain({ chainId: targetChainId })
    } catch {
      // User rejected or error — that's fine, show content in read-only
    }
  }, [isConnected, isCorrectChain, switchAttempted, switchChain, targetChainId])

  // Reset switch attempt when URL chain changes
  useEffect(() => {
    setSwitchAttempted(false)
  }, [urlChainId])

  // Navigate to the matching TCR when the wallet chain changes.
  // Uses wagmi's reactive walletChainId instead of raw window.ethereum
  // events so it works with all wallet types (injected, WalletConnect, etc.).
  const prevWalletChainRef = useRef(walletChainId)
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

    const tcrAddress = defaultTcrAddresses[walletChainId]
    if (tcrAddress) {
      navigate(`/tcr/${walletChainId}/${tcrAddress}`)
    }
  }, [walletChainId, isConnected, targetChainId, navigate])

  return {
    targetChainId,
    isCorrectChain,
    isConnected
  }
}

export default useTcrNetwork
