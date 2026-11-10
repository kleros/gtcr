import React from 'react'
import { BigNumber, type BigNumberish } from 'ethers'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { useAtlasProvider } from '@kleros/kleros-app'
import useUrlChainId from 'hooks/use-url-chain-id'
import useNativeBalance from 'hooks/use-native-balance'
import useNativeCurrency from 'hooks/native-currency'
import EnsureAuth from 'components/ensure-auth'
import { NETWORKS_INFO } from 'config/networks'
import { useWalletGate, type GateFix } from 'pages/submit-item/use-wallet-gate'
import { Button } from './primitives'
import { formatAmount } from './item-light-format'

/*
 * Why an action is blocked, in plain words, and the control that unblocks
 * it (DESIGN.md: a disabled primary names its blocker; every page works
 * without a wallet and asks to connect only on an action). Uploads go
 * through Atlas, so the existing EnsureAuth gate (Connect, Sign in) is kept.
 * `fix` is the same unblocking step as a label and a handler, so a dialog's
 * primary button can become "Connect wallet to challenge" instead of
 * sitting disabled above a separate control.
 */

export type { GateFix }

export interface ActionGate {
  /** Undefined when the action can run. */
  blocker?: string
  ready: boolean
  /** Connect, Sign in or Switch network, or null when nothing blocks. */
  controls: React.ReactNode
  /** The step that clears the wallet blocker, for the primary button. */
  fix?: GateFix
}

export const useActionGate = ({
  verb,
  shortVerb,
  amount,
  needsAuth = true,
  pending,
}: {
  /** "challenge this submission", used in "Connect a wallet to …" */
  verb: string
  /** "challenge", used on the button: "Connect wallet to challenge". */
  shortVerb?: string
  /** The deposit about to be sent, to check the balance. */
  amount?: BigNumberish | null
  /** Whether the action uploads to Atlas and needs the sign-in. */
  needsAuth?: boolean
  /** A blocker from the caller while its data loads ("Loading the deposit"). */
  pending?: string
}): ActionGate => {
  const { isConnected } = useAccount()
  const walletChainId = useChainId()
  const urlChainId = useUrlChainId()
  const { isVerified } = useAtlasProvider()
  const { balance } = useNativeBalance()
  const currency = useNativeCurrency()
  const { switchChain, isPending } = useSwitchChain()
  // Its connect and sign-in steps (with their toasts) are reused; its chain
  // check is not: only the chain in the URL counts here.
  const wallet = useWalletGate(shortVerb ?? verb)

  const targetChain = urlChainId ?? undefined
  const chainName = targetChain
    ? (NETWORKS_INFO[targetChain as keyof typeof NETWORKS_INFO]?.name ??
      `chain ${targetChain}`)
    : undefined
  const wrongChain =
    isConnected && !!targetChain && walletChainId !== targetChain
  const insufficient =
    isConnected &&
    amount !== null &&
    amount !== undefined &&
    balance !== undefined &&
    balance < BigInt(BigNumber.from(amount).toString())

  let blocker: string | undefined
  if (pending) blocker = pending
  else if (!isConnected) blocker = `Connect a wallet to ${verb}`
  else if (wrongChain) blocker = `Switch to ${chainName} to ${verb}`
  else if (needsAuth && !isVerified) blocker = `Sign in to ${verb}`
  else if (insufficient)
    blocker = `Not enough ${currency}: you need ${formatAmount(
      amount,
      currency,
    )} plus gas`

  let controls: React.ReactNode = null
  if (!isConnected || (!wrongChain && needsAuth && !isVerified))
    controls = <EnsureAuth>{null}</EnsureAuth>
  else if (wrongChain && targetChain)
    controls = (
      <Button
        type="button"
        $variant="secondary"
        disabled={isPending}
        onClick={() => switchChain({ chainId: targetChain })}
      >
        Switch to {chainName}
      </Button>
    )

  let fix: GateFix | undefined
  if (!isConnected) fix = wallet.fix
  else if (wrongChain && targetChain)
    fix = {
      label: `Switch to ${chainName}`,
      onClick: () => switchChain({ chainId: targetChain }),
      loading: isPending,
    }
  else if (needsAuth && !isVerified && wallet.connected && wallet.correctChain)
    fix = wallet.fix

  return { blocker, ready: !blocker, controls, fix }
}

/**
 * The confirm props for WhatHappensNext: while the wallet blocks, the
 * primary button runs the step that clears it (connect, switch, sign in);
 * otherwise it is the confirm, disabled with its blocker named.
 */
export const gatedConfirm = (
  gate: ActionGate,
  confirm: {
    label: string
    onConfirm: () => void
    disabled?: boolean
    blocker?: string
    loading?: boolean
  },
) =>
  gate.fix
    ? {
        confirmLabel: gate.fix.label,
        onConfirm: gate.fix.onClick,
        confirmDisabled: !!gate.fix.loading,
        confirmBlocker: undefined,
        loading: !!gate.fix.loading,
      }
    : {
        confirmLabel: confirm.label,
        onConfirm: confirm.onConfirm,
        confirmDisabled: confirm.disabled,
        confirmBlocker: confirm.blocker,
        loading: confirm.loading,
      }

export default useActionGate
