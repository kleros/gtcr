import { useCallback, useMemo } from 'react'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'
import { useAtlasProvider } from '@kleros/kleros-app'
import useUrlChainId from 'hooks/use-url-chain-id'
import { DEFAULT_CHAIN, getChainById } from 'config/chains'
import { errorToast, infoToast, successToast } from 'utils/wrap-with-toast'

/*
 * The wallet side of the confirm button: the same gates as `EnsureAuth`
 * (connect, then Atlas sign-in) plus the URL chain check, each expressed as
 * a named blocker with the action that clears it. Reading the page never
 * needs any of this; only the submission does.
 */

export interface GateFix {
  label: string
  onClick: () => void
  loading?: boolean
}

export interface WalletGate {
  targetChainId: number
  chainName: string
  connected: boolean
  correctChain: boolean
  verified: boolean
  /** The first blocker on the wallet side, if any. */
  blocker?: string
  /** The action that clears `blocker`; its label names the blocker. */
  fix?: GateFix
}

export const useWalletGate = (verb = 'submit'): WalletGate => {
  const urlChainId = useUrlChainId()
  const targetChainId =
    urlChainId && getChainById(urlChainId) ? urlChainId : DEFAULT_CHAIN.id
  const chainName =
    getChainById(targetChainId)?.name ?? `chain ${targetChainId}`
  const { isConnected } = useAccount()
  const walletChainId = useChainId()
  const { switchChain, isPending: switching } = useSwitchChain()
  const { open } = useAppKit()
  const { isVerified, isSigningIn, authoriseUser } = useAtlasProvider()

  const connect = useCallback(() => {
    open({ view: 'Connect' })
  }, [open])

  const signIn = useCallback(() => {
    infoToast('Signing in...')
    authoriseUser()
      .then(() => successToast('Signed in successfully.'))
      .catch((err) => {
        console.error(err)
        errorToast(`Sign-in failed: ${err?.message ?? 'unknown error'}`)
      })
  }, [authoriseUser])

  const switchToTarget = useCallback(() => {
    switchChain({ chainId: targetChainId })
  }, [switchChain, targetChainId])

  return useMemo(() => {
    const correctChain = walletChainId === targetChainId
    const base: WalletGate = {
      targetChainId,
      chainName,
      connected: isConnected,
      correctChain,
      verified: isVerified,
    }
    if (!isConnected)
      return {
        ...base,
        blocker: `Connect wallet to ${verb}`,
        fix: { label: `Connect wallet to ${verb}`, onClick: connect },
      }
    if (!correctChain)
      return {
        ...base,
        blocker: `Switch to ${chainName} to ${verb}`,
        fix: {
          label: `Switch to ${chainName} to ${verb}`,
          onClick: switchToTarget,
          loading: switching,
        },
      }
    if (!isVerified)
      return {
        ...base,
        blocker: `Sign in to ${verb}`,
        fix: {
          label: `Sign in to ${verb}`,
          onClick: signIn,
          loading: isSigningIn,
        },
      }
    return base
  }, [
    chainName,
    connect,
    isConnected,
    isSigningIn,
    isVerified,
    signIn,
    switchToTarget,
    switching,
    targetChainId,
    verb,
    walletChainId,
  ])
}
