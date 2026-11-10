import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import styled, { ThemeProvider as SCThemeProvider } from 'styled-components'
import {
  lightTheme,
  darkTheme,
  klerosTheme,
} from '../../contexts/theme-context'
import Button from './Button'
import { KitIcon } from './kit-icons'
import { ghostIconButton, joinClassNames } from './kit-styles'

/*
 * Modal, v2: a solid raised dialog (surface fill, hairline, 24px radius,
 * default width 520) with a thin aurora line along its top edge, over a
 * stage scrim that blurs the page (the only blur here, and it never
 * animates). The dialog grows out of the control that opened it: it
 * travels from the trigger's centre while a clip-path widens from the
 * trigger's size to the full panel (SPEC 5.6), so the text never scales.
 * The shadow and glow live on a sibling layer that fades in near the end,
 * because a clip-path would cut them off. Closing reverses the morph into
 * the trigger, or fades and dips to 97% when the trigger is gone. On a
 * phone it is a card anchored near the top with 8px gutters that rises
 * into place, like the item dialogs; with reduced motion it only
 * cross-fades. The chrome (30px display title, borderless round close)
 * matches the item dialogs too.
 *
 * While a dialog is open the app root is inert, Tab wraps inside the
 * panel, and Escape closes the newest dialog only.
 */
const ThemeProvider = SCThemeProvider as any

const PHONE_QUERY = '(max-width: 720px)'
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'
/* WAAPI cannot read custom properties: these mirror --ease-* in global-styles. */
const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)'
const EASE_IN_OUT = 'cubic-bezier(0.65, 0, 0.35, 1)'
const EASE_EXIT = 'cubic-bezier(0.4, 0, 1, 1)'
const MORPH_MS = 480
const MORPH_CLOSE_MS = 360

type MotionMode = 'morph' | 'fade' | 'rise' | 'reduced'

interface MotionParts {
  scrim: HTMLElement
  panel: HTMLElement
  inner: HTMLElement
  glow: HTMLElement
}

const collectParts = (
  scrim: HTMLElement | null,
  panel: HTMLElement | null,
  inner: HTMLElement | null,
  glow: HTMLElement | null,
): MotionParts | null =>
  scrim && panel && inner && glow ? { scrim, panel, inner, glow } : null

const matches = (query: string) =>
  typeof window.matchMedia === 'function' && window.matchMedia(query).matches

/** A trigger can be morphed from only while it is on screen and has a size. */
const visibleRect = (element: HTMLElement | null): DOMRect | null => {
  if (!element || !document.contains(element)) return null
  const rect = element.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return null
  if (rect.bottom < 0 || rect.top > window.innerHeight) return null
  return rect
}

const pickMode = (trigger: HTMLElement | null): MotionMode => {
  if (matches(REDUCED_QUERY)) return 'reduced'
  if (matches(PHONE_QUERY)) return 'rise'
  return visibleRect(trigger) ? 'morph' : 'fade'
}

/* The panel's start frame: centred on the trigger and clipped to its size. */
const morphFrames = (from: DOMRect, to: DOMRect): Keyframe[] => {
  const dx = from.left + from.width / 2 - (to.left + to.width / 2)
  const dy = from.top + from.height / 2 - (to.top + to.height / 2)
  const ix = Math.max(0, (to.width - from.width) / 2)
  const iy = Math.max(0, (to.height - from.height) / 2)
  return [
    {
      transform: `translate(${dx}px, ${dy}px)`,
      clipPath: `inset(${iy}px ${ix}px round 12px)`,
    },
    {
      transform: 'translate(0px, 0px)',
      clipPath: 'inset(0px 0px round 24px)',
    },
  ]
}

/*
 * Open dialogs, oldest first. While any is open the app root is inert, so
 * neither Tab nor a screen reader reaches the page behind; only the newest
 * dialog answers Escape. Portals (this dialog, Modal.confirm, the wallet
 * modal) sit beside the root and stay live.
 */
const openDialogs: object[] = []

const appRoot = () => document.querySelector('#root')

const holdPage = (dialog: object) => {
  openDialogs.push(dialog)
  if (openDialogs.length === 1) appRoot()?.setAttribute('inert', '')
}

