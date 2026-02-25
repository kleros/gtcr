import React, { useCallback } from 'react'
import styled, { css, DefaultTheme } from 'styled-components'

const MenuWrapper = styled.ul<{ $mode?: string }>`
  list-style: none;
  margin: 0;
  padding: 4px 0;
  background: ${({ theme }) => theme.componentBackground};
  border-radius: 4px;
  min-width: 120px;

  ${({ $mode }) =>
    $mode === 'horizontal' &&
    css`
      display: flex;
      align-items: center;
      padding: 0;
      border-bottom: 1px solid ${({ theme }) => theme.borderColor};
    `}

  ${({ $mode }) =>
    $mode === 'inline' &&
    css`
      border-right: 1px solid ${({ theme }) => theme.borderColor};
    `}
`

const MenuItemWrapper = styled.li<{
  $disabled?: boolean
  $selected?: boolean
  $mode?: string
}>`
  padding: 8px 16px;
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  color: ${({ $disabled, $selected, theme }) =>
    $disabled
      ? theme.disabledColor
      : $selected
        ? theme.primaryColor
        : theme.textPrimary};
  font-size: 14px;
  transition: all 0.2s;
  white-space: nowrap;
  opacity: ${({ $disabled }) => ($disabled ? 0.65 : 1)};
  background: ${({ $selected, theme }) =>
    $selected ? theme.dropdownHoverBg : 'transparent'};

  &:hover {
    ${({ $disabled, theme }) =>
      !$disabled &&
      css`
        background: ${theme.dropdownHoverBg};
        color: ${theme.primaryColor};
      `}
  }

  ${({ $mode }) =>
    $mode === 'horizontal' &&
    css`
      padding: 0 20px;
      height: 46px;
      display: inline-flex;
      align-items: center;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;

      ${({ $selected, theme }: { $selected?: boolean; theme: DefaultTheme }) =>
        $selected &&
        css`
          border-bottom-color: ${theme.primaryColor};
        `}
    `}
`

interface MenuItemProps {
  children?: React.ReactNode
  onClick?: (e: React.MouseEvent) => void
  disabled?: boolean
  style?: React.CSSProperties
  className?: string
  $itemKey?: string
  $selected?: boolean
  $onMenuClick?: (info: { key: string; domEvent: React.MouseEvent }) => void
  $mode?: string
}

const MenuItem: React.FC<MenuItemProps> = ({
  children,
  onClick,
  disabled = false,
  style,
  className,
  $itemKey,
  $selected,
  $onMenuClick,
  $mode,
}) => {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return
      if (onClick) onClick(e)
      if ($onMenuClick && $itemKey) $onMenuClick({ key: $itemKey, domEvent: e })
    },
    [disabled, onClick, $onMenuClick, $itemKey],
  )

  return (
    <MenuItemWrapper
      $disabled={disabled}
      $selected={$selected}
      $mode={$mode}
      onClick={handleClick}
      style={style}
      className={`ui-menu-item${className ? ` ${className}` : ''}`}
    >
      {children}
    </MenuItemWrapper>
  )
}

MenuItem.displayName = 'Menu.Item'

interface MenuProps {
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
  onClick?: (info: { key: string; domEvent: React.MouseEvent }) => void
  mode?: string
  selectedKeys?: string[]
}

interface MenuComponent extends React.FC<MenuProps> {
  Item: React.FC<MenuItemProps>
}

const Menu: MenuComponent = ({
  children,
  style,
  className,
  onClick,
  mode = 'vertical',
  selectedKeys = [],
}) => (
  <MenuWrapper
    $mode={mode}
    style={style}
    className={`ui-menu${className ? ` ${className}` : ''}`}
  >
    {React.Children.map(
      children,
      (child: React.ReactElement<MenuItemProps>) => {
        if (!child || child.type !== MenuItem) return child
        const itemKey = child.key
        return React.cloneElement(child, {
          $itemKey: itemKey,
          $selected: selectedKeys.includes(itemKey),
          $onMenuClick: onClick,
          $mode: mode,
        })
      },
    )}
  </MenuWrapper>
)

Menu.Item = MenuItem

export default Menu
