import React from 'react'
import styled, { css, keyframes } from 'styled-components'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`

const sizeStyles: Record<string, any> = {
  small: css`
    height: 24px;
    padding: 0 7px;
    font-size: 12px;
  `,
  default: css`
    height: 32px;
    padding: 0 15px;
    font-size: 14px;
  `,
  large: css`
    height: 40px;
    padding: 0 15px;
    font-size: 16px;
  `
}

const getTypeStyles = ({ btnType, theme }: { btnType?: string; theme: any }) => {
  switch (btnType) {
    case 'primary':
      return css`
        background: ${theme.buttonPrimaryBg};
        color: ${theme.buttonPrimaryText};
        border-color: ${theme.buttonPrimaryBg};

        &:hover:not(:disabled),
        &:focus:not(:disabled) {
          background: ${theme.buttonPrimaryHoverBg};
          border-color: ${theme.buttonPrimaryHoverBg};
        }
      `
    case 'ghost':
      return css`
        background: transparent;
        color: ${theme.textPrimary};
        border-color: ${theme.borderColor};

        &:hover:not(:disabled),
        &:focus:not(:disabled) {
          color: ${theme.primaryColor};
          border-color: ${theme.primaryColor};
        }
      `
    case 'danger':
      return css`
        background: ${theme.errorColor};
        color: #fff;
        border-color: ${theme.errorColor};

        &:hover:not(:disabled),
        &:focus:not(:disabled) {
          opacity: 0.85;
        }
      `
    case 'link':
      return css`
        background: transparent;
        color: ${theme.linkColor};
        border-color: transparent;
        box-shadow: none;

        &:hover:not(:disabled),
        &:focus:not(:disabled) {
          color: ${theme.primaryColor};
          opacity: 0.85;
        }
      `
    default:
      return css`
        background: ${theme.componentBackground};
        color: ${theme.textPrimary};
        border-color: ${theme.borderColor};

        &:hover:not(:disabled),
        &:focus:not(:disabled) {
          color: ${theme.primaryColor};
          border-color: ${theme.primaryColor};
        }
      `
  }
}

const shapeStyles = ({ shape }: { shape?: string }) => {
  if (shape === 'circle')
    return css`
      border-radius: 50%;
      min-width: 32px;
      padding: 0;
      text-align: center;
    `
  if (shape === 'round')
    return css`
      border-radius: 32px;
    `
  return ''
}

interface StyledButtonTransientProps {
  btnType?: string
  shape?: string
  size?: string
  block?: boolean
}

const StyledButton = styled.button<StyledButtonTransientProps>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
  line-height: 1.5;
  font-weight: 400;
  white-space: nowrap;
  user-select: none;
  touch-action: manipulation;

  ${({ size }) => sizeStyles[size || 'default']}
  ${getTypeStyles}
  ${shapeStyles}

  ${({ block }) =>
    block &&
    css`
      display: flex;
      width: 100%;
    `}

  &:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }
`

const StyledLink = styled.a<StyledButtonTransientProps>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
  line-height: 1.5;
  font-weight: 400;
  white-space: nowrap;
  user-select: none;
  touch-action: manipulation;
  text-decoration: none;

  ${({ size }) => sizeStyles[size || 'default']}
  ${getTypeStyles}
  ${shapeStyles}

  ${({ block }) =>
    block &&
    css`
      display: flex;
      width: 100%;
    `}

  &:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }
`

const Spinner = styled(FontAwesomeIcon)`
  animation: ${spin} 1s linear infinite;
`

const GroupWrapper = styled.div`
  display: inline-flex;

  & > button,
  & > a {
    border-radius: 0;

    &:first-child {
      border-radius: 4px 0 0 4px;
    }

    &:last-child {
      border-radius: 0 4px 4px 0;
    }

    &:not(:last-child) {
      border-right-width: 0;
    }
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
  href?: string
  target?: string
  block?: boolean
  icon?: React.ReactNode
  form?: string
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
  [key: string]: any
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
  href,
  target,
  block,
  icon,
  form,
  children,
  style,
  className,
  ...rest
}) => {
  const iconContent = loading ? (
    <Spinner icon="spinner" />
  ) : icon ? (
    typeof icon === 'string' ? (
      <FontAwesomeIcon icon={icon as any} />
    ) : (
      icon
    )
  ) : null

  if (href) {
    return (
      <StyledLink
        href={href}
        target={target}
        btnType={type}
        shape={shape}
        size={size}
        block={block}
        style={style}
        className={className}
        onClick={disabled || loading ? (e: React.MouseEvent) => e.preventDefault() : onClick}
        {...rest}
      >
        {iconContent}
        {children}
      </StyledLink>
    )
  }

  return (
    <StyledButton
      type={htmlType}
      btnType={type}
      shape={shape}
      size={size}
      disabled={disabled || loading}
      onClick={onClick}
      block={block}
      form={form}
      style={style}
      className={className}
      {...rest}
    >
      {iconContent}
      {children}
    </StyledButton>
  )
}

Button.Group = ({ children, style, className }: ButtonGroupProps) => (
  <GroupWrapper style={style} className={className}>
    {children}
  </GroupWrapper>
)

Button.Group.displayName = 'Button.Group'

export default Button
