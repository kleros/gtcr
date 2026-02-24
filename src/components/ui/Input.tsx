import React, { useRef, useEffect, useCallback } from 'react'
import styled, { css } from 'styled-components'

const inputBaseStyles = css`
  width: 100%;
  padding: 4px 11px;
  font-size: 14px;
  line-height: 1.5;
  color: ${({ theme }) => theme.textPrimary};
  background: ${({ theme }) => theme.componentBackground};
  border: 1px solid ${({ theme }) => theme.borderColor};
  border-radius: 4px;
  outline: none;
  transition: all 0.3s;
  box-sizing: border-box;

  &::placeholder {
    color: ${({ theme }) => theme.textTertiary};
  }

  &:hover {
    border-color: ${({ theme }) => theme.primaryColor};
  }

  &:focus {
    border-color: ${({ theme }) => theme.primaryColor};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.focusShadowColor};
  }

  &:disabled {
    background: ${({ theme }) => theme.elevatedBackground};
    color: ${({ theme }) => theme.antdDisabledColor};
    cursor: not-allowed;
  }
`

const sizeMap: Record<string, ReturnType<typeof css>> = {
  small: css`
    height: 24px;
    padding: 0 7px;
    font-size: 12px;
  `,
  default: css`
    height: 32px;
  `,
  large: css`
    height: 40px;
    padding: 6px 11px;
    font-size: 16px;
  `,
}

const StyledInput = styled.input<{ $size?: string }>`
  ${inputBaseStyles}
  ${({ $size }) => sizeMap[$size || 'default']}
`

const InputWrapper = styled.span`
  display: inline-flex;
  align-items: center;
  width: 100%;
  position: relative;
`

const AddonWrapper = styled.span<{
  $hasAddonBefore?: boolean
  $hasAddonAfter?: boolean
}>`
  display: inline-flex;
  align-items: center;
  width: 100%;

  & > input {
    ${({ $hasAddonBefore }) =>
      $hasAddonBefore &&
      css`
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
      `}
    ${({ $hasAddonAfter }) =>
      $hasAddonAfter &&
      css`
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
      `}
  }
`

const Addon = styled.span`
  padding: 0 11px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  background: ${({ theme }) => theme.elevatedBackground};
  border: 1px solid ${({ theme }) => theme.borderColor};
  color: ${({ theme }) => theme.textPrimary};
  font-size: 14px;
  white-space: nowrap;

  &.ui-input-addon-before {
    border-right: 0;
    border-radius: 4px 0 0 4px;
  }
  &.ui-input-addon-after {
    border-left: 0;
    border-radius: 0 4px 4px 0;
  }
`

const PrefixIcon = styled.span`
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  color: ${({ theme }) => theme.textTertiary};
  display: flex;
  align-items: center;
  z-index: 1;
`

const SuffixIcon = styled.span`
  position: absolute;
  right: 11px;
  top: 50%;
  transform: translateY(-50%);
  color: ${({ theme }) => theme.textTertiary};
  display: flex;
  align-items: center;
  z-index: 1;
`

const ClearButton = styled.span<{ $hasSuffix?: boolean }>`
  position: absolute;
  right: ${({ $hasSuffix }) => ($hasSuffix ? '30px' : '11px')};
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
  color: ${({ theme }) => theme.textTertiary};
  font-size: 12px;
  display: flex;
  align-items: center;
  z-index: 1;
  line-height: 1;

  &:hover {
    color: ${({ theme }) => theme.textSecondary};
  }
`

interface InputProps {
  value?: string | number
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  disabled?: boolean
  addonBefore?: React.ReactNode
  addonAfter?: React.ReactNode
  prefix?: React.ReactNode
  suffix?: React.ReactNode
  step?: number | string
  type?: string
  style?: React.CSSProperties
  className?: string
  id?: string
  allowClear?: boolean
  autoFocus?: boolean
  onPressEnter?: (e: React.KeyboardEvent) => void
  onBlur?: (e: React.FocusEvent) => void
  size?: string
  [key: string]: unknown
}

interface TextAreaProps {
  value?: string | number
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  placeholder?: string
  disabled?: boolean
  rows?: number
  autoSize?: boolean
  style?: React.CSSProperties
  className?: string
  [key: string]: unknown
}

