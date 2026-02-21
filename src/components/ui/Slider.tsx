import React, { useState, useEffect, useCallback } from 'react'
import styled from 'styled-components'

const SliderWrapper = styled.div`
  position: relative;
  width: 100%;
  padding: 4px 0;
`

const StyledRange = styled.input<{ $percent: number }>`
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  outline: none;
  cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};
  opacity: ${({ disabled }) => (disabled ? 0.4 : 1)};
  background: ${({ theme, $percent }) =>
    `linear-gradient(
      to right,
      ${theme.primaryColor} 0%,
      ${theme.primaryColor} ${$percent}%,
      ${theme.elevatedBackground} ${$percent}%,
      ${theme.elevatedBackground} 100%
    )`};
  border: 1px solid ${({ theme }) => theme.borderColor};
  transition: opacity 0.2s;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    border: 2px solid ${({ theme }) => theme.primaryColor};
    cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};
    transition: box-shadow 0.2s, border-color 0.2s;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);

    &:hover {
      box-shadow: 0 0 0 4px ${({ theme }) => theme.focusShadowColor};
    }
  }

  &::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    border: 2px solid ${({ theme }) => theme.primaryColor};
    cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};
    transition: box-shadow 0.2s, border-color 0.2s;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);

    &:hover {
      box-shadow: 0 0 0 4px ${({ theme }) => theme.focusShadowColor};
    }
  }

  &::-moz-range-track {
    height: 4px;
    border-radius: 2px;
    background: transparent;
    border: none;
  }
`

interface SliderProps {
  min?: number
  max?: number
  value?: number
  onChange?: (value: number) => void
  step?: number
  disabled?: boolean
  style?: React.CSSProperties
  className?: string
  defaultValue?: number
}

const Slider: React.FC<SliderProps> = ({
  min = 0,
  max = 100,
  value: controlledValue,
  onChange,
  step = 1,
  disabled = false,
  style,
  className,
  defaultValue
}) => {
  const [internalValue, setInternalValue] = useState(
    controlledValue !== undefined
      ? controlledValue
      : defaultValue !== undefined
      ? defaultValue
      : min
  )

  const isControlled = controlledValue !== undefined
  const currentValue = isControlled ? controlledValue : internalValue

  useEffect(() => {
    if (isControlled) {
      setInternalValue(controlledValue)
    }
  }, [isControlled, controlledValue])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = Number(e.target.value)
      if (!isControlled) {
        setInternalValue(newValue)
      }
      onChange && onChange(newValue)
    },
    [isControlled, onChange]
  )

  const percent =
    max !== min ? ((currentValue - min) / (max - min)) * 100 : 0

  return (
    <SliderWrapper style={style} className={className}>
      <StyledRange
        type="range"
        min={min}
        max={max}
        step={step}
        value={currentValue}
        onChange={handleChange}
        disabled={disabled}
        $percent={percent}
      />
    </SliderWrapper>
  )
}

export default Slider
