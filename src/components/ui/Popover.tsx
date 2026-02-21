import React, { useState, useRef, useEffect, useCallback } from 'react'
import styled, { css } from 'styled-components'

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
  display: inline-flex;
  position: relative;
`

const getPlacementStyles = (placement: PopoverPlacement) => {
  switch (placement) {
    case 'bottom':
      return css`
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        margin-top: 10px;
      `
    case 'bottomLeft':
      return css`
        top: 100%;
        left: 0;
        margin-top: 10px;
      `
    case 'bottomRight':
      return css`
        top: 100%;
        right: 0;
        margin-top: 10px;
      `
    case 'topLeft':
      return css`
        bottom: 100%;
        left: 0;
        margin-bottom: 10px;
      `
    case 'topRight':
      return css`
        bottom: 100%;
        right: 0;
        margin-bottom: 10px;
      `
    case 'left':
      return css`
        top: 50%;
        right: 100%;
        transform: translateY(-50%);
        margin-right: 10px;
      `
    case 'right':
      return css`
        top: 50%;
        left: 100%;
        transform: translateY(-50%);
        margin-left: 10px;
      `
    case 'top':
    default:
      return css`
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        margin-bottom: 10px;
      `
  }
}

const getArrowStyles = (placement: PopoverPlacement) => {
  switch (placement) {
    case 'bottom':
      return css`
        top: -4px;
        left: 50%;
        transform: translateX(-50%) rotate(45deg);
        border-top: 1px solid ${({ theme }) => theme.borderColor};
        border-left: 1px solid ${({ theme }) => theme.borderColor};
      `
    case 'bottomLeft':
      return css`
        top: -4px;
        left: 16px;
        transform: rotate(45deg);
        border-top: 1px solid ${({ theme }) => theme.borderColor};
        border-left: 1px solid ${({ theme }) => theme.borderColor};
      `
    case 'bottomRight':
      return css`
        top: -4px;
        right: 16px;
        transform: rotate(45deg);
        border-top: 1px solid ${({ theme }) => theme.borderColor};
        border-left: 1px solid ${({ theme }) => theme.borderColor};
      `
    case 'topLeft':
      return css`
        bottom: -4px;
        left: 16px;
        transform: rotate(45deg);
        border-bottom: 1px solid ${({ theme }) => theme.borderColor};
        border-right: 1px solid ${({ theme }) => theme.borderColor};
      `
    case 'topRight':
      return css`
        bottom: -4px;
        right: 16px;
        transform: rotate(45deg);
        border-bottom: 1px solid ${({ theme }) => theme.borderColor};
        border-right: 1px solid ${({ theme }) => theme.borderColor};
      `
    case 'left':
      return css`
        top: 50%;
        right: -4px;
        transform: translateY(-50%) rotate(45deg);
        border-top: 1px solid ${({ theme }) => theme.borderColor};
        border-right: 1px solid ${({ theme }) => theme.borderColor};
      `
    case 'right':
      return css`
        top: 50%;
        left: -4px;
        transform: translateY(-50%) rotate(45deg);
        border-bottom: 1px solid ${({ theme }) => theme.borderColor};
        border-left: 1px solid ${({ theme }) => theme.borderColor};
      `
    case 'top':
    default:
      return css`
        bottom: -4px;
        left: 50%;
        transform: translateX(-50%) rotate(45deg);
        border-bottom: 1px solid ${({ theme }) => theme.borderColor};
        border-right: 1px solid ${({ theme }) => theme.borderColor};
      `
  }
}

const PopoverContent = styled.div<{ $placement: PopoverPlacement }>`
  position: absolute;
  z-index: 1060;
  min-width: 177px;
  max-width: 350px;
  background: ${({ theme }) => theme.componentBackground};
  border: 1px solid ${({ theme }) => theme.borderColor};
  border-radius: 4px;
  box-shadow: ${({ theme }) => `0 4px 12px ${theme.shadowColor}`};
  color: ${({ theme }) => theme.textPrimary};

  ${({ $placement }) => getPlacementStyles($placement)}
`

const PopoverArrow = styled.span<{ $placement: PopoverPlacement }>`
  position: absolute;
  width: 8px;
  height: 8px;
  background: ${({ theme }) => theme.componentBackground};
  ${({ $placement }) => getArrowStyles($placement)}
`

const PopoverTitle = styled.div`
  padding: 8px 16px;
  font-weight: 500;
  font-size: 14px;
  border-bottom: 1px solid ${({ theme }) => theme.borderColor};
  color: ${({ theme }) => theme.textPrimary};
`

const PopoverInner = styled.div`
  padding: 12px 16px;
  font-size: 14px;
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
  _arrowPointAtCenter,
  children,
  style,
  className,
}) => {
  const [internalVisible, setInternalVisible] = useState(false)
  const isControlled = controlledVisible !== undefined
  const visible = isControlled ? controlledVisible : internalVisible
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setVisible = useCallback(
    (val: boolean) => {
      if (!isControlled) setInternalVisible(val)

      onVisibleChange && onVisibleChange(val)
    },
    [isControlled, onVisibleChange],
  )

  // Click outside
  useEffect(() => {
    if (!visible || trigger !== 'click') return
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        setVisible(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [visible, trigger, setVisible])

  useEffect(
    () => () => {
      if (enterTimer.current) clearTimeout(enterTimer.current)
      if (leaveTimer.current) clearTimeout(leaveTimer.current)
    },
    [],
  )

  const handleClick = useCallback(() => {
    if (trigger === 'click') setVisible(!visible)
  }, [trigger, visible, setVisible])

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
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {visible && (
        <PopoverContent
          $placement={placement}
          style={style}
          className={className}
        >
          <PopoverArrow $placement={placement} />
          {title && <PopoverTitle>{title}</PopoverTitle>}
          {content && <PopoverInner>{content}</PopoverInner>}
        </PopoverContent>
      )}
    </Wrapper>
  )
}

export default Popover
