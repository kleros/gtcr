import React, { useCallback, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import styled, { keyframes } from 'styled-components'
import { ethers, type BigNumberish } from 'ethers'
import { useAccount, useSwitchChain } from 'wagmi'
import { useAtlasProvider } from '@kleros/kleros-app'
import useUrlChainId from 'hooks/use-url-chain-id'
import { appKitModal } from 'config/wagmi'
import { NETWORKS_INFO } from 'config/networks'
import { errorToast, infoToast, successToast } from 'utils/wrap-with-toast'
import { CurateIcon } from 'components/curate/icons'
import {
  Button,
  IconButton,
  Label,
  SkeletonBlock,
  Small,
  Stack,
} from 'components/curate/primitives'

/*
 * Shared pieces of the Stake Curate item modals: the dialog (the item
 * pages' near-opaque panel over a blurred page, the aurora along its top
 * edge, rising in from 96%; a bottom-anchored sheet on phones), the wallet
 * gate that names its blocker, and the exact amount formatting every
 * receipt uses.
 */

/* ---------- Dialog ---------- */

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`

const rise = keyframes`
  from { opacity: 0; transform: translateY(12px) scale(0.96); }
  to { opacity: 1; transform: none; }
`

const Scrim = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 56px 16px;
  overflow-y: auto;
  background: color-mix(in srgb, var(--stage) 62%, transparent);
  backdrop-filter: blur(10px) saturate(120%);
  -webkit-backdrop-filter: blur(10px) saturate(120%);
  animation: ${fadeIn} 220ms ease-out both;

  @media (max-width: 720px) {
    padding: 12px 8px 24px;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const Panel = styled.div<{ $width: string }>`
  position: relative;
  isolation: isolate;
  width: 100%;
  max-width: ${({ $width }) => $width};
  overflow: clip;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--color-surface) 92%, transparent);
  box-shadow:
    inset 0 1px 0 var(--glass-highlight),
    var(--shadow-overlay);
  color: var(--color-text);
  outline: none;
  animation: ${rise} 420ms var(--ease-out) both;

  /* The aurora along the top edge: a lit rim and its glow. */
  &::before {
    content: '';
    position: absolute;
    inset: 0 0 auto;
    z-index: -1;
    height: 180px;
    background:
      radial-gradient(
        60% 120px at 18% 0%,
        color-mix(in srgb, var(--aurora-b) 34%, transparent),
        transparent 70%
      ),
      radial-gradient(
        50% 110px at 62% 0%,
        color-mix(in srgb, var(--aurora-a) 30%, transparent),
        transparent 72%
      ),
      radial-gradient(
        40% 90px at 92% 0%,
        color-mix(in srgb, var(--aurora-c) 28%, transparent),
        transparent 72%
      );
    pointer-events: none;
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0 24px auto;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      var(--aurora-b) 20%,
      var(--aurora-a) 55%,
      var(--aurora-c) 82%,
      transparent
    );
    pointer-events: none;
  }

  @media (max-width: 720px) {
    border-radius: var(--radius-lg);
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const Head = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 26px 28px 18px;

  @media (max-width: 720px) {
    padding: 20px 18px 14px;
  }
`

const Titles = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
`

const DialogTitle = styled.h2`
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: clamp(24px, 1vw + 18px, 30px);
  line-height: 1.1;
  font-weight: 500;
  letter-spacing: -0.03em;
`

const DialogBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 28px 28px;

  @media (max-width: 720px) {
    padding: 4px 18px 20px;
  }
`

/** Two columns inside a wide dialog: the form, then the receipt. */
export const DialogColumns = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 28px;
  align-items: start;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

const WIDTHS = { md: '600px', lg: '1040px' } as const

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
}) => {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  // Keep Tab inside the dialog: wrap from the last focusable to the first
  // and from the first (or the dialog itself) back to the last.
  const trapTab = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const dialog = dialogRef.current
    if (event.key !== 'Tab' || !dialog) return
    const nodes = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (node) => node.getClientRects().length > 0,
    )
    if (nodes.length === 0) {
      event.preventDefault()
      return
    }
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    const active = document.activeElement
    if (event.shiftKey) {
      if (active === first || active === dialog || !dialog.contains(active)) {
        event.preventDefault()
        last.focus()
      }
    } else if (active === last || !dialog.contains(active)) {
      event.preventDefault()
      first.focus()
    }
  }

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <Scrim
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <Panel
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        $width={WIDTHS[width]}
        onKeyDown={trapTab}
      >
        <Head>
          <Titles>
            {eyebrow && <Label>{eyebrow}</Label>}
            <DialogTitle id={titleId}>{title}</DialogTitle>
          </Titles>
          <IconButton type="button" aria-label="Close" onClick={onClose}>
            <CurateIcon name="close" size={16} />
          </IconButton>
        </Head>
        <DialogBody>{children}</DialogBody>
      </Panel>
    </Scrim>,
    document.body,
  )
}

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
   * step, so primary; a network switch is secondary (as in the Classic and
   * Light dialogs).
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

  const signIn = useCallback(() => {
    infoToast('Signing in…')
    authoriseUser()
      .then(() => successToast('Signed in.'))
      .catch((err: unknown) => {
        console.error(err)
        const message = err instanceof Error ? err.message : 'unknown error'
        errorToast(`Sign-in failed: ${message}`)
      })
  }, [authoriseUser])

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
        onClick: () => switchChain({ chainId: urlChainId }),
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
