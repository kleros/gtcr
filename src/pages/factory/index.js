import { Steps, Button, Icon, Card, Empty, Typography } from 'antd'
import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import { useDebounce } from 'use-debounce'
import styled from 'styled-components/macro'
import TCRParams from './tcr-params'
import ItemParams from './item-params'
import Deploy from './deploy'
import StyledLayoutContent from '../layout-content'
import { version } from '../../../package.json'
import { useWeb3Context } from 'web3-react'
import useNetworkEnvVariable from '../../hooks/network-env'
import itemTypes from '../../utils/item-types'
import RelTCRParams from './rel-tcr-params'
import WarningBanner from '../../components/beta-warning'

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

const StyledBanner = styled.div`
  padding: 24px 9.375vw;
  background: linear-gradient(270deg, #f2e3ff 22.92%, #ffffff 76.25%);
  box-shadow: 0px 3px 24px #bc9cff;
  color: #4d00b4;
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
  const defaultArbitrator = useNetworkEnvVariable(
    'REACT_APP_DEFAULT_ARBITRATOR',
    networkId
  )
  const defaultGovernor = useNetworkEnvVariable(
    'REACT_APP_DEFAULT_GOVERNOR',
    networkId
  )
  const arbitratorExtraData = useNetworkEnvVariable(
    'REACT_APP_DEFAULT_ARBITRATOR_EXTRA_DATA',
    networkId
  )
  const key = `tcrState@${version}`
  const initialWizardState = {
    tcrTitle: '',
    tcrDescription: '',
    submissionBaseDeposit: 0.02,
    removalBaseDeposit: 0.03,
    submissionChallengeBaseDeposit: 0.015,
    removalChallengeBaseDeposit: 0.025,
    arbitratorAddress: defaultArbitrator || '',
    governorAddress: defaultGovernor || '',
    challengePeriodDuration: 3,
    itemName: 'Item',
    requireRemovalEvidence: true,
    tcrPrimaryDocument: '',
    tcrLogo: '',
    arbitratorExtraData: arbitratorExtraData,
    sharedStakeMultiplier: 1000,
    winnerStakeMultiplier: 1000,
    looserStakeMultiplier: 2000,
    isTCRofTCRs: false,
    relSubmissionBaseDeposit: 0.02,
    relRemovalBaseDeposit: 0.03,
    relSubmissionChallengeBaseDeposit: 0.015,
    relRemovalChallengeBaseDeposit: 0.025,
    relArbitratorAddress: defaultArbitrator || '',
    relArbitratorExtraData: arbitratorExtraData,
    relGovernorAddress: defaultGovernor || '',
    relChallengePeriodDuration: 3,
    relItemName: 'TCR',
    relRequireRemovalEvidence: true,
    relTcrPrimaryDocument: '',
    relSharedStakeMultiplier: 1000,
    relWinnerStakeMultiplier: 1000,
    relLooserStakeMultiplier: 2000,
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
        description: 'The related TCR address',
        type: itemTypes.GTCR_ADDRESS,
        isIdentifier: true
      },
      {
        label: 'Match File URI',
        description:
          'The URI to the JSON file for matching columns for each TCR.',
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
  if (cache) cache = JSON.parse(cache)
  else cache = JSON.parse(JSON.stringify(initialState)) // Deep copy.

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
    setTxState
  }
}

export default () => {
  const cachedFactory = useCachedFactory(version)
  const {
    tcrState: { currStep, transactions },
    nextStep,
    previousStep,
    STEP_COUNT
  } = cachedFactory

  return (
    <>
      <WarningBanner />
      <StyledBanner>
        <Typography.Title ellipsis style={{ marginBottom: '0' }}>
          TCR Factory
        </Typography.Title>
      </StyledBanner>
      <StyledLayoutContent>
        <Steps current={currStep - 1}>
          <Step title="TCR Parameters" />
          <Step title="Item Parameters" />
          <Step title="Related TCR Parameters" />
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
              disabled={currStep === STEP_COUNT}
            >
              Next
              <Icon type="right" />
            </Button>
          </ButtonGroup>
        </StyledStepper>
        <StyledContainer>
          <Card title="Previous Deployments">
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
    </>
  )
}
