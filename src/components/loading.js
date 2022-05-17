import React from 'react'
import { Spin } from 'antd'
import styled from 'styled-components/macro'

const LoadingWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
`

const Loading = () => (
  <LoadingWrapper>
    <Spin />
  </LoadingWrapper>
)

export default Loading
