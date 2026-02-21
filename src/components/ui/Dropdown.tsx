import React, { useState, useRef, useCallback, useEffect } from 'react'
import styled, { css } from 'styled-components'

const Wrapper = styled.div`
  display: inline-block;
  position: relative;
`

const placementStyles: Record<string, any> = {
  bottomLeft: css`
    top: 100%;
    left: 0;
    margin-top: 4px;
  `,
  bottomRight: css`
    top: 100%;
    right: 0;
    margin-top: 4px;
  `,
  bottomCenter: css`
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: 4px;
  `,
  topLeft: css`
    bottom: 100%;
    left: 0;
    margin-bottom: 4px;
  `,
  topRight: css`
    bottom: 100%;
    right: 0;
    margin-bottom: 4px;
  `,
  topCenter: css`
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 4px;
  `
}

const Overlay = styled.div<{ $visible?: boolean; $placement?: string }>`
  position: absolute;
  z-index: 1050;
  min-width: 120px;
  background: ${({ theme }) => theme.componentBackground};
  border-radius: 4px;
  box-shadow: 0 3px 6px -4px rgba(0, 0, 0, 0.12),
    0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05);
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  visibility: ${({ $visible }) => ($visible ? 'visible' : 'hidden')};
  transition: opacity 0.2s, visibility 0.2s;
  ${({ $placement }) => placementStyles[$placement || 'bottomLeft'] || placementStyles.bottomLeft}
`

interface DropdownProps {
  overlay?: React.ReactNode
  trigger?: string[]
  visible?: boolean
  onVisibleChange?: (visible: boolean) => void
  placement?: string
  children?: React.ReactNode
  disabled?: boolean
}

const Dropdown: React.FC<DropdownProps> = ({
  overlay,
  trigger = ['hover'],
  visible: controlledVisible,
  onVisibleChange,
  placement = 'bottomLeft',
  children,
  disabled = false
}) => {
  const [internalVisible, setInternalVisible] = useState(false)
  const isControlled = controlledVisible !== undefined
  const isVisible = isControlled ? controlledVisible : internalVisible
  const wrapperRef = useRef<HTMLDivElement>(null)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setVisible = useCallback(
    (val: boolean) => {
      if (disabled) return
      if (!isControlled) setInternalVisible(val)
      if (onVisibleChange) onVisibleChange(val)
    },
    [disabled, isControlled, onVisibleChange]
  )

  const handleClick = useCallback(() => {
    if (trigger.includes('click')) {
      setVisible(!isVisible)
    }
  }, [trigger, isVisible, setVisible])

  const handleMouseEnter = useCallback(() => {
    if (trigger.includes('hover')) {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = null
      }
      setVisible(true)
    }
  }, [trigger, setVisible])

  const handleMouseLeave = useCallback(() => {
    if (trigger.includes('hover')) {
      hoverTimeoutRef.current = setTimeout(() => {
        setVisible(false)
      }, 100)
    }
  }, [trigger, setVisible])

  // Close on outside click
  useEffect(() => {
    if (!isVisible) return

    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setVisible(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isVisible, setVisible])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    }
  }, [])

  return (
    <Wrapper
      ref={wrapperRef}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="ui-dropdown"
    >
      {children}
      <Overlay $visible={isVisible} $placement={placement}>
        {overlay}
      </Overlay>
    </Wrapper>
  )
}

export default Dropdown
