import React, { useCallback } from 'react'
import styled from 'styled-components'
import { ethers, type BigNumberish } from 'ethers'
import { parseAbi } from 'viem'
import { useAccount, useSwitchChain } from 'wagmi'
import { useAtlasProvider } from '@kleros/kleros-app'
import useUrlChainId from 'hooks/use-url-chain-id'
import { appKitModal } from 'config/wagmi'
import { NETWORKS_INFO } from 'config/networks'
import { reportSwitchFailure, signInWithToast } from 'utils/wrap-with-toast'
import { Dialog } from 'components/curate/item-standard-dialog'
import {
  Button,
  SkeletonBlock,
  Small,
  Stack,
} from 'components/curate/primitives'

/*
 * Shared pieces of the Stake Curate item modals: the dialog (the item
 * pages' own, components/curate/item-standard-dialog), the wallet gate that
 * names its blocker, and the exact amount formatting every receipt uses.
 */

/* ---------- Dialog ---------- */

/** Two columns inside a wide dialog: the form, then the receipt. */
export { DialogColumns } from 'components/curate/item-standard-dialog'

/* A Stake dialog's blocks stack in one column, 16px apart. */
const ModalBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

/**
 * A Stake item dialog: the item pages' own Dialog (Escape, the scrim and
 * the close button close it, Tab stays inside it, the wallet modal keeps
 * its own keys), its blocks in one column.
 */
export const ModalShell = ({
  open,
  title,
  eyebrow,
  onClose,
  width = 'md',
  children,
}: {
  open: boolean
  title: React.ReactNode
  /** Small label above the title, e.g. the entry name. */
  eyebrow?: React.ReactNode
  onClose: () => void
  width?: 'md' | 'lg'
  children: React.ReactNode
}) => (
  <Dialog
    open={open}
    onClose={onClose}
    title={title}
    eyebrow={eyebrow}
    width={width}
  >
    <ModalBody>{children}</ModalBody>
  </Dialog>
)

/** Skeleton shown while a modal waits for its deposit or metadata. */
export const ModalSkeleton = () => (
  <Stack $gap={10} aria-busy="true" aria-label="Loading">
    <SkeletonBlock $height="20px" $width="60%" />
    <SkeletonBlock $height="96px" />
    <SkeletonBlock $height="40px" />
  </Stack>
)

/* ---------- Wallet gate ---------- */

export interface ActionGate {
  /** True when the wallet is connected, on the right chain and signed in if needed. */
  ready: boolean
  account?: `0x${string}`
  /** "Connect a wallet to challenge": shown on the disabled confirm button. */
  blocker?: string
  /**
   * The one button that clears the blocker. Connect and Sign in are the next
   * step, so primary; a network switch is secondary (as in the Standard
   * dialogs).
   */
  helper?: {
    label: string
    onClick: () => void
    loading?: boolean
    variant?: 'primary' | 'secondary'
  }
}

const chainName = (chainId: number): string =>
  NETWORKS_INFO[chainId as keyof typeof NETWORKS_INFO]?.name ??
  `chain ${chainId}`

/**
 * Every write needs a connected wallet on the URL's chain; uploads also need
 * the Atlas sign-in. The gate returns the first blocker in that order.
 */
export const useActionGate = (
  verb: string,
  { needsSignIn = false }: { needsSignIn?: boolean } = {},
): ActionGate => {
  const { address, isConnected, chainId: walletChainId } = useAccount()
  const urlChainId = useUrlChainId()
  const { switchChain, isPending: switching } = useSwitchChain()
  const { isVerified, isSigningIn, authoriseUser } = useAtlasProvider()

  const signIn = useCallback(
    () => signInWithToast(authoriseUser),
    [authoriseUser],
  )

  if (!isConnected || !address)
    return {
      ready: false,
      blocker: `Connect a wallet to ${verb}`,
      helper: {
        label: 'Connect',
        onClick: () => appKitModal?.open({ view: 'Connect' }),
        variant: 'primary',
      },
    }

  if (urlChainId && walletChainId !== urlChainId)
    return {
      ready: false,
      account: address,
      blocker: `Switch to ${chainName(urlChainId)} to ${verb}`,
      helper: {
        label: `Switch to ${chainName(urlChainId)}`,
        onClick: () =>
          switchChain(
            { chainId: urlChainId },
            {
              onError: (err) => reportSwitchFailure(err, chainName(urlChainId)),
            },
          ),
        loading: switching,
      },
    }

  if (needsSignIn && !isVerified)
    return {
      ready: false,
      account: address,
      blocker: `Sign in to ${verb}`,
      helper: {
        label: 'Sign in',
        onClick: signIn,
        loading: isSigningIn,
        variant: 'primary',
      },
    }

  return { ready: true, account: address }
}

