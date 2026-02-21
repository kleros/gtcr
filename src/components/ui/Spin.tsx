import React from 'react'
import styled, { keyframes } from 'styled-components'

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`

const SpinnerDot = styled.span<{ $size: number }>`
  display: inline-block;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border: 2px solid ${({ theme }) => theme.primaryColor};
  border-top-color: transparent;
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
`

const SpinnerContainer = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
`

const Wrapper = styled.div`
  position: relative;
`

const ContentOverlay = styled.div<{ $spinning: boolean }>`
  transition: opacity 0.3s;
  opacity: ${({ $spinning }) => ($spinning ? 0.4 : 1)};
  pointer-events: ${({ $spinning }) => ($spinning ? 'none' : 'auto')};
`

const OverlaySpinner = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 4;
`

const TipText = styled.div`
  color: ${({ theme }) => theme.primaryColor};
  font-size: 14px;
  margin-top: 8px;
`

const SpinnerCenter = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`

const SIZES: Record<string, number> = { small: 14, default: 20, large: 32 }

interface SpinProps {
  spinning?: boolean
  size?: 'small' | 'default' | 'large'
  tip?: React.ReactNode
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

const Spin: React.FC<SpinProps> = ({
  spinning = true,
  size = 'default',
  tip,
  children,
  style,
  className
}) => {
  const dotSize = SIZES[size] || SIZES.default

  const spinner = (
    <SpinnerCenter>
      <SpinnerDot $size={dotSize} />
      {tip && <TipText>{tip}</TipText>}
    </SpinnerCenter>
  )

  if (!children) {
    return (
      <SpinnerContainer style={style} className={className}>
        {spinning && spinner}
      </SpinnerContainer>
    )
  }

  return (
    <Wrapper style={style} className={className}>
      {spinning && <OverlaySpinner>{spinner}</OverlaySpinner>}
      <ContentOverlay $spinning={spinning}>{children}</ContentOverlay>
    </Wrapper>
  )
}

export default Spin
