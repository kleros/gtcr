import { Layout } from 'antd'
import React from 'react'
import styled from 'styled-components/macro'
import { version } from '../../package.json'

const { Content } = Layout
const StyledContent = styled(Content)`
  padding: 0 9.375vw 62px;
`

export default () => <StyledContent>GTCR version {version}</StyledContent>