const releasePage = (dialog: object) => {
  const index = openDialogs.indexOf(dialog)
  if (index !== -1) openDialogs.splice(index, 1)
  if (openDialogs.length === 0) appRoot()?.removeAttribute('inert')
}

const isNewest = (dialog: object) =>
  openDialogs[openDialogs.length - 1] === dialog

const TABBABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/** The panel's tabbable controls, in order: enabled, shown and not inert. */
const tabbables = (panel: HTMLElement) =>
  [...panel.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (node) =>
      !node.matches(':disabled') &&
      node.getAttribute('tabindex') !== '-1' &&
      !node.closest('[inert]') &&
      node.getClientRects().length > 0,
  )

const FADE_IN: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }]
const FADE_OUT: Keyframe[] = [{ opacity: 1 }, { opacity: 0 }]

/*
 * Entrances fill backwards only: once they end the element is back on its
 * own styles, so no transform is left behind to trap fixed descendants.
 */
const animateIn = (
  { scrim, panel, inner, glow }: MotionParts,
  trigger: HTMLElement | null,
): Animation[] => {
  if (typeof panel.animate !== 'function') return []
  const mode = pickMode(trigger)
  const fill = 'backwards' as const
  if (mode === 'reduced')
    return [
      scrim.animate(FADE_IN, { duration: 120, easing: 'linear', fill }),
      panel.animate(FADE_IN, { duration: 120, easing: 'linear', fill }),
      glow.animate(FADE_IN, { duration: 120, easing: 'linear', fill }),
    ]
  const scrimIn = scrim.animate(FADE_IN, {
    duration: 240,
    easing: EASE_OUT,
    fill,
  })
  if (mode === 'rise')
    return [
      scrimIn,
      panel.animate(
        [
          { opacity: 0, transform: 'translateY(12px) scale(0.96)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ],
        { duration: 420, easing: EASE_OUT, fill },
      ),
      glow.animate(FADE_IN, { duration: 200, delay: 240, fill }),
    ]
  if (mode === 'fade')
    return [
      scrimIn,
      panel.animate(
        [
          { opacity: 0, transform: 'scale(0.97)' },
          { opacity: 1, transform: 'scale(1)' },
        ],
        { duration: 260, easing: EASE_OUT, fill },
      ),
      glow.animate(FADE_IN, { duration: 260, easing: EASE_OUT, fill }),
    ]
  const from = visibleRect(trigger) as DOMRect
  return [
    scrimIn,
    panel.animate(morphFrames(from, panel.getBoundingClientRect()), {
      duration: MORPH_MS,
      easing: EASE_IN_OUT,
      fill,
    }),
    inner.animate(
      [
        { opacity: 0, transform: 'translateY(6px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 260, delay: 240, easing: EASE_OUT, fill },
    ),
    glow.animate(FADE_IN, {
      duration: 200,
      delay: MORPH_MS * 0.7,
      easing: EASE_OUT,
      fill,
    }),
  ]
}

/* Exits hold their last frame until the dialog unmounts. */
const animateOut = (
  { scrim, panel, inner, glow }: MotionParts,
  trigger: HTMLElement | null,
): Animation[] => {
  if (typeof panel.animate !== 'function') return []
  const mode = pickMode(trigger)
  const fill = 'forwards' as const
  if (mode === 'reduced')
    return [
      scrim.animate(FADE_OUT, { duration: 120, easing: 'linear', fill }),
      panel.animate(FADE_OUT, { duration: 120, easing: 'linear', fill }),
      glow.animate(FADE_OUT, { duration: 120, easing: 'linear', fill }),
    ]
  if (mode === 'fade' || mode === 'rise')
    return [
      scrim.animate(FADE_OUT, { duration: 200, easing: EASE_EXIT, fill }),
      glow.animate(FADE_OUT, { duration: 160, easing: EASE_EXIT, fill }),
      panel.animate(
        [
          { opacity: 1, transform: 'scale(1)' },
          { opacity: 0, transform: 'scale(0.97)' },
        ],
        { duration: 200, easing: EASE_EXIT, fill },
      ),
    ]
  const [start, end] = morphFrames(
    visibleRect(trigger) as DOMRect,
    panel.getBoundingClientRect(),
  )
  return [
    scrim.animate(FADE_OUT, {
      duration: MORPH_CLOSE_MS,
      easing: EASE_IN_OUT,
      fill,
    }),
    glow.animate(FADE_OUT, { duration: 120, easing: EASE_EXIT, fill }),
    inner.animate(FADE_OUT, { duration: 140, easing: EASE_EXIT, fill }),
    panel.animate([end, { ...start, opacity: 0 }], {
      duration: MORPH_CLOSE_MS,
      easing: EASE_IN_OUT,
      fill,
    }),
  ]
}

const Overlay = styled.div<{ $leaving?: boolean }>`
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 64px 16px;
  overflow: auto;
  overscroll-behavior: contain;
  background: color-mix(in srgb, var(--stage) 58%, transparent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  pointer-events: ${({ $leaving }) => ($leaving ? 'none' : 'auto')};

  @media ${PHONE_QUERY} {
    padding: 12px 8px 24px;
  }
`

/* Lays the dialog out; the glow layer and the panel stack inside it. */
const Shell = styled.div<{ $width?: string | number; $centered?: boolean }>`
  position: relative;
  width: 100%;
  max-width: min(
    ${({ $width }) =>
      typeof $width === 'number' ? `${$width}px` : $width || '520px'},
    calc(100vw - 32px)
  );
  margin-block: ${({ $centered }) => ($centered ? 'auto' : '0')};

  @media ${PHONE_QUERY} {
    max-width: min(
      ${({ $width }) =>
        typeof $width === 'number' ? `${$width}px` : $width || '520px'},
      100%
    );
  }
`

/* Shadow and glow sit beside the panel so the clip-path never cuts them. */
const Glow = styled.div`
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: var(--radius-xl);
  box-shadow:
    var(--shadow-overlay),
    0 40px 100px -48px color-mix(in srgb, var(--color-primary) 50%, transparent);
  pointer-events: none;

  @media ${PHONE_QUERY} {
    border-radius: var(--radius-lg);
  }
`

const ModalContent = styled.div`
  position: relative;
  z-index: 1;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  width: 100%;
  overflow: clip;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  box-shadow: inset 0 1px 0 var(--glass-highlight);
  color: var(--color-text);
  outline: none;

  /* The aurora along the top edge: a lit 1px line and its faint glow. */
  &::before {
    content: '';
    position: absolute;
    inset: 0 0 auto;
    z-index: -1;
    height: 120px;
    background:
      radial-gradient(
        55% 90px at 22% 0%,
        color-mix(in srgb, var(--aurora-b) 22%, transparent),
        transparent 72%
      ),
      radial-gradient(
        45% 80px at 78% 0%,
        color-mix(in srgb, var(--aurora-c) 18%, transparent),
        transparent 72%
      );
    pointer-events: none;
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0 28px auto;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      var(--aurora-b) 22%,
      var(--color-primary) 52%,
      var(--aurora-c) 80%,
      transparent
    );
    box-shadow: 0 0 14px 1px
      color-mix(in srgb, var(--color-primary) 55%, transparent);
    pointer-events: none;
  }

  @media ${PHONE_QUERY} {
    border-radius: var(--radius-lg);
  }
`

/* Everything inside the panel; it fades up once the morph is under way. */
const Inner = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
`

/* The dialog title: display type at the section-title size, as in the item dialogs. */
const ModalHeader = styled.h2`
  margin: 0;
  padding: 26px 68px 4px 28px;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: clamp(24px, 1vw + 18px, 30px);
  line-height: 1.1;
  font-weight: 500;
  letter-spacing: -0.03em;
  overflow-wrap: anywhere;

  @media ${PHONE_QUERY} {
    padding: 20px 60px 4px 18px;
  }
`

const ModalBody = styled.div`
  padding: 18px 28px 26px;
  color: var(--color-text);
  font-size: var(--fs-body);
  line-height: var(--lh-body);

  &:first-child,
  .ui-modal-close + & {
    padding-top: 26px;
  }

  @media ${PHONE_QUERY} {
    padding: 14px 18px 20px;

    &:first-child,
    .ui-modal-close + & {
      padding-top: 20px;
    }
  }
`

const ModalFooter = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 28px 22px;
  border-top: 1px solid var(--glass-border);

  @media ${PHONE_QUERY} {
    padding: 14px 18px 18px;
  }
`

/* Borderless at rest; the hairline and fill come in on hover. */
const CloseButton = styled.button`
  ${ghostIconButton}
  position: absolute;
  top: 22px;
  right: 22px;
  z-index: 1;
  width: 34px;
  height: 34px;

  @media ${PHONE_QUERY} {
    top: 16px;
    right: 14px;
  }
`

const ConfirmText = styled.div`
  color: var(--color-muted);
`

interface ModalProps {
  visible?: boolean
  title?: React.ReactNode
  footer?: React.ReactNode | null
  onCancel?: () => void
  onOk?: () => void
  width?: string | number
  closable?: boolean
  style?: React.CSSProperties
  className?: string
  children?: React.ReactNode
  centered?: boolean
  destroyOnClose?: boolean
  /** Internal: Modal.confirm renders an alertdialog. */
  role?: 'dialog' | 'alertdialog'
}

interface ConfirmConfig {
  title?: React.ReactNode
  content?: React.ReactNode
  okText?: string
  cancelText?: string
  onOk?: () => void
  onCancel?: () => void
}

interface ModalComponent extends React.FC<ModalProps> {
  confirm: (config: ConfirmConfig) => { destroy: () => void }
}

const Modal: ModalComponent = ({
  visible,
  title,
  footer,
  onCancel,
  onOk,
  width = '520px',
  closable = true,
  style,
  className,
  children,
  centered = false,
  role = 'dialog',
}) => {
  const overlayRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const dialogKey = useRef({}).current

  // Callers pass inline handlers; reading the latest one through a ref keeps
  // the open/close effect tied to `visible` alone, so a parent re-render
  // never moves focus or re-subscribes the key listener.
  const cancelRef = useRef(onCancel)
  cancelRef.current = onCancel

  // Stay mounted after `visible` drops until the exit animation has run.
  const [shown, setShown] = useState(Boolean(visible))
  if (visible && !shown) setShown(true)
  const leaving = !visible && shown

  // Open: remember the trigger and lock the page before the first paint,
  // then morph in from the trigger. Closing or unmounting unlocks the page.
  useLayoutEffect(() => {
    if (!visible) return undefined
    const panel = contentRef.current
    const active = document.activeElement
    const opener =
      active instanceof HTMLElement &&
      active !== document.body &&
      !panel?.contains(active)
        ? active
        : null
    openerRef.current = opener

    const { body } = document
    const previousOverflow = body.style.overflow
    body.style.overflow = 'hidden'

    const current = collectParts(
      overlayRef.current,
      contentRef.current,
      innerRef.current,
      glowRef.current,
    )
    const animations = current ? animateIn(current, opener) : []

    return () => {
      animations.forEach((animation) => animation.cancel())
      body.style.overflow = previousOverflow
    }
  }, [visible])

  // Focus, the inert page and the Escape fallback. This is a passive effect
  // on purpose: React restores the focus it saw before a commit once the DOM
  // is updated, so focus moved during a layout cleanup would snap back into
  // the closing dialog.
  useEffect(() => {
    if (!visible) return undefined
    const opener = openerRef.current
    // Escape from inside the panel is handled (and stopped) on the panel.
    // This catches it when focus has dropped to <body> or the scrim; keys
    // from another layer, such as the wallet modal, are left to that layer.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (!isNewest(dialogKey)) return
      const { target } = event
      const fromPage =
        target === document.body ||
        target === document.documentElement ||
        (target instanceof Node && overlayRef.current?.contains(target))
      if (!fromPage) return
      event.preventDefault()
      cancelRef.current?.()
    }
    holdPage(dialogKey)
    document.addEventListener('keydown', onKeyDown)
    contentRef.current?.focus({ preventScroll: true })
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      // The page must be live again before focus can go back into it.
      releasePage(dialogKey)
      // Hand focus back to whatever opened the dialog.
      if (opener && document.contains(opener))
        opener.focus({ preventScroll: true })
    }
  }, [visible, dialogKey])

  // Escape closes this dialog only; Tab and Shift+Tab wrap inside the panel.
  // Both stop here, so a dialog underneath (or its own trap) never acts on
  // them. Keys from elsewhere, such as a wallet modal on top, pass through.
  const handlePanelKeyDown = useCallback((event: React.KeyboardEvent) => {
    const panel = contentRef.current
    if (!panel || event.defaultPrevented) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      cancelRef.current?.()
      return
    }
    if (event.key !== 'Tab') return
    const active = document.activeElement
    if (!active || !panel.contains(active)) return
    event.stopPropagation()
    const nodes = tabbables(panel)
    if (nodes.length === 0) {
      event.preventDefault()
      return
    }
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    if (event.shiftKey && (active === first || active === panel)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }, [])

  // Exit: reverse into the trigger (or fade), then unmount.
  useLayoutEffect(() => {
    if (!leaving) return undefined
    const current = collectParts(
      overlayRef.current,
      contentRef.current,
      innerRef.current,
      glowRef.current,
    )
    const animations = current ? animateOut(current, openerRef.current) : []
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      setShown(false)
    }
    if (animations.length === 0) finish()
    else
      Promise.all(animations.map((animation) => animation.finished))
        .then(finish)
        .catch(finish)
    // Safety net if an animation never settles (a hidden tab, say).
    const timer = window.setTimeout(finish, MORPH_CLOSE_MS + 200)
    return () => {
      settled = true
      window.clearTimeout(timer)
      animations.forEach((animation) => animation.cancel())
    }
  }, [leaving])

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(e.target as Node))
        onCancel && onCancel()
    },
    [onCancel],
  )

  // A hidden dialog is never rendered, so `destroyOnClose` and the default
  // behave the same once the exit animation has run.
  if (!shown) return null

  const defaultFooter = (
    <>
      <Button onClick={onCancel}>Cancel</Button>
      <Button type="primary" onClick={onOk}>
        OK
      </Button>
    </>
  )

  const modalContent = (
    <Overlay
      ref={overlayRef}
      $leaving={leaving}
      onClick={handleOverlayClick}
      className="ui-modal-mask"
    >
      <Shell $width={width} $centered={centered} className="ui-modal-wrap">
        <Glow ref={glowRef} aria-hidden="true" />
        <ModalContent
          ref={contentRef}
          role={role}
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          tabIndex={-1}
          onKeyDown={handlePanelKeyDown}
          style={style}
          className={joinClassNames('ui-modal-content', className)}
        >
          <Inner ref={innerRef}>
            {closable && (
              <CloseButton
                type="button"
                className="ui-modal-close"
                onClick={onCancel}
                aria-label="Close"
              >
                <KitIcon name="close" size={16} />
              </CloseButton>
            )}
            {title && (
              <ModalHeader id={titleId} className="ui-modal-header">
                {title}
              </ModalHeader>
            )}
            <ModalBody className="ui-modal-body">{children}</ModalBody>
            {footer !== null && (
              <ModalFooter className="ui-modal-footer">
                {footer === undefined ? defaultFooter : footer}
              </ModalFooter>
            )}
          </Inner>
        </ModalContent>
      </Shell>
    </Overlay>
  )

  return createPortal(modalContent, document.body)
}

