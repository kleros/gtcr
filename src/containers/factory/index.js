import { Layout, Steps, Button, Icon } from 'antd'
import React, { useState } from 'react'
import styled from 'styled-components/macro'
import TCRParams from './tcr-params'
import ItemParams from './item-params'
import Deploy from './deploy'

const { Content } = Layout
const { Step } = Steps

const ButtonGroup = Button.Group
const StyledStepper = styled.div`
  display: flex;
  align-items: flex-end;
  flex-direction: column;
`
const StyledContainer = styled.div`
  margin: 32px 0;
`
const formIds = ['tcrParamsForm', 'itemParamsForm', 'deployTCRForm']
const CurrentStep = ({ currStep, ...rest }) => <>
  {(() => {
    switch (currStep) {
      case 1:
        return <TCRParams formId={formIds[currStep]} {...rest} />
      case 2:
        return <ItemParams formId={formIds[currStep]} {...rest} />
      case 3:
        return <Deploy formId={formIds[currStep]} {...rest} />
      default:
        throw new Error('Unknown step')
    }
  })()}
</>

export default () => {
  const [currStep, setStep] = useState(1)
  const [tcrState, setTcrState] = useState({})

  const postSubmit = values => {
    setStep(currStep + 1)
    setTcrState(prevState => {
      return ({
        ...prevState,
        ...values
      })
    })
  }

  return <Content>
    <Steps current={currStep - 1}>
      <Step title='TCR Parameters' />
      <Step title='Item Parameters' />
      <Step title='Deploy' />
    </Steps>
    <StyledContainer>
      <CurrentStep currStep={currStep} postSubmit={postSubmit} tcrState={tcrState} setTcrState={setTcrState} setStep={setStep} />
    </StyledContainer>
    <StyledStepper>
      <ButtonGroup>
        <Button onClick={() => setStep(currStep - 1)} type='primary' disabled={currStep === 1}>
          <Icon type='left' />
          Previous
        </Button>
        <Button form={formIds[currStep]} htmlType='submit' type='primary' disabled={currStep === 3} >
          Next
          <Icon type='right' />
        </Button>
      </ButtonGroup>
    </StyledStepper>
  </Content>
}
