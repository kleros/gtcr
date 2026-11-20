import React, { useState } from 'react'
import styled, { css } from 'styled-components'
import { KitIcon, type KitIconName } from './kit-icons'
import {
  ghostIconButton,
  haloDot,
  joinClassNames,
  kitRadius,
} from './kit-styles'

type AlertType = 'info' | 'success' | 'warning' | 'error'

const TYPE_ROLE: Record<
  AlertType,
  { color: string; soft: string; icon: KitIconName }
> = {
  info: {
    color: 'var(--color-primary)',
    soft: 'var(--color-primary-soft)',
    icon: 'info-circle',
  },
  success: {
    color: 'var(--color-success)',
    soft: 'var(--color-success-soft)',
    icon: 'check-circle',
  },
  warning: {
    color: 'var(--color-warning)',
    soft: 'var(--color-warning-soft)',
    icon: 'warning-triangle',
  },
  error: {
    color: 'var(--color-danger)',
    soft: 'var(--color-danger-soft)',
    icon: 'error-circle',
  },
}

/*
 * Feedback row, v2: a neutral raised surface with a neutral hairline. The
 * status rides only on the haloed icon (or, without an icon, a haloed dot
 * beside the words) and the words stay in the text roles: never a tinted
 * block or banner. Banners drop the radius and side borders.
 */
const AlertWrapper = styled.div<{ $banner?: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--glass-border);
  border-radius: ${({ $banner }) => ($banner ? '0' : kitRadius.well)};
  background: var(--color-raised);
  box-shadow: inset 0 1px 0 var(--glass-highlight);
  color: var(--color-text);
  font-size: var(--fs-body);
  line-height: var(--lh-body);

  ${({ $banner }) =>
    $banner &&
    css`
      border-top: 0;
      border-right: 0;
      border-left: 0;
    `}
`

/* Without an icon the status is still a dot with a halo, never colour alone on text. */
const StatusDot = styled.span<{ $type: AlertType }>`
  ${({ $type }) => haloDot(TYPE_ROLE[$type].color)}
  margin: 6px 2px 0;
`

const IconWrapper = styled.span<{ $type: AlertType }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  margin-top: -2px;
  border-radius: var(--radius-pill);
  background: ${({ $type }) => TYPE_ROLE[$type].soft};
  box-shadow: 0 0 12px
    ${({ $type }) =>
      `color-mix(in srgb, ${TYPE_ROLE[$type].color} 30%, transparent)`};
  color: ${({ $type }) => TYPE_ROLE[$type].color};
`

const Content = styled.div`
  flex: 1;
  min-width: 0;
`

const Message = styled.div<{ $hasDescription: boolean }>`
  font-weight: ${({ $hasDescription }) => ($hasDescription ? 500 : 400)};
  overflow-wrap: anywhere;
`

const Description = styled.div`
  margin-top: 4px;
  color: var(--color-muted);
  overflow-wrap: anywhere;
`

const CloseButton = styled.button`
  ${ghostIconButton}
  width: 24px;
  height: 24px;
  margin: -2px -4px 0 0;
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

interface AlertProps {
  message?: React.ReactNode
  description?: React.ReactNode
  type?: AlertType
  showIcon?: boolean
  closable?: boolean
  onClose?: (e: React.MouseEvent) => void
  closeText?: React.ReactNode
  banner?: boolean
  style?: React.CSSProperties
  className?: string
  children?: React.ReactNode
}

const Alert: React.FC<AlertProps> = ({
  message,
  description,
  type = 'info',
  showIcon,
  closable,
  onClose,
  closeText,
  banner,
  style,
  className,
  children,
}) => {
  const [closed, setClosed] = useState(false)

  if (closed) return null

  const role = TYPE_ROLE[type] || TYPE_ROLE.info
  const shouldShowIcon = showIcon === undefined ? banner : showIcon

  const handleClose = (e: React.MouseEvent) => {
    setClosed(true)
    onClose && onClose(e)
  }

  return (
    <AlertWrapper
      $banner={banner}
      style={style}
      className={joinClassNames(
        'ui-alert',
        `ui-alert-${type}`,
        banner && 'ui-alert-banner',
        className,
      )}
      role="alert"
    >
      {shouldShowIcon ? (
        <IconWrapper className="ui-alert-icon" $type={type}>
          <KitIcon name={role.icon} size={15} />
        </IconWrapper>
      ) : (
        <StatusDot className="ui-alert-dot" $type={type} aria-hidden="true" />
      )}
      <Content className="ui-alert-content">
        {message && (
          <Message
            className="ui-alert-message"
            $hasDescription={Boolean(description)}
          >
            {message}
          </Message>
        )}
        {description && (
          <Description className="ui-alert-description">
            {description}
          </Description>
        )}
        {children}
      </Content>
      {closable && (
        <CloseButton
          type="button"
          className="ui-alert-close"
          onClick={handleClose}
          aria-label="Close"
        >
          {closeText || <KitIcon name="close" size={14} />}
        </CloseButton>
      )}
    </AlertWrapper>
  )
}

export default Alert