// Static confirm method
Modal.confirm = ({
  title,
  content,
  okText = 'OK',
  cancelText = 'Cancel',
  onOk,
  onCancel,
}: ConfirmConfig) => {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  // Follow the active theme from the body attribute
  const themeAttr = document.body.getAttribute('data-theme')
  const theme =
    themeAttr === 'dark'
      ? darkTheme
      : themeAttr === 'kleros'
        ? klerosTheme
        : lightTheme

  const destroy = () => {
    root.unmount()
    if (container.parentNode) container.remove()
  }

  const handleOk = () => {
    onOk && onOk()
    destroy()
  }

  const handleCancel = () => {
    onCancel && onCancel()
    destroy()
  }

  const ConfirmDialog = () => (
    <ThemeProvider theme={theme}>
      <Modal
        visible
        centered
        role="alertdialog"
        title={title}
        width="416px"
        closable={false}
        onCancel={handleCancel}
        className="ui-modal-confirm"
        footer={
          <>
            <Button onClick={handleCancel}>{cancelText}</Button>
            <Button type="primary" onClick={handleOk}>
              {okText}
            </Button>
          </>
        }
      >
        {content && <ConfirmText>{content}</ConfirmText>}
      </Modal>
    </ThemeProvider>
  )

  root.render(<ConfirmDialog />)

  return { destroy }
}

export default Modal
