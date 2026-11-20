import React from 'react'
import styled, { keyframes } from 'styled-components'
import { KitIcon, type KitIconName } from './kit-icons'
import { joinClassNames, kitType } from './kit-styles'

type ResultStatus = 'success' | 'error' | 'warning' | 'info'

const STATUS: Record<ResultStatus, { color: string; icon: KitIconName }> = {
  success: { color: 'var(--color-success)', icon: 'check-circle' },
  error: { color: 'var(--color-danger)', icon: 'error-circle' },
  warning: { color: 'var(--color-warning)', icon: 'warning-triangle' },
  info: { color: 'var(--color-primary)', icon: 'info-circle' },
}

const rise = keyframes`
  from { opacity: 0; filter: blur(6px); transform: scale(0.9); }
  to { opacity: 1; filter: blur(0); transform: scale(1); }
`

/*
 * Result, v2: the status glyph standing in a soft halo of its own colour
 * (no disc, no ring, no tile), a display title, one muted line and the
 * next action. The glyph fades up out of a blur.
 */
const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 24px;
  text-align: center;
`

const IconWrapper = styled.div<{ $color: string }>`
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin-bottom: 14px;
  color: ${({ $color }) => $color};
  filter: drop-shadow(
    0 0 10px ${({ $color }) => `color-mix(in srgb, ${$color} 45%, transparent)`}
  );
  animation: ${rise} 520ms var(--ease-out) both;

  &::before {
    content: '';
    position: absolute;
    inset: -18px;
    z-index: -1;
    border-radius: var(--radius-pill);
    background: radial-gradient(
      closest-side,
      ${({ $color }) => `color-mix(in srgb, ${$color} 22%, transparent)`},
      transparent
    );
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const Title = styled.div`
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: ${kitType.titleMd};
  line-height: ${kitType.titleMdLine};
  font-weight: 500;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
`

const SubTitle = styled.div`
  max-width: 48ch;
  margin-top: 8px;
  color: var(--color-muted);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
`

const Extra = styled.div`
  margin-top: 22px;
`

interface ResultProps {
  status?: ResultStatus
  title?: React.ReactNode
  subTitle?: React.ReactNode
  extra?: React.ReactNode
  icon?: React.ReactNode
  style?: React.CSSProperties
  className?: string
  [key: string]: unknown
}

const Result: React.FC<ResultProps> = ({
  status = 'info',
  title,
  subTitle,
  extra,
  icon,
  className,
  ...rest
}) => {
  const role = STATUS[status] || STATUS.info

  return (
    <Wrapper
      className={joinClassNames('ui-result', `ui-result-${status}`, className)}
      {...rest}
    >
      <IconWrapper className="ui-result-icon" $color={role.color}>
        {icon || <KitIcon name={role.icon} size={32} />}
      </IconWrapper>
      {title && <Title className="ui-result-title">{title}</Title>}
      {subTitle && (
        <SubTitle className="ui-result-subtitle">{subTitle}</SubTitle>
      )}
      {extra && <Extra className="ui-result-extra">{extra}</Extra>}
    </Wrapper>
  )
}

export default Result
