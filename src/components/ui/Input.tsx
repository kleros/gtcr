import React, { useRef, useEffect, useCallback } from 'react'
import styled, { css } from 'styled-components'
import { useFormItemControl } from './form-item-context'
import { KitIcon } from './kit-icons'
import {
  fieldFocus,
  fieldFocusRing,
  fieldHover,
  fieldSurface,
  figureData,
  ghostIconButton,
  joinClassNames,
  kitTransition,
} from './kit-styles'

/*
 * Input, v2: a raised field, 44px tall with radius 12 and a hairline; focus
 * tints the fill, turns the edge blue (2px, 3:1 or better) and lays a soft
 * halo around it. Addons sit inside the same field, split off by a
 * hairline, so units read as part of the value.
 *
 * The global stylesheet forces surface, border and radius on text inputs and
 * textareas with !important. The fill, border, radius and ring below are
 * written at double-class specificity with !important so the field keeps its
 * own look; every other property stays overridable by styled(Input).
 */
const fieldOverrides = css`
  && {
    border-color: var(--glass-border) !important;
    border-radius: var(--radius) !important;
    background: var(--color-raised) !important;
    box-shadow: none !important;
  }

  /* Hover never outranks focus: a focused field keeps its blue edge. */
  &&:hover:not(:disabled):not(:focus) {
    border-color: var(--color-border-strong) !important;
  }

  &&:focus,
  &&:focus-visible {
    border-color: var(--color-primary) !important;
    background: color-mix(
      in srgb,
      var(--color-primary) 5%,
      var(--color-raised)
    ) !important;
    box-shadow: ${fieldFocusRing} !important;
    outline: none;
  }

  &&:disabled {
    border-color: var(--glass-border) !important;
    background: transparent !important;
  }
`

const inputBaseStyles = css`
  ${fieldSurface}
  width: 100%;
  height: 44px;
  padding: 0 14px;
  font-family: var(--font-sans);
  font-size: var(--fs-body-lg);
  line-height: var(--lh-body-lg);
  letter-spacing: -0.005em;

  &::placeholder {
    color: var(--color-faint);
  }

  &:disabled {
    color: var(--color-muted);
    cursor: not-allowed;
  }

  ${fieldOverrides}
`

const sizeMap: Record<string, ReturnType<typeof css>> = {
  small: css`
    height: 36px;
    padding: 0 12px;
    font-size: var(--fs-small);
    line-height: var(--lh-small);
  `,
  default: css`
    height: 44px;
  `,
  large: css`
    height: 48px;
    font-size: var(--fs-subheading);
    line-height: var(--lh-subheading);
  `,
}

const StyledInput = styled.input<{ $size?: string }>`
  ${inputBaseStyles}
  ${({ $size }) => sizeMap[$size || 'default'] || sizeMap.default}
`

const InputWrapper = styled.span`
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 100%;
  min-width: 0;
`

/*
 * With addons the group is the field: it carries the fill, the hairline and
 * the focus ring, and the input inside goes transparent.
 */
const AddonWrapper = styled.span<{
  $hasAddonBefore?: boolean
  $hasAddonAfter?: boolean
}>`
  ${fieldSurface}
  display: inline-flex;
  align-items: stretch;
  width: 100%;
  min-width: 0;
  overflow: hidden;

  &:hover:not(:focus-within) {
    ${fieldHover}
  }

  &:focus-within {
    ${fieldFocus}
  }

  && .ui-input.ui-input,
  && .ui-input.ui-input:hover,
  && .ui-input.ui-input:focus {
    height: 100%;
    min-height: 0;
    border-color: transparent !important;
    border-radius: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
  }
`

/* Units and symbols: tabular figures, quiet, inside the field. */
const Addon = styled.span<{ $small?: boolean }>`
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  height: ${({ $small }) => ($small ? '34px' : '42px')};
  padding: 0 14px;
  color: var(--color-faint);
  ${figureData}
  white-space: nowrap;

  &.ui-input-addon-before {
    border-right: 1px solid var(--glass-border);
  }
  &.ui-input-addon-after {
    border-left: 1px solid var(--glass-border);
  }
`

const PrefixIcon = styled.span`
  position: absolute;
  left: 14px;
  top: 50%;
  z-index: 1;
  display: flex;
  align-items: center;
  color: var(--color-faint);
  transform: translateY(-50%);
  pointer-events: none;
  transition: ${kitTransition('color')};

  ${InputWrapper}:focus-within > & {
    color: var(--color-primary);
  }
`

