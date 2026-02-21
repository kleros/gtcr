import { Steps, Button, Card, Modal } from 'components/ui'
import Icon from 'components/ui/Icon'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useDebounce } from 'use-debounce'
import { useWeb3Context } from 'hooks/use-web3-context'
import { useParams } from 'react-router-dom'
import { ethers } from 'ethers'
import { abi as _GTCRFactory } from '@kleros/tcr/build/contracts/GTCRFactory.json'
import StyledLayoutContent from '../layout-content'
import { version } from '../../../package.json'
import { ItemTypes } from '@kleros/gtcr-encoder'
import TCRCardContent from 'components/tcr-card-content'
import {
  defaultArbitrator as defaultArbitratorAddresses,
  defaultArbitratorExtraData as defaultArbitratorExtraDataObj,
  defaultGovernor as defaultGovernorAddresses,
} from 'config/tcr-addresses'
import {
  CurrentStep,
  StyledGrid,
  formIds,
  StyledStepper,
  StyledContainer,
  StyledBanner,
  StyledButtonGroup,
  StyledTitle,
} from 'pages/factory'

const { Step } = Steps
const { confirm } = Modal

const useCachedFactory = (version: string, networkId: number | undefined) => {
  const { address: defaultArbitrator, label: defaultArbLabel } =
    defaultArbitratorAddresses[networkId] || {}
  const { address: defaultGovernor, label: defaultGovernorLabel } =
    defaultGovernorAddresses[networkId] || {}
  const { data: defaultArbitratorExtraData, label: defaultArbDataLabel } =
    defaultArbitratorExtraDataObj[networkId] || {}

  const key = `classicTcrState@${networkId}@${version}`
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
        type: ItemTypes.ADDRESS,
        isIdentifier: true,
      },
    ],
    relColumns: [
      {
        label: 'Address',
        description: 'The Badges list address',
        type: ItemTypes.GTCR_ADDRESS,
        isIdentifier: true,
      },
      {
        label: 'Match File URI',
        description:
          'The URI to the JSON file for matching columns for each list.',
        type: ItemTypes.TEXT,
      },
    ],
    currStep: 1,
    chainId: networkId,
  }
  const initialState = {
    ...initialWizardState,
    transactions: {},
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
  const [prevNetworkId, setPrevNetworkId] = useState(networkId)

  // Synchronous state reset when chain changes via URL.
  if (networkId && networkId !== prevNetworkId) {
    setPrevNetworkId(networkId)
    setTcrState((prev) => ({
      ...JSON.parse(JSON.stringify(initialWizardState)),
      transactions: prev.transactions,
    }))
  }

  const STEP_COUNT = 4
  const nextStep = () =>
    setTcrState((prevState) => ({
      ...prevState,
      currStep:
        prevState.currStep === STEP_COUNT
          ? prevState.currStep
          : prevState.currStep + 1,
    }))
  const previousStep = () =>
    setTcrState((prevState) => ({
      ...prevState,
      currStep:
        prevState.currStep === 1 ? prevState.currStep : prevState.currStep - 1,
    }))
  const resetStepper = () =>
    setTcrState((prevState) => ({ ...prevState, currStep: 1 }))
  const resetTcrState = () =>
    setTcrState((prevState) => ({
      ...JSON.parse(JSON.stringify(initialWizardState)),
      transactions: prevState.transactions,
    }))
  const setTxState = (tx) =>
    setTcrState((prevState) => ({
      ...prevState,
      transactions: {
        ...prevState.transactions,
        [tx.txHash]: tx,
      },
    }))

  useEffect(
    () =>
      window.localStorage.setItem(
        key,
        JSON.stringify({ ...debouncedTcrState }),
      ),
    [debouncedTcrState, key],
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
    defaultGovernorLabel,
  }
}

const FactoryClassicPage = () => {
  const { chainId: urlChainId } = useParams()
  const factoryChainId = Number(urlChainId)
  const cachedFactory = useCachedFactory(version, factoryChainId)
  const { library, active } = useWeb3Context()
  const [previousDeployments, setPreviousDeployments] = useState([])
  const {
    tcrState: { currStep, transactions },
    nextStep,
    previousStep,
    STEP_COUNT,
    resetTcrState,
  } = cachedFactory

  const factoryInterface = useMemo(
    () => new ethers.utils.Interface(_GTCRFactory),
    [],
  )

  const showConfirmReset = useCallback(() => {
    confirm({
      title: 'Are you sure?',
      content: 'This will clear all fields and reset the wizard to step 1',
      okText: 'Yes, start over',
      onOk: () => {
        resetTcrState()
      },
    })
  }, [resetTcrState])

  // Fetch previously deployed list information
  useEffect(() => {
    ;(async () => {
      if (!transactions || Object.keys(transactions).length === 0) return
      if (!library || !active || !factoryInterface) return

      const deploymentTxHashes = Object.keys(transactions)
        .filter((txHash) => !transactions[txHash].networkId !== factoryChainId)
        .filter((txHash) => !transactions[txHash].isConnectedTCR)

      const txDatas = await Promise.all(
        deploymentTxHashes.map(async (txHash) =>
          library.waitForTransaction(txHash),
        ),
      )
      setPreviousDeployments(
        txDatas.map(
          (txData) => factoryInterface.parseLog(txData.logs[7]).args._address,
        ),
      )
    })()
  }, [active, factoryInterface, library, factoryChainId, transactions])

  return (
    <>
      <StyledBanner>
        <StyledTitle>Create a List (Classic Curate)</StyledTitle>
      </StyledBanner>
      <StyledLayoutContent>
        <Steps current={currStep - 1}>
          <Step title="List" />
          <Step title="Item" />
          <Step title="Badges List" />
          <Step title="Deploy" />
        </Steps>
        <StyledContainer>
          <CurrentStep
            key={factoryChainId}
            postSubmit={() => nextStep()}
            {...cachedFactory}
          />
        </StyledContainer>
        <StyledStepper>
          <Button onClick={showConfirmReset} icon="trash-alt">
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
export default FactoryClassicPage