interface InputComponent extends React.ForwardRefExoticComponent<
  InputProps & React.RefAttributes<HTMLInputElement>
> {
  TextArea: React.ForwardRefExoticComponent<
    TextAreaProps & React.RefAttributes<HTMLTextAreaElement>
  >
  displayName?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      value,
      onChange,
      placeholder,
      disabled,
      addonBefore,
      addonAfter,
      prefix,
      suffix,
      step,
      type = 'text',
      style,
      className,
      id,
      allowClear,
      autoFocus,
      onPressEnter,
      onBlur,
      size,
      ...rest
    },
    ref,
  ) => {
    const inputRef = useRef<HTMLInputElement>(null)
    const combinedRef = (ref || inputRef) as React.RefObject<HTMLInputElement>

    useEffect(() => {
      if (autoFocus && combinedRef.current) combinedRef.current.focus()
    }, [autoFocus, combinedRef])

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && onPressEnter) onPressEnter(e)
      },
      [onPressEnter],
    )

    const handleClear = useCallback(() => {
      if (onChange) {
        const event = {
          target: { value: '' },
          currentTarget: { value: '' },
        } as React.ChangeEvent<HTMLInputElement>
        onChange(event)
      }
    }, [onChange])

    const hasAddon = addonBefore || addonAfter
    const paddingLeft = prefix ? '30px' : undefined
    const paddingRight =
      suffix && allowClear ? '52px' : suffix || allowClear ? '30px' : undefined

    const inputElement = (
      <StyledInput
        ref={combinedRef}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        step={step}
        id={id}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
        $size={size}
        style={
          !hasAddon
            ? { ...style, paddingLeft, paddingRight }
            : { paddingLeft, paddingRight }
        }
        className={hasAddon ? undefined : className}
        {...rest}
      />
    )

    if (hasAddon)
      return (
        <AddonWrapper
          $hasAddonBefore={!!addonBefore}
          $hasAddonAfter={!!addonAfter}
          style={style}
          className={className}
        >
          {addonBefore && (
            <Addon className="ui-input-addon-before">{addonBefore}</Addon>
          )}
          <InputWrapper>
            {prefix && <PrefixIcon>{prefix}</PrefixIcon>}
            {inputElement}
            {allowClear && value && (
              <ClearButton $hasSuffix={!!suffix} onClick={handleClear}>
                &#x2715;
              </ClearButton>
            )}
            {suffix && <SuffixIcon>{suffix}</SuffixIcon>}
          </InputWrapper>
          {addonAfter && (
            <Addon className="ui-input-addon-after">{addonAfter}</Addon>
          )}
        </AddonWrapper>
      )

    return (
      <InputWrapper>
        {prefix && <PrefixIcon>{prefix}</PrefixIcon>}
        {inputElement}
        {allowClear && value && (
          <ClearButton $hasSuffix={!!suffix} onClick={handleClear}>
            &#x2715;
          </ClearButton>
        )}
        {suffix && <SuffixIcon>{suffix}</SuffixIcon>}
      </InputWrapper>
    )
  },
) as InputComponent

Input.displayName = 'Input'

// TextArea sub-component
const StyledTextArea = styled.textarea<{ $autoSize?: boolean }>`
  ${inputBaseStyles}
  min-height: 32px;
  resize: ${({ $autoSize }) => ($autoSize ? 'none' : 'vertical')};
  padding: 4px 11px;
`

const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      value,
      onChange,
      placeholder,
      disabled,
      rows = 4,
      autoSize,
      style,
      className,
      ...rest
    },
    ref,
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const combinedRef = (ref ||
      textareaRef) as React.RefObject<HTMLTextAreaElement>

    const adjustHeight = useCallback(() => {
      const el = combinedRef.current
      if (!el || !autoSize) return
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }, [autoSize, combinedRef])

    useEffect(() => {
      adjustHeight()
    }, [value, adjustHeight])

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange && onChange(e)
        // Schedule height adjustment after state update
        requestAnimationFrame(adjustHeight)
      },
      [onChange, adjustHeight],
    )

    return (
      <StyledTextArea
        ref={combinedRef}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        rows={autoSize ? 1 : rows}
        $autoSize={autoSize}
        style={style}
        className={className}
        {...rest}
      />
    )
  },
)

TextArea.displayName = 'Input.TextArea'

Input.TextArea = TextArea

export default Input
