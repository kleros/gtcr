import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
} from 'react'
import { createPortal } from 'react-dom'
import styled, { keyframes } from 'styled-components'
import { kitRadius, kitType } from './kit-styles'

type Placement = 'top' | 'bottom' | 'left' | 'right'

const Wrapper = styled.span`
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
`

const tipIn = keyframes`
  from { opacity: 0; scale: 0.96; }
  to { opacity: 1; scale: 1; }
`

/*
 * Tip: a small solid raised surface with a hairline, radius 10, no arrow.
 * It fades and grows in with the individual scale property, so it composes
 * with the inline placement transform. The trigger is described by the tip
 * while it shows, Escape dismisses it, and it never leaves the viewport
 * sideways (8px margin).
 */
const VIEWPORT_EDGE = 8
const GAP = 8
const TooltipBubble = styled.div`
  position: fixed;
  z-index: 1070;
  width: max-content;
  max-width: 280px;
  padding: 7px 11px;
  border: 1px solid var(--glass-border);
  border-radius: ${kitRadius.control};
  background: var(--color-surface);
  box-shadow:
    inset 0 1px 0 var(--glass-highlight),
    var(--shadow-overlay);
  color: var(--color-text);
  font-size: ${kitType.meta};
  line-height: ${kitType.metaLine};
  pointer-events: none;
  animation: ${tipIn} 160ms var(--ease-out) both;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

interface TooltipProps {
  title?: React.ReactNode
  placement?: Placement
  children?: React.ReactNode
  mouseEnterDelay?: number
  mouseLeaveDelay?: number
}

const getPositionStyle = (
  placement: Placement,
  rect: DOMRect,
): React.CSSProperties => {
  switch (placement) {
    case 'bottom':
      return {
        top: rect.bottom,
        left: rect.left + rect.width / 2,
        transform: 'translate(-50%, 0) translateY(8px)',
      }
    case 'left':
      return {
        top: rect.top + rect.height / 2,
        left: rect.left,
        transform: 'translate(-100%, -50%) translateX(-8px)',
      }
    case 'right':
      return {
        top: rect.top + rect.height / 2,
        left: rect.right,
        transform: 'translate(0, -50%) translateX(8px)',
      }
    case 'top':
    default:
      return {
        top: rect.top,
        left: rect.left + rect.width / 2,
        transform: 'translate(-50%, -100%) translateY(-8px)',
      }
  }
}

/** Where the bubble's left edge lands for a placement, before clamping. */
const leftEdge = (
  style: React.CSSProperties,
  placement: Placement,
  width: number,
) => {
  const left = Number(style.left) || 0
  if (placement === 'left') return left - width - GAP
  if (placement === 'right') return left + GAP
  return left - width / 2
}

const Tooltip: React.FC<TooltipProps> = ({
  title,
  placement = 'top',
  children,
  mouseEnterDelay = 0.1,
  mouseLeaveDelay = 0.1,
}) => {
  const [visible, setVisible] = useState(false)
  const [posStyle, setPosStyle] = useState<React.CSSProperties>({})
  const [shift, setShift] = useState(0)
  const tipId = useId()
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updatePosition = useCallback(() => {
    if (!wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()
    setPosStyle(getPositionStyle(placement, rect))
    setShift(0)
  }, [placement])

  // Once the bubble has a width, slide it back inside the viewport.
  useLayoutEffect(() => {
    const bubble = bubbleRef.current
    if (!visible || !bubble) return
    const width = bubble.offsetWidth
    const left = leftEdge(posStyle, placement, width)
    const max = window.innerWidth - width - VIEWPORT_EDGE
    setShift(Math.max(VIEWPORT_EDGE, Math.min(left, max)) - left)
  }, [visible, posStyle, placement])

  // Escape dismisses the tip without moving focus (WCAG 1.4.13).
  useEffect(() => {
    if (!visible) return undefined
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisible(false)
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [visible])

  const handleEnter = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    enterTimer.current = setTimeout(() => {
      updatePosition()
      setVisible(true)
    }, mouseEnterDelay * 1000)
  }, [mouseEnterDelay, updatePosition])

  const handleLeave = useCallback(() => {
    if (enterTimer.current) clearTimeout(enterTimer.current)
    leaveTimer.current = setTimeout(() => {
      setVisible(false)
    }, mouseLeaveDelay * 1000)
  }, [mouseLeaveDelay])

  useEffect(
    () => () => {
      if (enterTimer.current) clearTimeout(enterTimer.current)
      if (leaveTimer.current) clearTimeout(leaveTimer.current)
    },
    [],
  )

  if (!title) return <>{children}</>

  const child =
    visible && React.isValidElement<{ 'aria-describedby'?: string }>(children)
      ? React.cloneElement(children, {
          'aria-describedby':
            [children.props['aria-describedby'], tipId]
              .filter(Boolean)
              .join(' ') || undefined,
        })
      : children

  return (
    <Wrapper
      ref={wrapperRef}
      className="ui-tooltip-trigger"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      {child}
      {visible &&
        createPortal(
          <TooltipBubble
            ref={bubbleRef}
            id={tipId}
            role="tooltip"
            className="ui-tooltip"
            style={{
              ...posStyle,
              left: (Number(posStyle.left) || 0) + shift,
            }}
          >
            {title}
          </TooltipBubble>,
          document.body,
        )}
    </Wrapper>
  )
}

export default Tooltip
