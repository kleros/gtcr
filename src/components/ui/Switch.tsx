import React, { useState, useCallback, useEffect } from 'react'
import styled, { css } from 'styled-components'

interface SwitchButtonStyledProps {
  $checked: boolean
  $size?: string
}

const SwitchButton = styled.button<SwitchButtonStyledProps>`
  position: relative;
  display: inline-flex;
  align-items: center;
  min-width: ${({ $size }) => ($size === 'small' ? '28px' : '44px')};
  height: ${({ $size }) => ($size === 'small' ? '16px' : '22px')};
  border: none;
  border-radius: 100px;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
  outline: none;
  box-sizing: border-box;

  background: ${({ $checked, theme }) =>
    $checked ? theme.primaryColor : theme.switchOffBg};

  &:hover:not(:disabled) {
    background: ${({ $checked, theme }) =>
      $checked ? theme.switchHoverBg : theme.switchOffBg};
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px ${({ theme }) => theme.focusShadowColor};
  }

  ${({ disabled }) =>
    disabled &&
    css`
      cursor: not-allowed;
      opacity: 0.4;
    `}
`

interface HandleStyledProps {
  $checked: boolean
  $size?: string
}

const Handle = styled.span<HandleStyledProps>`
  position: absolute;
  top: 2px;
  left: ${({ $checked, $size }) => {
    if ($checked) {
      return $size === 'small'
        ? 'calc(100% - 14px)'
        : 'calc(100% - 20px)'
    }
    return '2px'
  }};
  width: ${({ $size }) => ($size === 'small' ? '12px' : '18px')};
  height: ${({ $size }) => ($size === 'small' ? '12px' : '18px')};
  border-radius: 50%;
  background: ${({ theme }) => theme.switchHandleBg};
  transition: left 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
`

interface InnerTextStyledProps {
  $checked: boolean
  $size?: string
}

const InnerText = styled.span<InnerTextStyledProps>`
  font-size: ${({ $size }) => ($size === 'small' ? '9px' : '12px')};
  color: ${({ $checked, theme }) =>
    $checked ? theme.textOnPrimary || '#fff' : '#fff'};
  padding: ${({ $checked, $size }) => {
    const handleSpace = $size === 'small' ? '16px' : '24px'
    return $checked
      ? `0 ${handleSpace} 0 6px`
      : `0 6px 0 ${handleSpace}`
  }};
  white-space: nowrap;
  user-select: none;
`

interface SwitchProps {
  checked?: boolean
  onChange?: (checked: boolean, e: React.MouseEvent) => void
  onClick?: (checked: boolean, e: React.MouseEvent) => void
  checkedChildren?: React.ReactNode
  unCheckedChildren?: React.ReactNode
  disabled?: boolean
  size?: 'small' | 'default'
  style?: React.CSSProperties
  className?: string
  defaultChecked?: boolean
}

const Switch: React.FC<SwitchProps> = ({
  checked: controlledChecked,
  onChange,
  onClick,
  checkedChildren,
  unCheckedChildren,
  disabled = false,
  size,
  style,
  className,
  defaultChecked = false
}) => {
  const [internalChecked, setInternalChecked] = useState(defaultChecked)
  const isControlled = controlledChecked !== undefined
  const checked = isControlled ? controlledChecked : internalChecked

  useEffect(() => {
    if (isControlled) {
      setInternalChecked(controlledChecked)
    }
  }, [isControlled, controlledChecked])

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return
      const newChecked = !checked
      if (!isControlled) {
        setInternalChecked(newChecked)
      }
      onChange && onChange(newChecked, e)
      onClick && onClick(newChecked, e)
    },
    [checked, disabled, isControlled, onChange, onClick]
  )

  return (
    <SwitchButton
      type="button"
      role="switch"
      aria-checked={checked}
      $checked={checked}
      $size={size}
      disabled={disabled}
      onClick={handleClick}
      style={style}
      className={className}
    >
      <InnerText $checked={checked} $size={size}>
        {checked ? checkedChildren : unCheckedChildren}
      </InnerText>
      <Handle $checked={checked} $size={size} />
    </SwitchButton>
  )
}

export default Switch
