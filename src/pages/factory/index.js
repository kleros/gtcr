import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useContext
} from 'react'
import styled from 'styled-components'
import { Steps, Button, Icon, Card, Typography, Modal } from 'antd'
import PropTypes from 'prop-types'
import { useDebounce } from 'use-debounce'
import { useWeb3Context } from 'web3-react'
import { ethers } from 'ethers'
import _GTCRFactory from 'assets/abis/LightGTCRFactory.json'
import TCRParams from './tcr-params'
import ItemParams from './item-params'
import Deploy from './deploy'
import StyledLayoutContent from '../layout-content'
import { version } from '../../../package.json'
import { ItemTypes } from '@kleros/gtcr-encoder'
import RelTCRParams from './rel-tcr-params'
import TCRCardContent from 'components/tcr-card-content'
import { WalletContext } from 'contexts/wallet-context'
import {
  defaultArbitrator as defaultArbitratorAddresses,
  defaultArbitratorExtraData as defaultArbitratorExtraDataObj,
  defaultGovernor as defaultGovernorAddresses
} from 'config/tcr-addresses'

const { Step } = Steps
const { confirm } = Modal

export const StyledButtonGroup = styled(Button.Group)`
  &.ant-btn-group {
    margin-left: 12px;
  }
`

export const StyledStepper = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
`
export const StyledContainer = styled.div`
  margin: 32px 0;
  word-break: break-word;
`

export const StyledBanner = styled.div`
  padding: 24px 9.375vw;
  background: linear-gradient(270deg, #f2e3ff 22.92%, #ffffff 76.25%);
  box-shadow: 0px 3px 24px #bc9cff;
  color: #4d00b4;
`

export const StyledGrid = styled.div`
  display: grid;
  margin: 24px 0;
  grid-gap: 20px;
  grid-template-columns: repeat(auto-fill, minmax(225px, 1fr));
`

export const formIds = [
  'tcrParamsForm',
  'itemParamsForm',
  'relTCRParamsForm',
  'deployTCRForm'
]

export const CurrentStep = props => (
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

const useCachedFactory = (version, networkId) => {
  const { account } = useWeb3Context()
  const { address: defaultArbitrator, label: defaultArbLabel } =
    defaultArbitratorAddresses[networkId] || {}
  const { address: defaultGovernor, label: defaultGovernorLabel } =
    defaultGovernorAddresses[networkId] || {}
  const { data: defaultArbitratorExtraData, label: defaultArbDataLabel } =
    defaultArbitratorExtraDataObj[networkId] || {}

  const key = `tcrState@${networkId}@${version}`
  const initialWizardState = {
    tcrTitle: '',
    tcrDescription: '',
    submissionBaseDeposit: 0.05,
    removalBaseDeposit: 0.05,
    submissionChallengeBaseDeposit: 0,
    removalChallengeBaseDeposit: 0.05,
    arbitratorAddress: defaultArbitrator || '',
    governorAddress: account || defaultGovernor || '',
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
    relGovernorAddress: account || defaultGovernor || '',
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
        type: ItemTypes.ADDRESS,
        isIdentifier: true
      }
    ],
    relColumns: [
      {
        label: 'Address',
        description: 'The Badges list address',
        type: ItemTypes.GTCR_ADDRESS,
        isIdentifier: true
      },
      {
        label: 'Match File URI',
        description:
          'The URI to the JSON file for matching columns for each list.',
        type: ItemTypes.TEXT
      }
    ],
    currStep: 1,
    chainId: networkId
  }
  const initialState = {
    ...initialWizardState,
    transactions: {}
  }
  let cache = window.localStorage.getItem(key)

  const newInitialState = JSON.parse(JSON.stringify(initialState)) // Deep copy.
  if (cache) {
    const parsed = JSON.parse(cache)
    if (parsed.arbitratorAddress && parsed.chainId === networkId) cache = parsed
    else cache = newInitialState
  } else cache = newInitialState

  // We check for the finished flag to reset the form
  // if the user finished his previous deployment.
  // We only keep the deployment transactions.
  if (cache.finished)
    cache = { ...newInitialState, transactions: cache.transactions }

  const [tcrState, setTcrState] = useState(cache)
  const [debouncedTcrState] = useDebounce(tcrState, 1000)
  useEffect(() => {
    if (
      !networkId ||
      !debouncedTcrState ||
      !debouncedTcrState.arbitratorAddress
    )
      return
    window.localStorage.setItem(key, JSON.stringify({ ...debouncedTcrState }))
  }, [debouncedTcrState, key, networkId])

  useEffect(() => {
    if (tcrState && tcrState.arbitratorAddress) return
    if (!networkId) return
    if (!cache.arbitratorAddress) return

    setTcrState(cache)
  }, [cache, networkId, tcrState])

  if (!networkId || !tcrState.arbitratorAddress) return null

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
  const { networkId, library, active, account } = useWeb3Context()
  const cachedFactory = useCachedFactory(version, networkId)
  const { requestWeb3Auth } = useContext(WalletContext)
  const [previousDeployments, setPreviousDeployments] = useState([])
  const { tcrState, nextStep, previousStep, STEP_COUNT, resetTcrState } =
    cachedFactory ?? {}

  const { currStep, transactions } = tcrState ?? {}

  const factoryInterface = useMemo(
    () => new ethers.utils.Interface(_GTCRFactory),
    []
  )

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

  // Fetch previously deployed list information
  useEffect(() => {
    ;(async () => {
      if (!cachedFactory) return
      if (!transactions || Object.keys(transactions).length === 0) return
      if (!library || !active || !factoryInterface) return

      const deploymentTxHashes = Object.keys(transactions)
        .filter(txHash => !transactions[txHash].networkId !== networkId)
        .filter(txHash => !transactions[txHash].isConnectedTCR)

      const txDatas = await Promise.all(
        deploymentTxHashes.map(async txHash =>
          library.waitForTransaction(txHash)
        )
      )
      setPreviousDeployments(
        txDatas.map(
          txData => factoryInterface.parseLog(txData.logs[7]).values._address
        )
      )
    })()
  }, [
    active,
    cachedFactory,
    factoryInterface,
    library,
    networkId,
    transactions
  ])

  if (!account || !cachedFactory || !cachedFactory.tcrState.arbitratorAddress)
    return (
      <>
        <StyledBanner>
          <Typography.Title ellipsis style={{ marginBottom: '0' }}>
            Connect your wallet
          </Typography.Title>
        </StyledBanner>
        <StyledLayoutContent>
          <Typography.Title level={3} ellipsis>
            A wallet is required to deploy a new list
          </Typography.Title>
          <Button onClick={() => requestWeb3Auth()}>Connect Wallet</Button>
        </StyledLayoutContent>
      </>
    )

  return (
    <>
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
        {previousDeployments.length > 0 && (
          <StyledContainer>
            <Card title="Previous Deployments">
              <StyledGrid>
                {previousDeployments.map((contractAddress, i) => (
                  <Card key={i}>
                    <TCRCardContent
                      tcrAddress={contractAddress}
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
