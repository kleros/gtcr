import React, { useState, useCallback, useRef, useEffect } from 'react'
import styled, { css } from 'styled-components'

const CollapseWrapper = styled.div<{ $bordered?: boolean }>`
  border-radius: 4px;
  ${({ $bordered, theme }) =>
    $bordered &&
    css`
      border: 1px solid ${theme.borderColor};
    `}
  overflow: hidden;
`

const PanelWrapper = styled.div<{ $bordered?: boolean }>`
  ${({ $bordered, theme }) =>
    $bordered &&
    css`
      &:not(:last-child) {
        border-bottom: 1px solid ${theme.borderColor};
      }
    `}
`

const PanelHeader = styled.div<{ $disabled?: boolean }>`
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  background: ${({ theme }) => theme.componentBackground};
  color: ${({ theme }) => theme.textPrimary};
  font-size: 14px;
  font-weight: 500;
  user-select: none;
  transition: background 0.2s;
  opacity: ${({ $disabled }) => ($disabled ? 0.65 : 1)};

  &:hover {
    background: ${({ $disabled, theme }) =>
      $disabled ? theme.componentBackground : theme.elevatedBackground};
  }
`

const ArrowIcon = styled.span<{ $active?: boolean }>`
  display: inline-flex;
  margin-right: 12px;
  font-size: 10px;
  transition: transform 0.3s;
  transform: rotate(${({ $active }) => ($active ? '90deg' : '0deg')});
  color: ${({ theme }) => theme.textSecondary};
`

const PanelContentOuter = styled.div`
  overflow: hidden;
  transition: height 0.3s ease;
`

const PanelContentInner = styled.div`
  padding: 16px;
  color: ${({ theme }) => theme.textPrimary};
  font-size: 14px;
  background: ${({ theme }) => theme.componentBackground};
  border-top: 1px solid ${({ theme }) => theme.borderColor};
`

interface PanelProps {
  header?: React.ReactNode
  children?: React.ReactNode
  showArrow?: boolean
  disabled?: boolean
  $panelKey?: string
  $active?: boolean
  $onToggle?: (key: string) => void
}

const Panel: React.FC<PanelProps> = ({ header, children, showArrow = true, disabled = false, $panelKey, $active, $onToggle }) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState($active ? 'auto' : '0px')
  const [overflow, setOverflow] = useState($active ? 'visible' : 'hidden')

  useEffect(() => {
    if ($active) {
      const el = contentRef.current
      if (el) {
        setOverflow('hidden')
        setHeight(`${el.scrollHeight}px`)
        const timer = setTimeout(() => {
          setHeight('auto')
          setOverflow('visible')
        }, 300)
        return () => clearTimeout(timer)
      }
    } else {
      const el = contentRef.current
      if (el) {
        // Set explicit height first so transition can animate from it
        setHeight(`${el.scrollHeight}px`)
        setOverflow('hidden')
        // Force a reflow then set to 0
        // eslint-disable-next-line no-unused-expressions
        el.offsetHeight
        requestAnimationFrame(() => {
          setHeight('0px')
        })
      }
    }
  }, [$active])

  const handleClick = useCallback(() => {
    if (disabled) return
    if ($onToggle && $panelKey) $onToggle($panelKey)
  }, [disabled, $onToggle, $panelKey])

  return (
    <PanelWrapper $bordered>
      <PanelHeader $disabled={disabled} onClick={handleClick}>
        {showArrow && <ArrowIcon $active={$active}>&#9654;</ArrowIcon>}
        <span style={{ flex: 1 }}>{header}</span>
      </PanelHeader>
      <PanelContentOuter
        ref={contentRef}
        style={{ height, overflow }}
      >
        <PanelContentInner>{children}</PanelContentInner>
      </PanelContentOuter>
    </PanelWrapper>
  )
}

Panel.displayName = 'Collapse.Panel'

interface CollapseProps {
  bordered?: boolean
  defaultActiveKey?: string | string[]
  activeKey?: string | string[]
  onChange?: (key: string | string[]) => void
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
  accordion?: boolean
}

interface CollapseComponent extends React.FC<CollapseProps> {
  Panel: React.FC<PanelProps>
}

const Collapse: CollapseComponent = ({
  bordered = true,
  defaultActiveKey,
  activeKey: controlledActiveKey,
  onChange,
  children,
  style,
  className,
  accordion = false
}) => {
  const normalizeKeys = (keys: string | string[] | undefined): string[] => {
    if (keys === undefined || keys === null) return []
    if (Array.isArray(keys)) return keys.map(String)
    return [String(keys)]
  }

  const [internalActiveKeys, setInternalActiveKeys] = useState<string[]>(() =>
    normalizeKeys(defaultActiveKey)
  )

  const isControlled = controlledActiveKey !== undefined
  const activeKeys = isControlled
    ? normalizeKeys(controlledActiveKey)
    : internalActiveKeys

  const handleToggle = useCallback(
    (panelKey: string) => {
      const key = String(panelKey)
      let nextKeys: string[]

      if (accordion) {
        nextKeys = activeKeys.includes(key) ? [] : [key]
      } else {
        nextKeys = activeKeys.includes(key)
          ? activeKeys.filter(k => k !== key)
          : [...activeKeys, key]
      }

      if (!isControlled) setInternalActiveKeys(nextKeys)
      if (onChange) onChange(accordion ? nextKeys[0] || '' : nextKeys)
    },
    [accordion, activeKeys, isControlled, onChange]
  )

  const items = React.Children.toArray(children)

  return (
    <CollapseWrapper
      $bordered={bordered}
      style={style}
      className={`ui-collapse${className ? ` ${className}` : ''}`}
    >
      {items.map((child) => {
        const element = child as React.ReactElement
        const panelKey = element.key != null ? String(element.key) : undefined
        const isActive = panelKey ? activeKeys.includes(panelKey) : false

        return React.cloneElement(element, {
          $panelKey: panelKey,
          $active: isActive,
          $onToggle: handleToggle
        })
      })}
    </CollapseWrapper>
  )
}

Collapse.Panel = Panel

export default Collapse
