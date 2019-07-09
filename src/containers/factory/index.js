import { Layout, Steps } from 'antd'
import { useSelector } from 'react-redux'
import Deploy from './deploy'
import ItemParams from './item-params'
import React from 'react'
import styled from 'styled-components/macro'
import TCRParams from './tcr-params'

const { Content } = Layout
const { Step } = Steps

const StyledContainer = styled.div`
  margin: 32px 0;
`

export default () => {
  const { currStep } = useSelector(state => state.factoryWizard)
  const currentStep = currStep => {
    switch (currStep) {
      case 1:
        return <TCRParams />
      case 2:
        return <ItemParams />
      case 3:
        return <Deploy />
      default:
        break
    }
  }

  return (
    <Content>
      <Steps current={currStep - 1}>
        <Step title="TCR Parameters" />
        <Step title="Item Parameters" />
        <Step title="Deploy" />
      </Steps>
      <StyledContainer>{currentStep(currStep)}</StyledContainer>
    </Content>
  )
}
