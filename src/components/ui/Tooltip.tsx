import React, { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import styled, { css, DefaultTheme } from 'styled-components'

type Placement = 'top' | 'bottom' | 'left' | 'right'

const Wrapper = styled.span`
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
`

const getArrowStyles = (placement: Placement, theme: DefaultTheme) => {
  const bg =
    theme.tooltipBg ||
    (theme.name === 'dark' ? theme.elevatedBackground : theme.secondaryColor)
  const border =
    theme.tooltipBorder ||
    (theme.name === 'dark' ? theme.borderColor : theme.secondaryColor)

  switch (placement) {
    case 'bottom':
      return css`
        top: -4px;
        left: 50%;
        transform: translateX(-50%) rotate(45deg);
        border-top: 1px solid ${border};
        border-left: 1px solid ${border};
        background: ${bg};
      `
    case 'left':
      return css`
        top: 50%;
        right: -4px;
        transform: translateY(-50%) rotate(45deg);
        border-top: 1px solid ${border};
        border-right: 1px solid ${border};
        background: ${bg};
      `
    case 'right':
      return css`
        top: 50%;
        left: -4px;
        transform: translateY(-50%) rotate(45deg);
        border-bottom: 1px solid ${border};
        border-left: 1px solid ${border};
        background: ${bg};
      `
    case 'top':
    default:
      return css`
        bottom: -4px;
        left: 50%;
        transform: translateX(-50%) rotate(45deg);
        border-bottom: 1px solid ${border};
        border-right: 1px solid ${border};
        background: ${bg};
      `
  }
}

const TooltipBubble = styled.div`
  position: fixed;
  z-index: 1070;
  width: max-content;
  max-width: 250px;
  padding: 6px 8px;
  font-size: 12px;
  line-height: 1.5;
  border-radius: 6px;
  pointer-events: none;

  background: ${({ theme }) => theme.tooltipBg};
  color: ${({ theme }) => theme.tooltipText};
  border: 1px solid ${({ theme }) => theme.tooltipBorder};
  box-shadow: ${({ theme }) =>
    `0 2px 8px ${theme.tooltipShadow || theme.shadowColor}`};
`

const TooltipArrow = styled.span<{ $placement: Placement }>`
  position: absolute;
  width: 8px;
  height: 8px;
  ${({ $placement, theme }) => getArrowStyles($placement, theme)}
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
    case 'top':
      return {
        top: rect.top,
        left: rect.left + rect.width / 2,
        transform: 'translate(-50%, -100%) translateY(-8px)',
      }
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
  }
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
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updatePosition = useCallback(() => {
    if (!wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()
    setPosStyle(getPositionStyle(placement, rect))
  }, [placement])

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

  return (
    <Wrapper
      ref={wrapperRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
      {visible &&
        createPortal(
          <TooltipBubble style={posStyle}>
            <TooltipArrow $placement={placement} />
            {title}
          </TooltipBubble>,
          document.body,
        )}
    </Wrapper>
  )
}

export default Tooltip
