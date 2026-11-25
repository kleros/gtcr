import React from 'react'
import styled, {
  css,
  keyframes,
  type FlattenSimpleInterpolation,
} from 'styled-components'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconProp } from '@fortawesome/fontawesome-svg-core'
import {
  ctaButton,
  ctaButtonLit,
  edgeTransition,
  joinClassNames,
  kitRadius,
  motionOk,
  quietButton,
  quietButtonHover,
} from './kit-styles'

/*
 * Button, round 2 ("Lit edge", DESIGN.md): primary is a dark glass pill with
 * a luminous 1px edge that sweeps round and glows on hover and focus;
 * secondary is a quiet ghost with a hairline; ghost, link and danger (soft
 * danger tint) as before. Height 40, 32 small, pill-shaped (`shape="square"`
 * keeps the 10px corner), labels at 500. Press dips to 97% and springs back.
 * Disabled turns neutral with its label at full contrast.
 * `type` keeps the legacy names and maps them onto those looks; indigo is
 * never used on buttons. A pending action runs a thin shimmer along the
 * bottom edge instead of a spinner.
 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'link' | 'danger'

const variantMap: Record<string, Variant> = {
  default: 'secondary',
  primary: 'primary',
  secondary: 'secondary',
  dashed: 'secondary',
  ghost: 'ghost',
  link: 'link',
  purple: 'primary',
  danger: 'danger',
}

const enabledState =
  ':not(:disabled):not([aria-disabled="true"]):not([data-loading="true"])'
const enabled = `&${enabledState}`

const variantStyles: Record<Variant, FlattenSimpleInterpolation> = {
  primary: css`
    ${ctaButton}

    ${enabled}:hover, ${enabled}:focus-visible {
      ${ctaButtonLit}
    }
  `,
  secondary: css`
    ${quietButton}

    ${enabled}:hover {
      ${quietButtonHover}
    }
  `,
  ghost: css`
    border-color: transparent;
    background: transparent;
    color: var(--color-muted);

    ${enabled}:hover {
      color: var(--color-text);
      background: var(--color-raised);
    }
  `,
  link: css`
    /* Inline links stay compact but keep a 24px touch target. */
    height: auto;
    min-height: 24px;
    padding-inline: 0;
    border-color: transparent;
    background: transparent;
    color: var(--color-primary);

    ${enabled}:hover {
      color: var(--color-primary-hover);
    }

    ${enabled}:active {
      transform: none;
    }
  `,
  danger: css`
    border-color: color-mix(in srgb, var(--color-danger) 38%, transparent);
    background: var(--color-danger-soft);
    color: var(--color-danger);

    ${enabled}:hover {
      border-color: color-mix(in srgb, var(--color-danger) 60%, transparent);
      background: color-mix(in srgb, var(--color-danger) 20%, transparent);
    }
  `,
}

const pending = keyframes`
  from { background-position: 160% 0; }
  to { background-position: -60% 0; }
`

const ButtonScope = styled.span<{
  $block?: boolean
  $small?: boolean
  $shape?: string
  $variant: Variant
}>`
  display: ${({ $block }) => ($block ? 'flex' : 'inline-flex')};
  width: ${({ $block }) => ($block ? '100%' : 'auto')};
  max-width: 100%;
  vertical-align: middle;

  > .gtcr-v2-button {
    position: relative;
    isolation: isolate;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: ${({ $block }) => ($block ? '100%' : 'auto')};
    height: ${({ $small }) => ($small ? '32px' : '40px')};
    padding: 0 ${({ $small }) => ($small ? '12px' : '18px')};
    overflow: hidden;
    border: 1px solid transparent;
    border-radius: ${({ $shape }) =>
      $shape === 'square' ? kitRadius.control : 'var(--radius-pill)'};
    font-family: var(--font-sans);
    font-size: var(--fs-body);
    line-height: var(--lh-body);
    font-weight: 500;
    letter-spacing: -0.005em;
    white-space: nowrap;
    text-decoration: none;
    cursor: pointer;
    appearance: none;
    transition:
      background var(--dur-hover) var(--ease-out),
      border-color var(--dur-hover) var(--ease-out),
      box-shadow var(--dur-hover) var(--ease-out),
      color var(--dur-hover) var(--ease-out),
      filter var(--dur-hover) var(--ease-out),
      transform 260ms var(--ease-spring),
      ${edgeTransition};

    ${({ $variant }) => variantStyles[$variant]}
  }

  /* Press dips to 97% and springs back; no movement under reduced motion. */
  ${motionOk(css`
    > .gtcr-v2-button${enabledState}:active {
      transform: scale(0.97);
      transition-duration: var(--dur-press);
      transition-timing-function: var(--ease-out);
    }
  `)}

  /*
   * Disabled keeps its label fully legible (it often names the blocker,
   * "Connect wallet to submit"): a neutral raised look in the muted text
   * role, no fill colour, no glow, no fade.
   */
  > .gtcr-v2-button:disabled:not([data-loading='true']),
  > .gtcr-v2-button[aria-disabled='true']:not([data-loading='true']) {
    border-color: ${({ $variant }) =>
      $variant === 'link' || $variant === 'ghost'
        ? 'transparent'
        : 'var(--glass-border)'};
    background: ${({ $variant }) =>
      $variant === 'link' || $variant === 'ghost'
        ? 'transparent'
        : 'var(--color-raised)'};
    color: var(--color-muted);
    box-shadow: none;
    filter: none;
    cursor: not-allowed;

    &::before,
    &::after {
      content: none;
    }
  }

  > .gtcr-v2-button[data-loading='true'] {
    cursor: progress;
    opacity: 0.85;
  }

  .button-text {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;

    > svg {
      display: block;
      flex-shrink: 0;
    }
  }

  .button-svg {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 16px;
    height: 16px;

    > svg {
      display: block;
      width: 16px;
      height: 16px;
    }
  }

  /* Pending: a thin light runs along the bottom edge while the wallet works. */
  .button-loading {
    position: absolute;
    right: 10px;
    bottom: 0;
    left: 10px;
    height: 2px;
    border-radius: var(--radius-pill);
    background-image: linear-gradient(
      90deg,
      transparent 20%,
      currentColor 50%,
      transparent 80%
    );
    background-size: 200% 100%;
    background-repeat: no-repeat;
    animation: ${pending} 1.1s linear infinite;
    pointer-events: none;

    @media (prefers-reduced-motion: reduce) {
      animation: none;
      background-image: none;
      background-color: currentColor;
      opacity: 0.6;
    }
  }

  ${({ $shape, $small }) =>
    $shape === 'circle' &&
    css`
      > .gtcr-v2-button {
        width: ${$small ? '32px' : '40px'};
        min-width: ${$small ? '32px' : '40px'};
        padding: 0;
      }

      .button-text {
        display: none;
      }
    `}
