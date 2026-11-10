import React, { useCallback, useEffect, useRef, useState } from 'react'
import styled, { keyframes } from 'styled-components'
import { CurateIcon } from './icons'

/*
 * Chrome: one address as data. Middle-truncated mono that opens the chain
 * explorer, with a copy action beside it. The explorer arrow and the copy
 * button unfold on hover or keyboard focus (always shown on touch screens)
 * and take no room until then, so dense cells stay quiet and legible while
 * the full value is one click away.
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
     table cell, where the address keeps the room (the entry page has it). */
  @media (hover: none) {
    width: 24px;
    opacity: 1;

    td &:not([data-state='copied']):not([data-state='failed']) {
      width: 0;
      opacity: 0;
    }
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

/** Copies a value and reports it for 1.6s (icon, label and a live region). */
export const CopyValue = ({
  value,
  label = 'Copy address',
}: {
  value: string
  label?: string
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
    <CopyButton
      type="button"
      onClick={copy}
      data-state={state}
      aria-label={shown}
      title={shown}
    >
      <CurateIcon
        key={state}
        name={state === 'copied' ? 'check' : 'copy'}
        size={13}
      />
      <Unseen role="status">{state === 'idle' ? '' : shown}</Unseen>
    </CopyButton>
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

export default ChromeAddress
