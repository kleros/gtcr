import React, { useState, useRef, useEffect, useCallback } from 'react'
import styled, { css } from 'styled-components'
import { floatingEntrance, joinClassNames, overlayPanel } from './kit-styles'

type PopoverPlacement =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'topLeft'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomRight'

const Wrapper = styled.span`
  position: relative;
  display: inline-flex;
`

const getPlacementStyles = (placement: PopoverPlacement) => {
  switch (placement) {
    case 'bottom':
      return css`
        top: 100%;
        left: 50%;
        margin-top: 8px;
        transform: translateX(-50%);
      `
    case 'bottomLeft':
      return css`
        top: 100%;
        left: 0;
        margin-top: 8px;
      `
    case 'bottomRight':
      return css`
        top: 100%;
        right: 0;
        margin-top: 8px;
      `
    case 'topLeft':
      return css`
        bottom: 100%;
        left: 0;
        margin-bottom: 8px;
      `
    case 'topRight':
      return css`
        bottom: 100%;
        right: 0;
        margin-bottom: 8px;
      `
    case 'left':
      return css`
        top: 50%;
        right: 100%;
        margin-right: 8px;
        transform: translateY(-50%);
      `
    case 'right':
      return css`
        top: 50%;
        left: 100%;
        margin-left: 8px;
        transform: translateY(-50%);
      `
    case 'top':
    default:
      return css`
        bottom: 100%;
        left: 50%;
        margin-bottom: 8px;
        transform: translateX(-50%);
      `
  }
}

/* Glass panel like the app bar's menus; no arrow. It rises in from its anchor side. */
const PopoverContent = styled.div<{ $placement: PopoverPlacement }>`
  position: absolute;
  z-index: 1060;
  min-width: 220px;
  max-width: 360px;
  ${overlayPanel}
  ${({ $placement }) => getPlacementStyles($placement)}
  ${({ $placement }) => floatingEntrance($placement.startsWith('top'))}
`

const PopoverTitle = styled.div`
  padding: 14px 16px 0;
  color: var(--color-text);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  font-weight: 500;
`

const PopoverInner = styled.div`
  padding: 12px 16px 14px;
  color: var(--color-text);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
`

interface PopoverProps {
  placement?: PopoverPlacement
  title?: React.ReactNode
  content?: React.ReactNode
  trigger?: 'hover' | 'click'
  visible?: boolean
  onVisibleChange?: (visible: boolean) => void
  arrowPointAtCenter?: boolean
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

const Popover: React.FC<PopoverProps> = ({
  placement = 'top',
  title,
  content,
  trigger = 'hover',
  visible: controlledVisible,
  onVisibleChange,
  children,
  style,
  className,
}) => {
  const [internalVisible, setInternalVisible] = useState(false)
  const isControlled = controlledVisible !== undefined
  const visible = isControlled ? controlledVisible : internalVisible
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setVisible = useCallback(
    (val: boolean) => {
      if (!isControlled) setInternalVisible(val)

      onVisibleChange && onVisibleChange(val)
    },
    [isControlled, onVisibleChange],
  )

  // Click outside and Escape close a click popover. Escape is handled in the
  // capture phase and stopped, so a dialog around the popover stays open.
  useEffect(() => {
    if (!visible || trigger !== 'click') return undefined
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        setVisible(false)
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      const wrapper = wrapperRef.current
      const hadFocus = wrapper?.contains(document.activeElement)
      setVisible(false)
      // Focus inside the panel goes back to the trigger before it unmounts.
      if (hadFocus)
        [
          ...(wrapper?.querySelectorAll<HTMLElement>(
            'button, [href], input, [tabindex]:not([tabindex="-1"])',
          ) ?? []),
        ]
          .find((node) => !contentRef.current?.contains(node))
          ?.focus()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape, true)
    }
  }, [visible, trigger, setVisible])

  useEffect(
    () => () => {
      if (enterTimer.current) clearTimeout(enterTimer.current)
      if (leaveTimer.current) clearTimeout(leaveTimer.current)
    },
    [],
  )

  // The trigger toggles; clicks inside the panel (a field, a label) do not.
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (contentRef.current?.contains(e.target as Node)) return
      if (trigger === 'click') setVisible(!visible)
    },
    [trigger, visible, setVisible],
  )

  const handleMouseEnter = useCallback(() => {
    if (trigger === 'hover') {
      if (leaveTimer.current) clearTimeout(leaveTimer.current)
      enterTimer.current = setTimeout(() => setVisible(true), 100)
    }
  }, [trigger, setVisible])

  const handleMouseLeave = useCallback(() => {
    if (trigger === 'hover') {
      if (enterTimer.current) clearTimeout(enterTimer.current)
      leaveTimer.current = setTimeout(() => setVisible(false), 100)
    }
  }, [trigger, setVisible])

  return (
    <Wrapper
      ref={wrapperRef}
      className="ui-popover"
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {visible && (
        <PopoverContent
          ref={contentRef}
          $placement={placement}
          style={style}
          className={joinClassNames('ui-popover-content', className)}
        >
          {title && (
            <PopoverTitle className="ui-popover-title">{title}</PopoverTitle>
          )}
          {content && (
            <PopoverInner className="ui-popover-inner">{content}</PopoverInner>
          )}
        </PopoverContent>
      )}
    </Wrapper>
  )
}

export default Popover
