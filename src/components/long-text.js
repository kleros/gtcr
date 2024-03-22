import React from 'react'
import styled from 'styled-components'
import { Typography } from 'antd'

const StyledSpan = styled.span`
  color: gray;
`

const LongText = ({ value }) => {
  if (!value) return <StyledSpan>empty</StyledSpan>

  return <Typography.Paragraph>{value}</Typography.Paragraph>
}

export default LongText
