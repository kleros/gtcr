import React from 'react'
import styled, { css } from 'styled-components'

const Wrapper = styled.span`
  display: inline-flex;
  position: relative;
  vertical-align: middle;
`

const CountBadge = styled.sup<{ $dot?: boolean }>`
  position: absolute;
  top: -8px;
  right: -8px;
  z-index: 1;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  font-size: 12px;
  line-height: 20px;
  text-align: center;
  white-space: nowrap;
  color: #fff;
  background: ${({ theme }) => theme.errorColor};
  border-radius: 10px;
  box-shadow: 0 0 0 1px ${({ theme }) => theme.componentBackground};

  ${({ $dot }) =>
    $dot &&
    css`
      min-width: 8px;
      width: 8px;
      height: 8px;
      padding: 0;
      border-radius: 50%;
      top: -4px;
      right: -4px;
    `}
`

const StatusWrapper = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  line-height: 1;
`

const STATUS_COLORS: Record<string, string> = {
  success: 'successColor',
  processing: 'primaryColor',
  error: 'errorColor',
  warning: 'warningColor',
  default: 'badgeFallbackColor'
}

const StatusDot = styled.span<{ $color?: string; $status?: string }>`
  display: inline-block;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${({ $color, $status, theme }) => {
    if ($color) return $color
    const key = STATUS_COLORS[$status || ''] || STATUS_COLORS.default
    return theme[key]
  }};
`

const StatusText = styled.span`
  color: inherit;
  font-size: 14px;
`

interface BadgeProps {
  count?: number
  status?: 'success' | 'processing' | 'error' | 'warning' | 'default'
  color?: string
  text?: React.ReactNode
  dot?: boolean
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

const Badge: React.FC<BadgeProps> = ({
  count,
  status,
  color,
  text,
  dot,
  children,
  style,
  className
}) => {
  // Status mode (no children wrapper)
  if (status || (text !== undefined && !children)) {
    return (
      <StatusWrapper style={style} className={className}>
        <StatusDot $status={status} $color={color} />
        {text && <StatusText>{text}</StatusText>}
      </StatusWrapper>
    )
  }

  // Count/dot mode (wrapping children)
  const showBadge = dot || (count !== undefined && count !== 0)

  return (
    <Wrapper style={style} className={className}>
      {children}
      {showBadge && (
        <CountBadge $dot={dot}>
          {!dot ? count : null}
        </CountBadge>
      )}
    </Wrapper>
  )
}

export default Badge
