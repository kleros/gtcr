import { Steps, Button, Icon, Card, Empty } from 'antd'
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDebounce } from 'use-debounce'
import styled from 'styled-components/macro'
import TCRParams from './tcr-params'
import ItemParams from './item-params'
import Deploy from './deploy'
import StyledLayoutContent from '../layout-content'
import { version } from '../../../package.json'

const { Step } = Steps

const ButtonGroup = Button.Group
const StyledStepper = styled.div`
  display: flex;
  align-items: flex-end;
  flex-direction: column;
`
const StyledContainer = styled.div`
  margin: 32px 0;
  word-break: break-word;
`
const formIds = ['tcrParamsForm', 'itemParamsForm', 'deployTCRForm']
const CurrentStep = props => (
  <>
    {(() => {
      const {
        tcrState: { currStep }
      } = props
      switch (currStep) {
        case 1:
          return <TCRParams formId={formIds[currStep]} {...props} />
        case 2:
          return <ItemParams formId={formIds[currStep]} {...props} />
        case 3:
          return <Deploy formId={formIds[currStep]} {...props} />
        default:
          throw new Error('Unknown step')
      }
    })()}
  </>
)

const useCachedFactory = version => {
  const key = `tcrState@${version}`
  const initialWizardState = {
    tcrTitle: '',
    tcrDescription: '',
    requesterBaseDeposit: 0.025,
    challengerBaseDeposit: 0.015,
    arbitratorAddress: '',
    itemName: 'Item',
    requireEvidenceRequest: true,
    columns: [
      {
        label: '',
        description: '',
        type: 'address',
        isIdentifier: true
      }
    ],
    currStep: 1
  }
  const initialState = {
    ...initialWizardState,
    transactions: {}
  }
  let cache = window.localStorage.getItem(key)
  if (cache) cache = JSON.parse(cache)
  else cache = JSON.parse(JSON.stringify(initialState)) // Deep copy.

  const [tcrState, setTcrState] = useState(cache)
  const [debouncedTcrState] = useDebounce(tcrState, 1000)

  const STEP_COUNT = 3
  const nextStep = () =>
    setTcrState(prevState => ({
      ...prevState,
      currStep:
        prevState.currStep === STEP_COUNT
          ? prevState.currStep
          : prevState.currStep + 1
    }))
  const previousStep = () =>
    setTcrState(prevState => ({
      ...prevState,
      currStep:
        prevState.currStep === 1 ? prevState.currStep : prevState.currStep - 1
    }))
  const resetStepper = () =>
    setTcrState(prevState => ({ ...prevState, currStep: 1 }))
  const resetTcrState = () =>
    setTcrState(prevState => ({
      ...JSON.parse(JSON.stringify(initialWizardState)),
      transactions: prevState.transactions
    }))
  const setTxState = tx =>
    setTcrState(prevState => ({
      ...prevState,
      transactions: {
        ...prevState.transactions,
        [tx.txHash]: tx
      }
    }))

  useEffect(
    () =>
      window.localStorage.setItem(
        key,
        JSON.stringify({ ...debouncedTcrState })
      ),
    [debouncedTcrState, key]
  )

  return {
    tcrState,
    setTcrState,
    resetTcrState,
    nextStep,
    previousStep,
    resetStepper,
    STEP_COUNT,
    setTxState
  }
}

export default () => {
  const cachedFactory = useCachedFactory(version)
  const {
    tcrState: { currStep, transactions },
    nextStep,
    previousStep
  } = cachedFactory

  return (
    <StyledLayoutContent>
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
      <StyledContainer>
        <Card title="Previous Deployments" hoverable>
          {Object.keys(transactions).length > 0 ? (
            Object.keys(transactions).map((txHash, i) => (
              <div key={i}>
                <Link to={`/tcr/${transactions[txHash].contractAddress}`}>
                  {transactions[txHash].contractAddress}
                </Link>
              </div>
            ))
          ) : (
            <Empty description={false} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>
      </StyledContainer>
    </StyledLayoutContent>
  )
}