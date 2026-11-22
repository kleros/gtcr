import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styled, { keyframes } from 'styled-components'
import { CurateIcon } from './icons'
import { truncateMiddle } from './primitives'

/*
 * Chrome: one address as data. Every address is middle-truncated Geist Mono
 * with a copy action beside it, and where it leads says what it is:
 *
 * - A person (submitter, challenger, evidence author, juror, governor) is a
 *   CuratorAddress. It opens their Curate profile and carries no arrow,
 *   because it stays in the app.
 * - A contract or a field's value is a ChromeAddress. It opens the chain
 *   explorer and carries the arrow, because the arrow means the link leaves
 *   the app.
 *
 * The explorer arrow and the copy button show on hover or keyboard focus
 * (copy is always shown on touch screens). In a ChromeAddress they take no
 * room until then, so dense cells stay quiet and legible while the full
 * value is one click away; nothing sits after an address in such a cell, so
 * nothing moves when they unfold. A CuratorAddress keeps its copy button's
 * room and only fades it in. A person's address sits in running text and in
 * rows that wrap ("by 0x… · case 898", the hero's By and Challenged by),
 * where a control that grew on hover pushed the words after it along, and
 * near a row's edge wrapped the next value away from the cursor and back,
 * over and over.
 */

const pop = keyframes`
  from { transform: scale(0.6); opacity: 0; }
  to { transform: none; opacity: 1; }
`

export const AddressWrap = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  max-width: 100%;
  vertical-align: middle;
`

/**
 * A network or chain label shown before the address ("ETH", "Base",
 * "zkSync"), in its authored case: these are names, not eyebrows.
 */
const Prefix = styled.span`
  /* In a tight cell the network label gives way before the address does. */
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 4px;
  padding: 0 5px;
  text-align: center;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  background: var(--glass);
  color: var(--color-muted);
  font-family: var(--font-sans);
  font-size: var(--fs-label);
  line-height: 18px;
  font-weight: 500;
`

const Anchor = styled.a<{ $invalid?: boolean; $fixed?: boolean }>`
  && {
    display: inline-flex;
    align-items: center;
    flex: ${({ $fixed }) => ($fixed ? '0 0 auto' : '0 1 auto')};
    gap: 4px;
    min-width: 0;
    color: ${({ $invalid }) =>
      $invalid ? 'var(--status-contested)' : 'var(--color-text)'};
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 16px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    text-decoration: none;
    transition: color var(--motion);
  }

  > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Takes no room until shown, so dense cells keep the address legible. */
  > svg {
    flex: 0 0 auto;
    width: 0;
    margin-left: -4px;
    opacity: 0;
    transform: translate(-3px, 3px);
    transition:
      width var(--motion),
      margin var(--motion),
      opacity var(--motion),
      transform 240ms var(--ease-out);
  }

  &&:hover {
    color: var(--color-primary);
  }

  ${AddressWrap}:hover & > svg,
  ${AddressWrap}:focus-within & > svg {
    width: 12px;
    margin-left: 0;
    opacity: 1;
    transform: none;
  }

  /* Touch screens: the address itself is the explorer link; copy stays. */
`

const CopyButton = styled.button`
  position: relative;
  flex: 0 0 auto;
  display: inline-grid;
  place-items: center;
  width: 0;
  height: 24px;
  margin: -3px 0;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-faint);
  cursor: pointer;
  opacity: 0;
  transition:
    width var(--motion),
    opacity var(--motion),
    color var(--motion),
    background var(--motion);

  ${AddressWrap}:hover &,
  ${AddressWrap}:focus-within &,
  &[data-state='copied'],
  &[data-state='failed'] {
    width: 24px;
    opacity: 1;
  }

  /* A reserved copy keeps its 24px at rest and is revealed by opacity alone,
     so the text after the address never moves (see CuratorAddress). */
  &[data-reserve] {
    width: 24px;
  }

  &:hover {
    color: var(--color-text);
    background: var(--color-raised);
  }

  &[data-state='copied'] {
    color: var(--status-registered);
  }

  &[data-state='failed'] {
    color: var(--status-off);
  }

  &[data-state='copied'] svg {
    animation: ${pop} 320ms var(--ease-spring) both;
  }

  /* Touch screens have no hover: copy is always there, except in a dense
     table cell, where the address keeps the room (the entry page has it).
     A copy that has just reported stays, and the round variant always does. */
  @media (hover: none) {
    width: 24px;
    opacity: 1;

    td &[data-state='idle']:not([data-variant='round']) {
      width: 0;
      opacity: 0;
    }
  }

  /*
   * The round variant stands on its own (the profile's heading cluster, next
   * to the chain marks), so it is always shown, at the 28px of those marks,
   * on the same glass. It comes after the reveal rules and is one class
   * stronger than them, so a hovered AddressWrap around it cannot shrink it
   * back to 24px. Its colours are set only while idle, so the copied and
   * failed colours (and the pop) still win.
   */
  &&[data-variant='round'] {
    width: 28px;
    height: 28px;
    margin: 0;
    opacity: 1;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-pill);
    background: var(--glass);
    transition:
      opacity var(--motion),
      color var(--motion),
      border-color var(--motion);
  }

  &&[data-variant='round'][data-state='idle'] {
    color: var(--color-muted);
  }

  &&[data-variant='round']:hover {
    border-color: var(--color-border-strong);
  }

  &&[data-variant='round'][data-state='idle']:hover {
    color: var(--color-text);
  }
`

/** Read by screen readers, never shown. */
export const Unseen = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`

type CopyState = 'idle' | 'copied' | 'failed'

export type CopyVariant = 'inline' | 'round'