`

const IconWrap = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
`

const GroupWrapper = styled.div`
  display: inline-flex;
  align-items: center;

  > ${ButtonScope} {
    margin-left: -1px;

    &:first-child {
      margin-left: 0;
    }
  }

  > ${ButtonScope}:first-child > .gtcr-v2-button {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  > ${ButtonScope}:last-child > .gtcr-v2-button {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  > ${ButtonScope}:not(:first-child):not(:last-child) > .gtcr-v2-button {
    border-radius: 0;
  }
`

interface ButtonProps {
  type?: string
  shape?: string
  size?: string
  loading?: boolean
  htmlType?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  onClick?: React.MouseEventHandler
  onPress?: React.MouseEventHandler
  href?: string
  target?: string
  block?: boolean
  icon?: React.ReactNode
  form?: string
  text?: React.ReactNode
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
  id?: string
  [key: string]: unknown
}

interface ButtonGroupProps {
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

const Button: React.FC<ButtonProps> & { Group: React.FC<ButtonGroupProps> } = ({
  type = 'default',
  shape,
  size,
  loading,
  htmlType = 'button',
  disabled,
  onClick,
  onPress,
  href,
  target,
  block,
  icon,
  form,
  text: textProp,
  children,
  style,
  className,
  id,
  ...rest
}) => {
  const variant = variantMap[type] || 'secondary'
  const text = children ?? textProp ?? ''
  const isDisabled = Boolean(disabled || loading)
  const handleClick: React.MouseEventHandler = (event) => {
    if (isDisabled && href) {
      event.preventDefault()
      return
    }
    ;(onClick || onPress)?.(event)
  }
  const iconNode = icon ? (
    <IconWrap className="button-svg">
      {typeof icon === 'string' ? (
        <FontAwesomeIcon icon={icon as IconProp} />
      ) : (
        icon
      )}
    </IconWrap>
  ) : null
  const innerClassName = joinClassNames('gtcr-v2-button', className)

  return (
    <ButtonScope
      $block={block}
      $shape={shape}
      $small={size === 'small'}
      $variant={variant}
      className={joinClassNames('ui-btn', `ui-btn-${variant}`, className)}
      style={style}
    >
      {href ? (
        <a
          id={id}
          className={innerClassName}
          href={isDisabled ? undefined : href}
          target={target}
          rel={target === '_blank' ? 'noopener noreferrer' : undefined}
          aria-disabled={isDisabled}
          aria-busy={loading || undefined}
          data-loading={loading ? 'true' : undefined}
          onClick={handleClick}
          {...rest}
        >
          {loading && <span className="button-loading" aria-hidden="true" />}
          {iconNode}
          {text && <span className="button-text">{text}</span>}
        </a>
      ) : (
        <button
          id={id}
          className={innerClassName}
          disabled={isDisabled}
          aria-busy={loading || undefined}
          data-loading={loading ? 'true' : undefined}
          type={htmlType}
          form={form}
          onClick={handleClick}
          {...rest}
        >
          {loading && <span className="button-loading" aria-hidden="true" />}
          {iconNode}
          {text && <span className="button-text">{text}</span>}
        </button>
      )}
    </ButtonScope>
  )
}

Button.Group = ({ children, style, className }: ButtonGroupProps) => (
  <GroupWrapper
    style={style}
    className={joinClassNames('ui-btn-group', className)}
    role="group"
  >
    {children}
  </GroupWrapper>
)

Button.Group.displayName = 'Button.Group'

export default Button