const HelperRow = styled.div<{ $captioned: boolean }>`
  display: flex;
  align-items: center;
  justify-content: ${({ $captioned }) =>
    $captioned ? 'space-between' : 'flex-end'};
  flex-wrap: wrap;
  gap: 8px 16px;
`

/**
 * The button that clears the gate's blocker, with the blocker as its
 * caption. Pass `caption={false}` where the disabled confirm above already
 * names the blocker (WhatHappensNext prints it under its button).
 */
export const GateHelper = ({
  gate,
  caption = true,
}: {
  gate: ActionGate
  caption?: boolean
}) =>
  gate.helper ? (
    <HelperRow $captioned={caption}>
      {caption && (
        <Small $muted role="status">
          {gate.blocker}
        </Small>
      )}
      <Button
        type="button"
        $variant={gate.helper.variant ?? 'secondary'}
        disabled={gate.helper.loading}
        onClick={gate.helper.onClick}
      >
        {gate.helper.loading ? 'Waiting…' : gate.helper.label}
      </Button>
    </HelperRow>
  ) : null

/* ---------- Amounts ---------- */

type Amount = BigNumberish | bigint | null | undefined

const trimFraction = (value: string, maxFraction: number): string => {
  const [whole, fraction = ''] = value.split('.')
  const trimmed = fraction.slice(0, maxFraction).replace(/0+$/, '')
  return trimmed ? `${whole}.${trimmed}` : whole
}

/** Exact token amount in display units, at most `maxFraction` decimals, no trailing zeros. */
export const formatTokenAmount = (
  amount: Amount,
  decimals = 18,
  maxFraction = 4,
): string =>
  amount === null || amount === undefined
    ? '…'
    : trimFraction(
        ethers.utils.formatUnits(String(amount), decimals),
        maxFraction,
      )

/** "300 sDAI" */
export const tokenText = (amount: Amount, decimals: number, symbol: string) =>
  `${formatTokenAmount(amount, decimals)} ${symbol}`

/** "36 xDAI" */
export const nativeText = (amount: Amount, currency: string) =>
  `${formatTokenAmount(amount, 18, 5)} ${currency}`

/** Basis-point multiplier applied to a wei amount; the contract divides by 10 000. */
export const MULTIPLIER_DIVISOR = 10_000n

export const applyMultiplier = (
  amount: Amount,
  multiplier: string | number | null | undefined,
  divisor: bigint = MULTIPLIER_DIVISOR,
): bigint => {
  if (amount === null || amount === undefined || divisor === 0n) return 0n
  return (BigInt(String(amount)) * BigInt(String(multiplier ?? 0))) / divisor
}

/** "50%" for a basis-point multiplier. */
export const multiplierPercent = (
  multiplier: string | number | null | undefined,
): string => `${Number(multiplier ?? 0) / 100}%`

/**
 * The token's approve(), simulated and sent with no declared return value.
 * viem's erc20Abi says it returns a bool, and a token whose approve returns
 * nothing (USDT on Ethereum) then fails the simulation before the wallet
 * opens. Nothing reads the returned value; the calldata is the same.
 */
export const APPROVE_ABI = parseAbi([
  'function approve(address spender, uint256 amount)',
])

/* ---------- Transaction phases ---------- */

/**
 * Where a transaction stands, for the button that sent it: the wallet
 * prompt is open (or about to be), then the wallet has returned the hash
 * and the chain has yet to confirm it.
 */
export type TxPhase = 'wallet' | 'mining'

export const TX_PHASE_LABEL: Record<TxPhase, string> = {
  wallet: 'Confirm in your wallet…',
  mining: 'Waiting for confirmation…',
}

/* ---------- Form chrome ---------- */

/** Wraps the shared formik forms so their fields sit on the design tokens. */
export const FormBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;

  .ui-form-item {
    margin-bottom: 12px;
  }

  label,
  .ui-form-item-label {
    color: var(--color-text);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
    font-weight: 500;
  }
`

/* The approval, the first of two transactions, as one raised row. */
export const StepRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  background: var(--color-raised);
`

export const PolicyText = styled.a`
  color: var(--color-primary);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 500;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`