const SuffixIcon = styled.span`
  position: absolute;
  right: 14px;
  top: 50%;
  z-index: 1;
  display: flex;
  align-items: center;
  color: var(--color-faint);
  transform: translateY(-50%);
`

const ClearButton = styled.button<{ $hasSuffix?: boolean }>`
  ${ghostIconButton}
  position: absolute;
  right: ${({ $hasSuffix }) => ($hasSuffix ? '38px' : '10px')};
  top: 50%;
  z-index: 1;
  width: 24px;
  height: 24px;
  transform: translateY(-50%);
`

interface InputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'size' | 'prefix'
> {
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
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value?: string | number
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  placeholder?: string
  disabled?: boolean
  rows?: number
  autoSize?: boolean
  autosize?: boolean | { minRows?: number; maxRows?: number }
  style?: React.CSSProperties
  className?: string
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
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledby,
      'aria-describedby': ariaDescribedby,
      'aria-invalid': ariaInvalid,
      ...rest
    },
    ref,
  ) => {
    const a11y = useFormItemControl({
      id,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledby,
      'aria-describedby': ariaDescribedby,
      'aria-invalid': ariaInvalid,
    })
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
      combinedRef.current?.focus()
    }, [onChange, combinedRef])

    const hasAddon = addonBefore || addonAfter
    const small = size === 'small'
    const paddingLeft = prefix ? '40px' : undefined
    const paddingRight =
      suffix && allowClear ? '66px' : suffix || allowClear ? '40px' : undefined

    const inputElement = (
      <StyledInput
        ref={combinedRef}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        step={step}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
        $size={size}
        style={
          hasAddon
            ? { paddingLeft, paddingRight }
            : { ...style, paddingLeft, paddingRight }
        }
        className={
          hasAddon ? 'ui-input' : joinClassNames('ui-input', className)
        }
        {...rest}
        {...a11y}
      />
    )

    const field = (
      <InputWrapper className="ui-input-wrapper">
        {prefix && (
          <PrefixIcon className="ui-input-prefix">{prefix}</PrefixIcon>
        )}
        {inputElement}
        {allowClear && value && (
          <ClearButton
            type="button"
            className="ui-input-clear"
            $hasSuffix={Boolean(suffix)}
            onClick={handleClear}
            aria-label="Clear"
          >
            <KitIcon name="close" size={14} />
          </ClearButton>
        )}
        {suffix && (
          <SuffixIcon className="ui-input-suffix">{suffix}</SuffixIcon>
        )}
      </InputWrapper>
    )

    if (hasAddon)
      return (
        <AddonWrapper
          $hasAddonBefore={Boolean(addonBefore)}
          $hasAddonAfter={Boolean(addonAfter)}
          style={style}
          className={joinClassNames('ui-input-group', className)}
        >
          {addonBefore && (
            <Addon
              className="ui-input-addon ui-input-addon-before"
              $small={small}
            >
              {addonBefore}
            </Addon>
          )}
          {field}
          {addonAfter && (
            <Addon
              className="ui-input-addon ui-input-addon-after"
              $small={small}
            >
              {addonAfter}
            </Addon>
          )}
        </AddonWrapper>
      )

    return field
  },
) as InputComponent

Input.displayName = 'Input'

// TextArea sub-component
const StyledTextArea = styled.textarea<{ $autoSize?: boolean }>`
  ${inputBaseStyles}
  height: auto;
  min-height: 96px;
  padding: 12px 14px;
  resize: ${({ $autoSize }) => ($autoSize ? 'none' : 'vertical')};
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
      autosize,
      style,
      className,
      id,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledby,
      'aria-describedby': ariaDescribedby,
      'aria-invalid': ariaInvalid,
      ...rest
    },
    ref,
  ) => {
    const a11y = useFormItemControl({
      id,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledby,
      'aria-describedby': ariaDescribedby,
      'aria-invalid': ariaInvalid,
    })
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const combinedRef = (ref ||
      textareaRef) as React.RefObject<HTMLTextAreaElement>
    const grow = autoSize ?? autosize === true
    const minRows =
      typeof autosize === 'object' && autosize ? autosize.minRows : undefined

    const adjustHeight = useCallback(() => {
      const el = combinedRef.current
      if (!el || !grow) return
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }, [grow, combinedRef])

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
        rows={grow ? minRows || 1 : minRows || rows}
        $autoSize={grow}
        style={style}
        className={joinClassNames('ui-input', 'ui-textarea', className)}
        {...rest}
        {...a11y}
      />
    )
  },
)

TextArea.displayName = 'Input.TextArea'

Input.TextArea = TextArea

export default Input
