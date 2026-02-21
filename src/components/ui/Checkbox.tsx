import React, { useState, useCallback } from 'react'
import styled from 'styled-components'

const Wrapper = styled.label<{ $disabled?: boolean }>`
  display: inline-flex;
  align-items: center;
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  opacity: ${({ $disabled }) => ($disabled ? 0.65 : 1)};
  font-size: 14px;
  color: ${({ theme }) => theme.textPrimary};
  user-select: none;
  gap: 8px;
`

const HiddenInput = styled.input`
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
`

const Indicator = styled.span<{ $checked?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 1px solid
    ${({ $checked, theme }) =>
      $checked ? theme.primaryColor : theme.borderColor};
  border-radius: 2px;
  background: ${({ $checked, theme }) =>
    $checked ? theme.primaryColor : theme.componentBackground};
  transition: all 0.2s;
  flex-shrink: 0;

  &::after {
    content: '';
    display: ${({ $checked }) => ($checked ? 'block' : 'none')};
    width: 5px;
    height: 9px;
    border: solid #fff;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg) translate(-1px, -1px);
  }
`

interface CheckboxProps {
  checked?: boolean
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  disabled?: boolean
  children?: React.ReactNode
  defaultChecked?: boolean
  style?: React.CSSProperties
  className?: string
}

const Checkbox: React.FC<CheckboxProps> = ({
  checked: controlledChecked,
  onChange,
  disabled = false,
  children,
  defaultChecked = false,
  style,
  className
}) => {
  const [internalChecked, setInternalChecked] = useState(defaultChecked)
  const isControlled = controlledChecked !== undefined
  const isChecked = isControlled ? controlledChecked : internalChecked

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return
      const next = e.target.checked
      if (!isControlled) setInternalChecked(next)
      if (onChange) onChange(e)
    },
    [disabled, isControlled, onChange]
  )

  return (
    <Wrapper
      $disabled={disabled}
      style={style}
      className={`ui-checkbox${className ? ` ${className}` : ''}`}
    >
      <HiddenInput
        type="checkbox"
        checked={isChecked}
        onChange={handleChange}
        disabled={disabled}
      />
      <Indicator $checked={isChecked} />
      {children && <span>{children}</span>}
    </Wrapper>
  )
}

export default Checkbox
