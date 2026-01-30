import React from 'react'
import styled from 'styled-components'
import { Spin } from 'antd'

const LoadingWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding-top: 24px;
`

const Loading = () => (
  <LoadingWrapper>
    <Spin />
  </LoadingWrapper>
)

export default Loading
