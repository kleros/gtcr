import React from 'react'
import styled, { keyframes } from 'styled-components'
import { Button } from 'components/curate/primitives'
import type { GateFix } from './use-wallet-gate'
import type { SubmitPhase } from './use-submit-actions'

/*
 * The single action under the receipt. One button whose job changes with
 * the first blocker (connect, switch chain, sign in, approve, retry), then
 * the confirm that repeats the exact amount. Blockers without a fix (missing
 * fields, low balance) disable it and are named underneath. Used by the
 * panel and, on phones, by the sticky bar.
 */

export interface ConfirmGate {
  /** The wallet, chain, sign-in, balance or approval blocker, first one wins. */
  blocker?: string
  /** The action that clears `blocker`; it takes the button. */
  fix?: GateFix
}

const shimmer = keyframes`
  from { transform: translateX(-100%); }
  to { transform: translateX(250%); }
`

/*
 * The status line stays in the accessibility tree even when empty, so a
 * screen reader announces "Uploading…" and "Confirm in your wallet…" when
 * the text arrives.
 */
const Note = styled.p`
  min-height: 18px;
  margin: 10px 0 0;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  text-align: center;

  &:empty {
    min-height: 0;
    margin: 0;
  }
`

/**
 * While a transaction is pending the label says what to do and a 2px light
 * runs along the bottom edge (no spinner). It stays full strength: pending
 * is a state, not a disabled button.
 */
const Wide = styled(Button)`
  height: 48px;
  overflow: hidden;
  font-size: var(--fs-body-lg);

  &[aria-busy='true'] {
    cursor: progress;
  }

  &[aria-busy='true']:disabled {
    opacity: 1;
  }

  &[aria-busy='true']::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0;
    width: 40%;
    height: 2px;
    background: linear-gradient(
      90deg,
      transparent,
      var(--color-on-primary),
      transparent
    );
    opacity: 0.85;
    animation: ${shimmer} 1.4s var(--ease-in-out) infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    &[aria-busy='true']::after {
      left: 0;
      width: 100%;
      opacity: 0.5;
      animation: none;
    }
  }
`

const phaseNote = (phase: SubmitPhase, itemName: string): string =>
  phase === 'uploading'
    ? `Uploading your ${itemName} to IPFS…`
    : phase === 'wallet'
      ? 'Confirm in your wallet. The page waits until the transaction is mined.'
      : ''

export const ConfirmAction = ({
  gate,
  formBlocker,
  submitting,
  phase,
  itemName,
  confirmLabel,
  amountText,
  onConfirm,
}: {
  gate: ConfirmGate
  /** "Fill in 2 required fields to submit", or empty. */
  formBlocker: string
  submitting: boolean
  phase: SubmitPhase
  itemName: string
  confirmLabel: string
  amountText: string
  onConfirm: () => void
}) => {
  if (submitting)
    return (
      <>
        <Wide type="button" $variant="primary" $block disabled aria-busy>
          {phase === 'uploading' ? 'Uploading…' : 'Confirm in wallet…'}
        </Wide>
        <Note role="status">{phaseNote(phase, itemName)}</Note>
      </>
    )

  if (gate.fix && gate.blocker) {
    const { fix } = gate
    return (
      <>
        <Wide
          type="button"
          $variant="primary"
          $block
          disabled={fix.loading}
          aria-busy={fix.loading || undefined}
          onClick={fix.onClick}
        >
          {fix.loading ? 'Confirm in wallet…' : fix.label}
        </Wide>
        <Note role="status">
          {gate.blocker === fix.label ? '' : gate.blocker}
        </Note>
      </>
    )
  }

  const blocker = gate.blocker || formBlocker
  return (
    <>
      <Wide
        type="button"
        $variant="primary"
        $block
        disabled={!!blocker}
        aria-disabled={!!blocker}
        title={blocker || undefined}
        onClick={onConfirm}
      >
        {confirmLabel} · {amountText}
      </Wide>
      <Note role="status">{blocker}</Note>
    </>
  )
}

export default ConfirmAction
