import React, { useState, useCallback, useRef, useEffect } from 'react'
import styled from 'styled-components'

const Wrapper = styled.div`
  display: inline-flex;
  align-items: stretch;
  position: relative;
  border: 1px solid ${({ theme }) => theme.borderColor};
  border-radius: 4px;
  background: ${({ theme }) => theme.componentBackground};
  transition: all 0.3s;
  width: 90px;

  &:hover:not(.disabled) {
    border-color: ${({ theme }) => theme.primaryColor};
  }

  &:focus-within:not(.disabled) {
    border-color: ${({ theme }) => theme.primaryColor};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.focusShadowColor};
  }

  &.disabled {
    opacity: 0.65;
    cursor: not-allowed;
    background: ${({ theme }) => theme.elevatedBackground};
  }
`

const StyledInput = styled.input`
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: ${({ theme }) => theme.textPrimary};
  font-size: 14px;
  padding: 4px 8px;
  text-align: left;
  -moz-appearance: textfield;

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  &:disabled {
    cursor: not-allowed;
    color: ${({ theme }) => theme.antdDisabledColor};
  }
`

const HandlerWrap = styled.div`
  display: flex;
  flex-direction: column;
  width: 22px;
  border-left: 1px solid ${({ theme }) => theme.borderColor};
  flex-shrink: 0;
`

const HandlerButton = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  cursor: pointer;
  user-select: none;
  font-size: 10px;
  color: ${({ theme }) => theme.textSecondary};
  transition: all 0.15s;

  &:hover {
    color: ${({ theme }) => theme.primaryColor};
    background: ${({ theme }) => theme.elevatedBackground};
  }

  &:first-child {
    border-bottom: 1px solid ${({ theme }) => theme.borderColor};
    border-radius: 0 4px 0 0;
  }

  &:last-child {
    border-radius: 0 0 4px 0;
  }

  &.handler-disabled {
    cursor: not-allowed;
    opacity: 0.4;
    &:hover {
      color: ${({ theme }) => theme.textSecondary};
      background: transparent;
    }
  }
`

interface InputNumberProps {
  value?: number | string
  min?: number
  max?: number
  defaultValue?: number
  onChange?: (value: number | undefined) => void
  disabled?: boolean
  step?: number
  style?: React.CSSProperties
  className?: string
  parser?: (value: string) => string
  formatter?: (value: number | string) => string
  precision?: number
}

const InputNumber: React.FC<InputNumberProps> = ({
  value: controlledValue,
  min,
  max,
  defaultValue,
  onChange,
  disabled = false,
  step = 1,
  style,
  className,
  parser,
  formatter,
  precision
}) => {
  const [internalValue, setInternalValue] = useState<number | string>(() => {
    const init = controlledValue !== undefined ? controlledValue : defaultValue
    return init !== undefined ? init : ''
  })
  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : internalValue
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isControlled && controlledValue !== internalValue) {
      setInternalValue(controlledValue as number | string)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledValue])

  const clamp = useCallback(
    (val: number) => {
      let n = val
      if (min !== undefined && n < min) n = min
      if (max !== undefined && n > max) n = max
      if (precision !== undefined) n = parseFloat(n.toFixed(precision))
      return n
    },
    [min, max, precision]
  )

  const applyValue = useCallback(
    (raw: any) => {
      if (raw === '' || raw === null || raw === undefined) {
        if (!isControlled) setInternalValue('')
        if (onChange) onChange(undefined)
        return
      }
      const num = typeof raw === 'string' ? parseFloat(raw) : raw
      if (isNaN(num)) return
      const clamped = clamp(num)
      if (!isControlled) setInternalValue(clamped)
      if (onChange) onChange(clamped)
    },
    [isControlled, clamp, onChange]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let raw: string = e.target.value
      if (parser) raw = parser(raw)
      if (raw === '' || raw === '-') {
        if (!isControlled) setInternalValue(raw)
        return
      }
      applyValue(raw)
    },
    [parser, isControlled, applyValue]
  )

  const handleBlur = useCallback(() => {
    if (value === '' || value === '-') {
      applyValue(defaultValue !== undefined ? defaultValue : min !== undefined ? min : '')
    }
  }, [value, defaultValue, min, applyValue])

  const increment = useCallback(() => {
    if (disabled) return
    const current = value === '' || value === undefined ? 0 : Number(value)
    applyValue(current + step)
  }, [disabled, value, step, applyValue])

  const decrement = useCallback(() => {
    if (disabled) return
    const current = value === '' || value === undefined ? 0 : Number(value)
    applyValue(current - step)
  }, [disabled, value, step, applyValue])

  const displayValue =
    formatter && value !== '' && value !== undefined ? formatter(value) : value

  const atMax = max !== undefined && Number(value) >= max
  const atMin = min !== undefined && Number(value) <= min

  return (
    <Wrapper
      style={style}
      className={`ui-input-number${disabled ? ' disabled' : ''}${className ? ` ${className}` : ''}`}
    >
      <StyledInput
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={displayValue !== undefined ? displayValue : ''}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
      />
      <HandlerWrap>
        <HandlerButton
          className={atMax || disabled ? 'handler-disabled' : ''}
          onClick={!atMax && !disabled ? increment : undefined}
          role="button"
          aria-label="Increase Value"
        >
          &#9650;
        </HandlerButton>
        <HandlerButton
          className={atMin || disabled ? 'handler-disabled' : ''}
          onClick={!atMin && !disabled ? decrement : undefined}
          role="button"
          aria-label="Decrease Value"
        >
          &#9660;
        </HandlerButton>
      </HandlerWrap>
    </Wrapper>
  )
}

export default InputNumber
