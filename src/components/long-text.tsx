import React from 'react'
import styled from 'styled-components'
import { Typography } from 'components/ui'

const StyledSpan = styled.span`
  color: ${({ theme }) => theme.textSecondary};
`

interface LongTextProps {
  value?: string | null
}

const LongText = ({ value }: LongTextProps) => {
  if (!value) return <StyledSpan>empty</StyledSpan>

  return <Typography.Paragraph>{value}</Typography.Paragraph>
}

export default LongText
