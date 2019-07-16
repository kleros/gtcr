import { Layout, Steps, Button, Icon } from 'antd'
import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components/macro'
import TCRParams from './tcr-params'
import ItemParams from './item-params'
import Deploy from './deploy'
import { version } from '../../../package.json'

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
const CurrentStep = ({ currStep, ...rest }) => (
  <>
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
)

CurrentStep.propTypes = {
  currStep: PropTypes.number.isRequired
}

const useStepper = initialStep => {
  const [currStep, setStep] = useState(initialStep)
  const STEP_COUNT = 3
  const nextStep = () =>
    setStep(currStep => (currStep === STEP_COUNT ? currStep : currStep + 1))
  const previousStep = () =>
    setStep(currStep => (currStep === 1 ? currStep : currStep - 1))
  const resetStepper = () => setStep(1)

  return { currStep, nextStep, previousStep, resetStepper }
}

const useCachedFactory = version => {
  const key = `tcrState@${version}`
  const initialState = {
    title: '',
    description: '',
    requestDeposit: 0.1,
    challengeDeposit: 0.05,
    requireEvidenceRequest: true,
    columns: [
      {
        label: '',
        description: '',
        type: 'address',
        isIdentifier: false
      }
    ],
    currStep: 1
  }
  let cache = window.localStorage.getItem(key)
  if (cache) cache = JSON.parse(cache)
  else cache = JSON.parse(JSON.stringify(initialState)) // Deep copy.

  const [tcrState, setTcrState] = useState(cache)
  const { currStep, nextStep, previousStep } = useStepper(cache.currStep)
  const resetTcrState = () =>
    setTcrState(JSON.parse(JSON.stringify(initialState)))

  useEffect(() =>
    window.localStorage.setItem(
      key,
      JSON.stringify({
        ...tcrState,
        currStep
      })
    )
  )
  return {
    tcrState,
    setTcrState,
    resetTcrState,
    currStep,
    nextStep,
    previousStep
  }
}

export default () => {
  const cachedFactory = useCachedFactory(version)
  const { currStep, nextStep, previousStep } = cachedFactory

  return (
    <Content>
      <Steps current={currStep - 1}>
        <Step title="TCR Parameters" />
        <Step title="Item Parameters" />
        <Step title="Deploy" />
      </Steps>
      <StyledContainer>
        <CurrentStep postSubmit={() => nextStep()} {...cachedFactory} />
      </StyledContainer>
      <StyledStepper>
        <ButtonGroup>
          <Button
            onClick={() => previousStep()}
            type="primary"
            disabled={currStep === 1}
          >
            <Icon type="left" />
            Previous
          </Button>
          <Button
            form={formIds[currStep]}
            htmlType="submit"
            type="primary"
            disabled={currStep === 3}
          >
            Next
            <Icon type="right" />
          </Button>
        </ButtonGroup>
      </StyledStepper>
    </Content>
  )
}
