import React, { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import styled, { keyframes } from 'styled-components'
import { appKitModal } from 'config/wagmi'
import { IconButton, Label } from './primitives'
import { CurateIcon } from './icons'
import { trapTab } from './item-light-focus-trap'

/*
 * Dialog for the item pages and their flows: a near-opaque panel over a
 * blurred page (the only blur is the backdrop's), with the aurora glowing
 * along its top edge. It rises and scales in from 96% (opacity and
 * transform only), Escape and the scrim close it, the page behind stops
 * scrolling, Tab stays inside it, and focus moves into the dialog and back.
 * While the wallet modal is open on top, Escape belongs to it alone, so a
 * typed justification is never thrown away with it.
 */

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
  /* A solid fill first: a browser without color-mix() (iOS before 16.2,
     Chrome before 111) drops the next line and keeps this one. */
  background: var(--stage);
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

const Panel = styled.div<{ $width: 'md' | 'lg' }>`
  position: relative;
  isolation: isolate;
  width: 100%;
  max-width: ${({ $width }) => ($width === 'lg' ? '1040px' : '600px')};
  overflow: clip;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  /* A solid fill first: a browser without color-mix() (iOS before 16.2,
     Chrome before 111) drops the next line and keeps this one. */
  background: var(--color-surface);
  background: color-mix(in srgb, var(--color-surface) 90%, transparent);
  box-shadow:
    inset 0 1px 0 var(--glass-highlight),
    var(--shadow-overlay);
  color: var(--color-text);
  outline: none;
  animation: ${rise} 420ms cubic-bezier(0.16, 1, 0.3, 1) both;

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

const Title = styled.h2`
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: clamp(24px, 1vw + 18px, 30px);
  line-height: 1.1;
  font-weight: 500;
  letter-spacing: -0.03em;
`

const Body = styled.div`
  padding: 4px 28px 28px;

  @media (max-width: 720px) {
    padding: 4px 18px 20px;
  }
`

const Foot = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 28px 22px;
  border-top: 1px solid var(--glass-border);

  @media (max-width: 520px) {
    padding: 14px 18px 18px;

    > * {
      flex: 1 1 auto;
    }
  }
`

export interface DialogProps {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  /** Mono eyebrow above the title, e.g. the entry name. */
  eyebrow?: React.ReactNode
  width?: 'md' | 'lg'
  footer?: React.ReactNode
  children?: React.ReactNode
}

export const Dialog = ({
  open,
  onClose,
  title,
  eyebrow,
  width = 'md',
  footer,
  children,
}: DialogProps) => {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  // Pages re-render every second (countdowns) and pass a new onClose each
  // time; read it through a ref so the focus effect runs only when the
  // dialog opens or closes, never while someone is typing.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !appKitModal?.isOpen()) onCloseRef.current()
    }
    // The Tab trap only hears keys from inside the panel. Focus that lands
    // on the page behind (Tab from <body> once the wallet modal has closed,
    // say) is pulled back into the panel; a layer on top of the dialog (the
    // wallet modal, another modal dialog) keeps its own focus.
    const onFocusIn = (event: FocusEvent) => {
      const panel = panelRef.current
      const { target } = event
      if (!panel || !(target instanceof Element) || panel.contains(target))
        return
      if (appKitModal?.isOpen() || target.closest('[aria-modal="true"]')) return
      panel.focus({ preventScroll: true })
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', onFocusIn)
    panelRef.current?.focus({ preventScroll: true })
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('focusin', onFocusIn)
      previous?.focus?.()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <Scrim
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <Panel
        ref={panelRef}
        $width={width}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        onKeyDown={trapTab}
      >
        <Head>
          <Titles>
            {eyebrow && <Label>{eyebrow}</Label>}
            {title && <Title id={titleId}>{title}</Title>}
          </Titles>
          <IconButton type="button" aria-label="Close" onClick={onClose}>
            <CurateIcon name="close" size={16} />
          </IconButton>
        </Head>
        <Body>{children}</Body>
        {footer && <Foot>{footer}</Foot>}
      </Panel>
    </Scrim>,
    document.body,
  )
}

/** Two columns inside a wide dialog: the form, then the receipt rail. */
export const DialogColumns = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 28px;
  align-items: start;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`

export default Dialog
