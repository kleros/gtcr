import React from 'react'
import styled, { css, keyframes, DefaultTheme } from 'styled-components'

const activeAnim = keyframes`
  0% {
    transform: translateX(-100%) scaleX(0);
    opacity: 0.1;
  }
  20% {
    transform: translateX(-100%) scaleX(0);
    opacity: 0.5;
  }
  100% {
    transform: translateX(0) scaleX(1);
    opacity: 0;
  }
`

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  font-size: 14px;
  line-height: 1.5;
`

const Outer = styled.div<{ $showInfo: boolean }>`
  flex: 1;
  min-width: 0;
  margin-right: ${({ $showInfo }) => ($showInfo ? '8px' : '0')};
`

const Inner = styled.div`
  position: relative;
  width: 100%;
  height: 8px;
  border-radius: 100px;
  background: ${({ theme }) => theme.borderColor};
  overflow: hidden;
`

const getBarColor = (
  status: string,
  strokeColor: string | undefined,
  theme: DefaultTheme,
): string => {
  if (strokeColor) return strokeColor
  switch (status) {
    case 'success':
      return theme.successColor
    case 'exception':
      return theme.errorColor
    default:
      return theme.primaryColor
  }
}

interface BarProps {
  $status: string
  $strokeColor?: string
  $percent: number
}

const Bar = styled.div<BarProps>`
  position: relative;
  height: 100%;
  border-radius: 100px;
  background: ${({ $status, $strokeColor, theme }) =>
    getBarColor($status, $strokeColor, theme)};
  width: ${({ $percent }) => `${Math.min(Math.max($percent, 0), 100)}%`};
  transition: width 0.3s ease;

  ${({ $status }) =>
    $status === 'active' &&
    css`
      &::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background: #fff;
        animation: ${activeAnim} 2.4s cubic-bezier(0.23, 1, 0.32, 1) infinite;
      }
    `}
`

const Info = styled.span`
  white-space: nowrap;
  font-size: 12px;
  color: ${({ theme }) => theme.textPrimary};
  min-width: 36px;
  text-align: right;
`

interface ProgressProps {
  percent?: number
  status?: 'normal' | 'active' | 'success' | 'exception'
  showInfo?: boolean
  strokeColor?: string
  style?: React.CSSProperties
  className?: string
}

const Progress: React.FC<ProgressProps> = ({
  percent = 0,
  status = 'normal',
  showInfo = true,
  strokeColor,
  style,
  className,
}) => {
  const effectiveStatus =
    status === 'normal' && percent >= 100 ? 'success' : status

  return (
    <Wrapper
      style={style}
      className={`ui-progress${className ? ` ${className}` : ''}`}
    >
      <Outer $showInfo={showInfo}>
        <Inner>
          <Bar
            $percent={percent}
            $status={effectiveStatus}
            $strokeColor={strokeColor}
          />
        </Inner>
      </Outer>
      {showInfo && <Info>{Math.round(percent)}%</Info>}
    </Wrapper>
  )
}

export default Progress
