import React, { useState, useCallback, useEffect } from 'react'
import styled from 'styled-components'
import { useFormItemControl } from './form-item-context'
import { edgeTransition, joinClassNames, litEdgeBackground } from './kit-styles'

/*
 * Switch, round 2 ("Lit edge", DESIGN.md): a 40x24 pill (32x18 small). Off
 * is a recessed track with a quiet bead; on, the track turns into deep
 * glass (--track-on-top/bottom, dark in every theme) with the lit edge and
 * the bead becomes a bright glowing light (--bead-on). The bead springs
 * across with a slight overshoot and stretches while pressed.
 */
const SIZES = {
  default: { width: 40, height: 24, thumb: 18 },
  small: { width: 32, height: 18, thumb: 14 },
}

const dims = (size?: string) => (size === 'small' ? SIZES.small : SIZES.default)

const Handle = styled.span<{ $checked: boolean; $size?: string }>`
  position: absolute;
  top: 50%;
  /* left, not a fixed translate: labelled switches are wider than the track. */
  left: ${({ $checked, $size }) =>
    $checked ? `calc(100% - ${dims($size).thumb + 3}px)` : '3px'};
  width: ${({ $size }) => dims($size).thumb}px;
  height: ${({ $size }) => dims($size).thumb}px;
  border-radius: var(--radius-pill);
  background: ${({ $checked }) =>
    $checked ? 'var(--bead-on)' : 'var(--bead-off)'};
  box-shadow: ${({ $checked }) =>
    $checked
      ? '0 0 0 3px color-mix(in srgb, var(--edge-2) 22%, transparent), 0 0 12px var(--edge-2)'
      : '0 1px 3px color-mix(in srgb, var(--stage) 45%, transparent), inset 0 1px 0 var(--glass-highlight)'};
  transform: translateY(-50%);
  transition:
    left var(--dur-control) var(--ease-spring),
    width var(--dur-hover) var(--ease-out),
    margin var(--dur-hover) var(--ease-out),
    background var(--dur-hover) var(--ease-out),
    box-shadow var(--dur-hover) var(--ease-out);

  @media (prefers-reduced-motion: reduce) {
    transition: background var(--dur-hover) linear;
  }
`

const SwitchButton = styled.button<{ $checked: boolean; $size?: string }>`
  position: relative;
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  min-width: ${({ $size }) => dims($size).width}px;
  height: ${({ $size }) => dims($size).height}px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  /* Declared here so the lit edge survives a browser without @property. */
  --edge-angle: 210deg;
  /* Off track per theme; light gets a deeper grey so the white bead reads. */
  --switch-track-off: var(--recess);
  background: ${({ $checked }) =>
    $checked
      ? litEdgeBackground(
          'linear-gradient(90deg, var(--track-on-bottom), var(--track-on-top))',
        )
      : 'linear-gradient(var(--switch-track-off), var(--switch-track-off)) padding-box, linear-gradient(var(--glass-border), var(--glass-border)) border-box'};
  box-shadow: ${({ $checked }) =>
    $checked
      ? 'inset 0 1px 0 color-mix(in srgb, var(--bead-on) 14%, transparent), 0 6px 18px -10px var(--cta-glow)'
      : 'var(--recess-shadow)'};
  vertical-align: middle;
  cursor: pointer;
  transition:
    box-shadow var(--dur-control) var(--ease-out),
    ${edgeTransition};

  /* Static selector (no props): styled-components scopes it to every switch. */
  body[data-theme='light'] & {
    --switch-track-off: color-mix(in srgb, var(--color-text) 14%, transparent);
  }

  &:hover:not(:disabled) {
    --edge-angle: 570deg;
  }

  /* Press: the thumb stretches toward where it is going. */
  &:active:not(:disabled) ${Handle} {
    width: ${({ $size }) => dims($size).thumb + 4}px;
    margin-left: ${({ $checked }) => ($checked ? '-4px' : '0')};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
`

const InnerText = styled.span<{ $checked: boolean; $size?: string }>`
  font-family: var(--font-sans);
  font-size: var(--fs-label);
  line-height: 1;
  font-weight: 500;
  /* On, the label sits on the deep track in the bead's light ink. */
  color: ${({ $checked }) =>
    $checked ? 'var(--bead-on)' : 'var(--color-muted)'};
  padding: ${({ $checked, $size }) => {
    const handleSpace = `${dims($size).thumb + 8}px`
    return $checked ? `0 ${handleSpace} 0 8px` : `0 8px 0 ${handleSpace}`
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
  id?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  'aria-invalid'?: React.AriaAttributes['aria-invalid']
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
  defaultChecked = false,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  'aria-describedby': ariaDescribedby,
  'aria-invalid': ariaInvalid,
}) => {
  const a11y = useFormItemControl({
    id,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
    'aria-describedby': ariaDescribedby,
    'aria-invalid': ariaInvalid,
  })
  const [internalChecked, setInternalChecked] = useState(defaultChecked)
  const isControlled = controlledChecked !== undefined
  const checked = isControlled ? controlledChecked : internalChecked

  useEffect(() => {
    if (isControlled) setInternalChecked(controlledChecked)
  }, [isControlled, controlledChecked])

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return
      const newChecked = !checked
      if (!isControlled) setInternalChecked(newChecked)

      onChange && onChange(newChecked, e)
      onClick && onClick(newChecked, e)
    },
    [checked, disabled, isControlled, onChange, onClick],
  )

  return (
    <SwitchButton
      type="button"
      {...a11y}
      role="switch"
      aria-checked={checked}
      $checked={checked}
      $size={size}
      disabled={disabled}
      onClick={handleClick}
      style={style}
      className={joinClassNames(
        'ui-switch',
        checked && 'ui-switch-checked',
        size === 'small' && 'ui-switch-small',
        className,
      )}
    >
      <InnerText className="ui-switch-inner" $checked={checked} $size={size}>
        {checked ? checkedChildren : unCheckedChildren}
      </InnerText>
      <Handle className="ui-switch-handle" $checked={checked} $size={size} />
    </SwitchButton>
  )
}

export default Switch
