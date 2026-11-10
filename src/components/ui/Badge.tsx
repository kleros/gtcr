import React from 'react'
import styled, { css } from 'styled-components'
import {
  figureData,
  haloDot,
  joinClassNames,
  kitType,
  type Tone,
  toneColor,
  toneFor,
} from './kit-styles'

const Wrapper = styled.span`
  display: inline-flex;
  position: relative;
  vertical-align: middle;
`

/* Count bubble: tabular figure on the action fill; dot mode is an 8px glowing dot. */
const CountBadge = styled.sup<{ $dot?: boolean }>`
  position: absolute;
  top: -6px;
  right: -6px;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border: 2px solid var(--color-bg);
  border-radius: var(--radius-pill);
  background: var(--color-primary-fill);
  box-shadow: 0 0 10px -2px var(--color-primary);
  color: var(--color-on-primary);
  font-family: var(--font-figure);
  font-size: ${kitType.micro};
  line-height: 1;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  ${({ $dot }) =>
    $dot &&
    css`
      top: -3px;
      right: -3px;
      min-width: 8px;
      width: 8px;
      height: 8px;
      padding: 0;
    `}
`

const StatusWrapper = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`

/* 8px status dot with a halo in its own tone; always next to its words. */
const StatusDot = styled.span<{ $tone: Tone; $raw?: string }>`
  ${({ $tone, $raw }) => haloDot($raw || toneColor($tone))}
`

const StatusText = styled.span`
  ${figureData}
  color: var(--color-text);
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
  className,
}) => {
  // Status mode: dot plus label, no children wrapper
  if (status || (text !== undefined && !children)) {
    const tone = toneFor(color) || toneFor(status) || 'neutral'
    const raw = color && !toneFor(color) ? color : undefined
    return (
      <StatusWrapper
        style={style}
        className={joinClassNames('ui-badge', 'ui-badge-status', className)}
      >
        <StatusDot
          className="ui-badge-status-dot"
          $tone={tone}
          $raw={raw}
          aria-hidden
        />
        {text && (
          <StatusText className="ui-badge-status-text">{text}</StatusText>
        )}
      </StatusWrapper>
    )
  }

  // Count or dot mode, wrapping children
  const showBadge = dot || (count !== undefined && count !== 0)

  return (
    <Wrapper style={style} className={joinClassNames('ui-badge', className)}>
      {children}
      {showBadge && (
        <CountBadge
          className={dot ? 'ui-badge-count ui-badge-dot' : 'ui-badge-count'}
          $dot={dot}
        >
          {dot ? null : count}
        </CountBadge>
      )}
    </Wrapper>
  )
}

export default Badge
