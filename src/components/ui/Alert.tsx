import React, { useState } from 'react'
import styled, { css } from 'styled-components'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

type AlertType = 'info' | 'success' | 'warning' | 'error'

const TYPE_CONFIG: Record<AlertType, { icon: string; colorKey: string }> = {
  info: { icon: 'info-circle', colorKey: 'infoColor' },
  success: { icon: 'check-circle', colorKey: 'successColor' },
  warning: { icon: 'exclamation-triangle', colorKey: 'warningColor' },
  error: { icon: 'times-circle', colorKey: 'errorColor' }
}

const getTypeColor = (type: AlertType, theme: any): string => {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.info
  return theme[config.colorKey]
}

interface AlertWrapperProps {
  $type: AlertType
  $banner?: boolean
}

const AlertWrapper = styled.div<AlertWrapperProps>`
  display: flex;
  align-items: flex-start;
  padding: 12px 16px;
  border: 1px solid ${({ $type, theme }) => {
    const color = getTypeColor($type, theme)
    return theme.name === 'dark' ? `${color}30` : color
  }};
  background: ${({ $type, theme }) => {
    const color = getTypeColor($type, theme)
    return theme.name === 'dark' ? `${color}0a` : `${color}15`
  }};
  border-radius: ${({ $banner }) => ($banner ? '0' : '8px')};
  font-size: 14px;
  line-height: 1.6;
  color: ${({ theme }) => theme.textPrimary};
  gap: 8px;

  ${({ $banner }) =>
    $banner &&
    css`
      border-left: none;
      border-right: none;
      border-top: none;
    `}
`

const IconWrapper = styled.span<{ $type: AlertType }>`
  color: ${({ $type, theme }) => getTypeColor($type, theme)};
  font-size: 16px;
  line-height: 1.5;
  flex-shrink: 0;
  padding-top: 1px;
`

const Content = styled.div`
  flex: 1;
  min-width: 0;
`

const Message = styled.div<{ $hasDescription: boolean }>`
  font-weight: ${({ $hasDescription }) => ($hasDescription ? 600 : 400)};
  font-size: ${({ $hasDescription }) => ($hasDescription ? '16px' : '14px')};
`

const Description = styled.div`
  font-size: 14px;
  margin-top: 4px;
  color: ${({ theme }) => theme.textSecondary};
`

const CloseButton = styled.button`
  border: none;
  background: none;
  cursor: pointer;
  color: ${({ theme }) => theme.textSecondary};
  font-size: 12px;
  padding: 0;
  margin-left: 8px;
  flex-shrink: 0;
  line-height: 1.5;
  transition: color 0.2s;

  &:hover {
    color: ${({ theme }) => theme.textPrimary};
  }
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
  children
}) => {
  const [closed, setClosed] = useState(false)

  if (closed) return null

  const config = TYPE_CONFIG[type] || TYPE_CONFIG.info
  const shouldShowIcon = showIcon !== undefined ? showIcon : banner

  const handleClose = (e: React.MouseEvent) => {
    setClosed(true)
    onClose && onClose(e)
  }

  return (
    <AlertWrapper
      $type={type}
      $banner={banner}
      style={style}
      className={className}
      role="alert"
    >
      {shouldShowIcon && (
        <IconWrapper $type={type}>
          <FontAwesomeIcon icon={config.icon as any} />
        </IconWrapper>
      )}
      <Content>
        {message && (
          <Message $hasDescription={!!description}>{message}</Message>
        )}
        {description && <Description>{description}</Description>}
        {children}
      </Content>
      {closable && (
        <CloseButton onClick={handleClose}>
          {closeText || <FontAwesomeIcon icon="times" />}
        </CloseButton>
      )}
    </AlertWrapper>
  )
}

export default Alert
