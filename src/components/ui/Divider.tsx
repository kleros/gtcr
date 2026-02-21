import React from 'react'
import styled, { css } from 'styled-components'

interface DividerWrapperProps {
  $hasChildren: boolean
  $orientation: string
}

const DividerWrapper = styled.div<DividerWrapperProps>`
  display: flex;
  align-items: center;
  margin: 24px 0;
  color: ${({ theme }) => theme.textPrimary};
  font-weight: 500;
  font-size: 16px;
  white-space: nowrap;

  &::before,
  &::after {
    content: '';
    flex: 1;
    border-top: 1px solid ${({ theme }) => theme.borderColor};
  }

  ${({ $hasChildren }) =>
    !$hasChildren &&
    css`
      &::before {
        flex: 1;
      }
      &::after {
        display: none;
      }
    `}

  ${({ $hasChildren, $orientation }) =>
    $hasChildren &&
    css`
      &::before {
        flex: ${$orientation === 'left' ? '0 0 5%' : $orientation === 'right' ? '1' : '1'};
      }
      &::after {
        flex: ${$orientation === 'left' ? '1' : $orientation === 'right' ? '0 0 5%' : '1'};
      }
    `}
`

const LabelText = styled.span`
  padding: 0 1em;
`

interface DividerProps {
  orientation?: 'left' | 'center' | 'right'
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

const Divider: React.FC<DividerProps> = ({ orientation = 'center', children, style, className }) => (
  <DividerWrapper
    $hasChildren={!!children}
    $orientation={orientation}
    style={style}
    className={className}
    role="separator"
  >
    {children && <LabelText>{children}</LabelText>}
  </DividerWrapper>
)

export default Divider
