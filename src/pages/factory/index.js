import { Steps, Button, Icon, Card, Typography, Modal } from 'antd'
import React, { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { useDebounce } from 'use-debounce'
import styled from 'styled-components/macro'
import { useWeb3Context } from 'web3-react'
import TCRParams from './tcr-params'
import ItemParams from './item-params'
import Deploy from './deploy'
import StyledLayoutContent from '../layout-content'
import { version } from '../../../package.json'
import useNetworkEnvVariable from '../../hooks/network-env'
import itemTypes from '../../utils/item-types'
import RelTCRParams from './rel-tcr-params'
import WarningBanner from '../../components/beta-warning'
import TCRCardContent from '../../components/tcr-card-content'

const { Step } = Steps
const { confirm } = Modal

const StyledButtonGroup = styled(Button.Group)`
  &.ant-btn-group {
    margin-left: 12px;
  }
`

const StyledStepper = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
`
const StyledContainer = styled.div`
  margin: 32px 0;
  word-break: break-word;
`

const StyledBanner = styled.div`
  padding: 24px 9.375vw;
  background: linear-gradient(270deg, #f2e3ff 22.92%, #ffffff 76.25%);
  box-shadow: 0px 3px 24px #bc9cff;
  color: #4d00b4;
`

const StyledGrid = styled.div`
  display: grid;
  margin: 24px 0;
  grid-gap: 20px;
  grid-template-columns: repeat(auto-fill, minmax(225px, 1fr));
`

const formIds = [
  'tcrParamsForm',
  'itemParamsForm',
  'relTCRParamsForm',
  'deployTCRForm'
]
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
          return <RelTCRParams formId={formIds[currStep]} {...props} />
        case 4:
          return <Deploy formId={formIds[currStep]} {...props} />
        default:
          throw new Error('Unknown step')
      }
    })()}
  </>
)

CurrentStep.propTypes = {
  tcrState: PropTypes.shape({ currStep: PropTypes.number }).isRequired
}

const useCachedFactory = version => {
  const { networkId } = useWeb3Context()
  const {
    address: defaultArbitrator,
    label: defaultArbLabel
  } = useNetworkEnvVariable('REACT_APP_DEFAULT_ARBITRATOR', networkId)
  const {
    address: defaultGovernor,
    label: defaultGovernorLabel
  } = useNetworkEnvVariable('REACT_APP_DEFAULT_GOVERNOR', networkId)
  const {
    data: defaultArbitratorExtraData,
    label: defaultArbDataLabel
  } = useNetworkEnvVariable(
    'REACT_APP_DEFAULT_ARBITRATOR_EXTRA_DATA',
    networkId
  )
  const key = `tcrState@${version}`
  const initialWizardState = {
    tcrTitle: '',
    tcrDescription: '',
    submissionBaseDeposit: 0.05,
    removalBaseDeposit: 0.05,
    submissionChallengeBaseDeposit: 0,
    removalChallengeBaseDeposit: 0.05,
    arbitratorAddress: defaultArbitrator || '',
    governorAddress: defaultGovernor || '',
    challengePeriodDuration: 84,
    itemName: 'item',
    itemNamePlural: 'items',
    requireRemovalEvidence: true,
    tcrPrimaryDocument: '',
    tcrLogo: '',
    arbitratorExtraData: defaultArbitratorExtraData,
    sharedStakeMultiplier: 100,
    winnerStakeMultiplier: 100,
    loserStakeMultiplier: 200,
    isTCRofTCRs: false,
    relSubmissionBaseDeposit: 1,
    relRemovalBaseDeposit: 1,
    relSubmissionChallengeBaseDeposit: 0,
    relRemovalChallengeBaseDeposit: 1,
    relArbitratorAddress: defaultArbitrator || '',
    relArbitratorExtraData: defaultArbitratorExtraData,
    relGovernorAddress: defaultGovernor || '',
    relChallengePeriodDuration: 84,
    relItemName: 'list',
    relItemNamePlural: 'lists',
    relRequireRemovalEvidence: true,
    relTcrPrimaryDocument: '',
    relSharedStakeMultiplier: 100,
    relWinnerStakeMultiplier: 100,
    relLoserStakeMultiplier: 200,
    columns: [
      {
        label: '',
        description: '',
        type: itemTypes.ADDRESS,
        isIdentifier: true
      }
    ],
    relColumns: [
      {
        label: 'Address',
        description: 'The Badges list address',
        type: itemTypes.GTCR_ADDRESS,
        isIdentifier: true
      },
      {
        label: 'Match File URI',
        description:
          'The URI to the JSON file for matching columns for each list.',
        type: itemTypes.TEXT
      }
    ],
    currStep: 1
  }
  const initialState = {
    ...initialWizardState,
    transactions: {}
  }
  let cache = window.localStorage.getItem(key)

  const newInitialState = JSON.parse(JSON.stringify(initialState)) // Deep copy.
  if (cache) cache = JSON.parse(cache)
  else cache = newInitialState

  // We check for the finished flag to reset the form
  // if the user finished his previous deployment.
  // We only keep the deployment transactions.
  if (cache.finished)
    cache = { ...newInitialState, transactions: cache.transactions }

  const [tcrState, setTcrState] = useState(cache)
  const [debouncedTcrState] = useDebounce(tcrState, 1000)

  const STEP_COUNT = 4
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
    setTxState,
    defaultArbLabel,
    defaultArbDataLabel,
    defaultGovernorLabel
  }
}

export default () => {
  const cachedFactory = useCachedFactory(version)
  const {
    tcrState: { currStep, transactions },
    nextStep,
    previousStep,
    STEP_COUNT,
    resetTcrState
  } = cachedFactory

  const showConfirmReset = useCallback(() => {
    confirm({
      title: 'Are you sure?',
      content: 'This will clear all fields and reset the wizard to step 1',
      okText: 'Yes, start over',
      onOk: () => {
        resetTcrState()
      }
    })
  }, [resetTcrState])

  return (
    <>
      <WarningBanner />
      <StyledBanner>
        <Typography.Title ellipsis style={{ marginBottom: '0' }}>
          Create a List
        </Typography.Title>
      </StyledBanner>
      <StyledLayoutContent>
        <Steps current={currStep - 1}>
          <Step title="List" />
          <Step title="Item" />
          <Step title="Badges List" />
          <Step title="Deploy" />
        </Steps>
        <StyledContainer>
          <CurrentStep postSubmit={() => nextStep()} {...cachedFactory} />
        </StyledContainer>
        <StyledStepper>
          <Button onClick={showConfirmReset} icon="delete">
            Reset
          </Button>
          <StyledButtonGroup>
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
              disabled={currStep === STEP_COUNT}
            >
              Next
              <Icon type="right" />
            </Button>
          </StyledButtonGroup>
        </StyledStepper>
        {Object.keys(transactions).length > 0 && (
          <StyledContainer>
            <Card title="Previous Deployments">
              <StyledGrid>
                {Object.keys(transactions)
                  .filter(txHash => !transactions[txHash].isConnectedTCR)
                  .map((txHash, i) => (
                    <Card key={i}>
                      <TCRCardContent
                        tcrAddress={transactions[txHash].contractAddress}
                        hideDetailsButton
                      />
                    </Card>
                  ))}
              </StyledGrid>
            </Card>
          </StyledContainer>
        )}
      </StyledLayoutContent>
    </>
  )
}
