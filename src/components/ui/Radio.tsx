import React, { createContext, useContext, useCallback } from 'react'
import styled, { css } from 'styled-components'

interface RadioGroupContextValue {
  value: any
  onChange: (val: any) => void
  disabled: boolean
  buttonStyle: string
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null)

// --- Radio (circle-style) ---

const RadioWrapper = styled.label<{ $disabled?: boolean }>`
  display: inline-flex;
  align-items: center;
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  opacity: ${({ $disabled }) => ($disabled ? 0.65 : 1)};
  font-size: 14px;
  color: ${({ theme }) => theme.textPrimary};
  user-select: none;
  gap: 8px;
  margin-right: 8px;
`

const HiddenRadioInput = styled.input`
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
`

const RadioDot = styled.span<{ $checked?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 1px solid
    ${({ $checked, theme }) =>
      $checked ? theme.primaryColor : theme.borderColor};
  border-radius: 50%;
  background: ${({ theme }) => theme.componentBackground};
  transition: all 0.2s;
  flex-shrink: 0;

  &::after {
    content: '';
    display: ${({ $checked }) => ($checked ? 'block' : 'none')};
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${({ theme }) => theme.primaryColor};
  }
`

interface RadioProps {
  checked?: boolean
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  disabled?: boolean
  value?: any
  children?: React.ReactNode
}

interface RadioButtonProps {
  value?: any
  disabled?: boolean
  children?: React.ReactNode
}

interface RadioGroupProps {
  value?: any
  onChange?: (e: { target: { value: any } }) => void
  disabled?: boolean
  children?: React.ReactNode
  buttonStyle?: string
}

interface RadioComponent extends React.FC<RadioProps> {
  Group: React.FC<RadioGroupProps>
  Button: React.FC<RadioButtonProps>
}

const Radio: RadioComponent = ({ checked, onChange, disabled = false, value, children }) => {
  const group = useContext(RadioGroupContext)
  const isDisabled = disabled || (group && group.disabled)
  const isChecked = group ? group.value === value : checked

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isDisabled) return
      if (group) {
        group.onChange(value)
      } else if (onChange) {
        onChange(e)
      }
    },
    [isDisabled, group, value, onChange]
  )

  return (
    <RadioWrapper $disabled={isDisabled || false}>
      <HiddenRadioInput
        type="radio"
        checked={isChecked}
        onChange={handleChange}
        disabled={isDisabled || false}
      />
      <RadioDot $checked={isChecked} />
      {children && <span>{children}</span>}
    </RadioWrapper>
  )
}

// --- Radio.Button ---

const RadioButtonStyled = styled.label<{ $checked?: boolean; $disabled?: boolean; $buttonStyle?: string }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 15px;
  height: 32px;
  font-size: 14px;
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  opacity: ${({ $disabled }) => ($disabled ? 0.65 : 1)};
  border: 1px solid ${({ theme }) => theme.borderColor};
  margin-left: -1px;
  transition: all 0.2s;
  user-select: none;
  color: ${({ theme }) => theme.textPrimary};
  background: ${({ theme }) => theme.componentBackground};

  &:first-child {
    margin-left: 0;
    border-radius: 4px 0 0 4px;
  }

  &:last-child {
    border-radius: 0 4px 4px 0;
  }

  ${({ $checked, $buttonStyle, theme }) =>
    $checked &&
    ($buttonStyle === 'solid'
      ? css`
          background: ${theme.primaryColor};
          color: ${theme.textOnPrimary || '#fff'};
          border-color: ${theme.primaryColor};
          z-index: 1;
        `
      : css`
          color: ${theme.primaryColor};
          border-color: ${theme.primaryColor};
          z-index: 1;
        `)}
`

const RadioButton: React.FC<RadioButtonProps> = ({ value, disabled = false, children }) => {
  const group = useContext(RadioGroupContext)
  const isDisabled = disabled || (group && group.disabled)
  const isChecked = group ? group.value === value : false

  const handleClick = useCallback(() => {
    if (isDisabled) return
    if (group) group.onChange(value)
  }, [isDisabled, group, value])

  return (
    <RadioButtonStyled
      $checked={isChecked}
      $disabled={isDisabled || false}
      $buttonStyle={group ? group.buttonStyle : 'outline'}
      onClick={handleClick}
    >
      <HiddenRadioInput
        type="radio"
        checked={isChecked}
        onChange={() => {}}
        disabled={isDisabled || false}
      />
      {children}
    </RadioButtonStyled>
  )
}

// --- Radio.Group ---

const GroupWrapper = styled.div`
  display: inline-flex;
  align-items: center;
`

const RadioGroup: React.FC<RadioGroupProps> = ({
  value,
  onChange,
  disabled = false,
  children,
  buttonStyle = 'outline'
}) => {
  const handleChange = useCallback(
    (val: any) => {
      if (onChange) onChange({ target: { value: val } })
    },
    [onChange]
  )

  return (
    <RadioGroupContext.Provider
      value={{ value, onChange: handleChange, disabled, buttonStyle }}
    >
      <GroupWrapper className="ui-radio-group">{children}</GroupWrapper>
    </RadioGroupContext.Provider>
  )
}

Radio.Group = RadioGroup
Radio.Button = RadioButton
Radio.Group.displayName = 'Radio.Group'
Radio.Button.displayName = 'Radio.Button'

export default Radio