/**
 * Copies a value and reports it for 1.6s (icon, label and a live region).
 *
 * `inline` (the default) sits beside an address inside an AddressWrap and
 * unfolds on hover or focus. `round` is a 28px glass circle that is always
 * shown, for a value that stands alone, such as the profile's own address.
 */
export const CopyValue = ({
  value,
  label = 'Copy address',
  variant = 'inline',
  reserve = false,
}: {
  value: string
  label?: string
  variant?: CopyVariant
  /**
   * Inline only: keep the button's 24px while it is hidden and reveal it by
   * opacity alone, for an address with text or values after it that must
   * not move on hover. A dense table cell leaves it off.
   */
  reserve?: boolean
}) => {
  const [state, setState] = useState<CopyState>('idle')
  const timer = useRef<number>()

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const settle = useCallback((next: CopyState) => {
    setState(next)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setState('idle'), 1600)
  }, [])

  const copy = (event: React.MouseEvent<HTMLButtonElement>) => {
    // Never let the click reach a row link or a card around the address.
    event.preventDefault()
    event.stopPropagation()
    if (!navigator.clipboard) {
      settle('failed')
      return
    }
    navigator.clipboard
      .writeText(value)
      .then(() => settle('copied'))
      .catch(() => settle('failed'))
  }

  const shown =
    state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : label

  return (
    <>
      <CopyButton
        type="button"
        onClick={copy}
        data-state={state}
        data-variant={variant}
        data-reserve={reserve || undefined}
        aria-label={shown}
        title={shown}
      >
        <CurateIcon
          key={state}
          name={state === 'copied' ? 'check' : 'copy'}
          size={13}
        />
      </CopyButton>
      {/* Beside the button, not in it: a button's children are
          presentational, and WebKit drops a live region there. */}
      <Unseen role="status">{state === 'idle' ? '' : shown}</Unseen>
    </>
  )
}

/** An address that opens the explorer, with the full value one copy away. */
export const ChromeAddress = ({
  address,
  href,
  display,
  prefix,
  invalid = false,
  copyValue,
}: {
  /** The full value: the link title and what the copy button copies. */
  address: string
  /** Explorer page; without it the address is plain text. */
  href?: string
  /** What is shown, usually middle-truncated. Defaults to the address. */
  display?: string
  prefix?: string
  invalid?: boolean
  copyValue?: string
}) => {
  const shown = display ?? address
  // An already-shortened address is never cut again: a dense table scrolls
  // sideways instead of hiding the tail that tells two addresses apart.
  const fixed = shown.length <= 16
  return (
    <AddressWrap>
      {prefix && <Prefix title={prefix}>{prefix}</Prefix>}
      {href ? (
        <Anchor
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={`${address} · open in explorer`}
          $invalid={invalid}
          $fixed={fixed}
        >
          <span>{shown}</span>
          <CurateIcon name="external" size={12} />
          {/* Where it goes, after what is seen (DESIGN.md, Addresses). */}
          <Unseen> on the explorer (opens in a new tab)</Unseen>
        </Anchor>
      ) : (
        <Anchor as="span" title={address} $invalid={invalid} $fixed={fixed}>
          <span>{shown}</span>
        </Anchor>
      )}
      <CopyValue value={copyValue ?? address} />
    </AddressWrap>
  )
}

/*
 * A person's address opens their page on Curate, so its link is a router
 * Link. It takes the data size and colour of the entry page's figures and
 * gains the accent and an underline on hover. The 24px minimum height is the
 * smallest target WCAG 2.2 allows, and it keeps the copy button's row steady.
 */
const ProfileLink = styled(Link)<{ $fixed?: boolean }>`
  && {
    display: inline-flex;
    align-items: center;
    flex: ${({ $fixed }) => ($fixed ? '0 0 auto' : '0 1 auto')};
    min-width: 0;
    min-height: 24px;
    color: var(--color-text);
    font-family: var(--font-mono);
    font-size: var(--fs-data);
    line-height: var(--lh-data);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    text-decoration: none;
    white-space: nowrap;
    transition: color var(--motion);
  }

  > span {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &&:hover {
    color: var(--color-primary);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
`

/**
 * A person's address: middle-truncated mono that opens their Curate profile
 * (no arrow, as it stays in the app), with the copy action beside it. It is
 * the one control for a submitter, a challenger, an evidence author, a juror
 * or a governor; the entry pages and both history timelines reach it through
 * the `AddressLink` exports of item-standard-fields and item-stake-address.
 * A contract never takes it (its Curate profile would be empty): the
 * arbitrator is a ChromeAddress, through item-standard-fields'
 * ExplorerAddressLink.
 *
 * Its copy keeps its room at rest and fades in on hover or focus, because a
 * person's address is followed by other words: a case number in the
 * history, the next value in the hero's wrapping row, a vote count.
 */
export const CuratorAddress = ({
  address,
  label,
}: {
  /** The full address: the profile it opens and what copy copies. */
  address: string
  /** Replaces the truncated address, e.g. "You". */
  label?: string
}) => {
  const shown = label ?? truncateMiddle(address, 6, 4)
  // As in ChromeAddress: a value already this short is never cut again, so
  // the tail that tells two addresses apart always stays on screen.
  const fixed = shown.length <= 16
  return (
    <AddressWrap>
      <ProfileLink
        to={`/address/${address.toLowerCase()}`}
        title={`${address} · Curate profile`}
        $fixed={fixed}
      >
        <span>{shown}</span>
      </ProfileLink>
      <CopyValue value={address} reserve />
    </AddressWrap>
  )
}

export default ChromeAddress
