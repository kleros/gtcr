import React, { useState } from 'react'
import { Button, Steps } from 'components/ui'
import Icon from 'components/ui/Icon'
import { Link } from 'react-router-dom'
import {
  parseEther,
  encodeFunctionData,
  getContractAddress,
  keccak256,
  decodeEventLog
} from 'viem'
import { abi as _GTCRFactory } from '@kleros/tcr/build/contracts/GTCRFactory.json'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import ipfsPublish from 'utils/ipfs-publish'
import { getIPFSPath } from 'utils/get-ipfs-path'
import { ZERO_ADDRESS, isVowel } from 'utils/string'
import { wrapWithToast } from 'utils/wrapWithToast'
import { wagmiConfig } from 'config/wagmi'
import useWindowDimensions from 'hooks/window-dimensions'
import EnsureAuth from 'components/ensure-auth'
import SubmitModal from '../item-details/modals/submit'
import useTcrView from 'hooks/tcr-view'
import {
  defaultEvidenceDisplayUriClassic,
  defaultTcrAddresses,
  factoryAddresses,
  txBatcherAddresses
} from 'config/tcr-addresses'
import {
  StyledActions,
  StyledDiv,
  StyledSteps,
  StyledAlert,
  StyledCard,
  StyledSpan,
  StyledButton,
  _txBatcher
} from 'pages/factory/deploy'

const getTcrMetaEvidence = async (
  tcrState,
  parentTCRAddress,
  evidenceDisplayInterfaceURI
) => {
  const {
    tcrTitle,
    tcrDescription,
    columns,
    itemName,
    itemNamePlural,
    tcrPrimaryDocument,
    tcrLogo,
    relColumns,
    relItemName,
    relItemNamePlural,
    relTcrPrimaryDocument,
    isTCRofTCRs,
    relTcrDisabled
  } = tcrState
  const metadata = {
    tcrTitle,
    tcrDescription,
    columns,
    itemName: itemName.toLowerCase(),
    itemNamePlural: itemNamePlural.toLowerCase(),
    logoURI: tcrLogo,
    requireRemovalEvidence: true,
    isTCRofTCRs,
    relTcrDisabled
  }

  const relTcrTitle = `${tcrTitle} enabled badges`
  const relMetadata = {
    tcrTitle: relTcrTitle,
    tcrDescription: `A List of lists related to ${tcrTitle}`,
    columns: relColumns,
    itemName: relItemName.toLowerCase(),
    itemNamePlural: relItemNamePlural.toLowerCase(),
    isConnectedTCR: true,
    requireRemovalEvidence: true,
    isTCRofTCRs: true,
    parentTCRAddress,
    relTcrDisabled: true
  }

  const metaEvidence = {
    category: 'Curated Lists',
    question: `Does the ${(itemName && itemName.toLowerCase()) ||
      'item'} comply with the required criteria?`,
    fileURI: tcrPrimaryDocument,
    evidenceDisplayInterfaceURI,
    metadata
  }

  const relMetaEvidence = {
    ...metaEvidence,
    question: `Does the ${relItemName} comply with the required criteria?`,
    fileURI: relTcrDisabled
      ? process.env.REACT_APP_REJECT_ALL_POLICY_URI
      : relTcrPrimaryDocument,
    metadata: relMetadata
  }

  const registrationMetaEvidence = {
    title: `Add ${
      itemName
        ? isVowel(itemName[0])
          ? `an ${itemName.toLowerCase()}`
          : `a ${itemName.toLowerCase()}`
        : 'an item'
    } to ${tcrTitle}`,
    description: `Someone requested to add ${
      itemName
        ? isVowel(itemName[0])
          ? `an ${itemName.toLowerCase()}`
          : `a ${itemName.toLowerCase()}`
        : 'an item'
    } to ${tcrTitle}`,
    rulingOptions: {
      titles: ['Yes, Add It', "No, Don't Add It"],
      descriptions: [
        `Select this if you think the ${(itemName && itemName.toLowerCase()) ||
          'item'} complies with the required criteria and should be added.`,
        `Select this if you think the ${(itemName && itemName.toLowerCase()) ||
          'item'} does not comply with the required criteria and should not be added.`
      ]
    },
    ...metaEvidence
  }
  const clearingMetaEvidence = {
    title: `Remove ${
      itemName
        ? isVowel(itemName[0])
          ? `an ${itemName.toLowerCase()}`
          : `a ${itemName.toLowerCase()}`
        : 'an item'
    } from ${tcrTitle}`,
    description: `Someone requested to remove ${
      itemName
        ? isVowel(itemName[0])
          ? `an ${itemName.toLowerCase()}`
          : `a ${itemName.toLowerCase()}`
        : 'an item'
    } from ${tcrTitle}`,
    rulingOptions: {
      titles: ['Yes, Remove It', "No, Don't Remove It"],
      descriptions: [
        `Select this if you think the ${(itemName && itemName.toLowerCase()) ||
          'item'} does not comply with the required criteria and should be removed.`,
        `Select this if you think the ${(itemName && itemName.toLowerCase()) ||
          'item'} complies with the required criteria and should not be removed.`
      ]
    },
    ...metaEvidence
  }

  const relRegistrationMetaEvidence = {
    title: `Add a ${relItemName} to ${relTcrTitle}`,
    description: `Someone requested to add a ${relItemName} to ${relTcrTitle}.`,
    rulingOptions: {
      titles: ['Yes, Add It', "No, Don't Add It"],
      descriptions: [
        `Select this if you think the ${relItemName} complies with the required criteria and should be added.`,
        `Select this if you think the ${relItemName} does not comply with the required criteria and should not be added.`
      ]
    },
    ...relMetaEvidence
  }
  const relClearingMetaEvidence = {
    title: `Remove a ${relItemName} from ${relTcrTitle}`,
    description: `Someone requested to remove a ${relItemName} from ${relTcrTitle}.`,
    rulingOptions: {
      titles: ['Yes, Remove It', "No, Don't Remove It"],
      descriptions: [
        `Select this if you think the ${relItemName} does not comply with the required criteria and should be removed.`,
        `Select this if you think the ${relItemName} complies with the required criteria and should not be removed.`
      ]
    },
    ...relMetaEvidence
  }

  const enc = new TextEncoder()
  const metaEvidenceFiles = [
    registrationMetaEvidence,
    clearingMetaEvidence
  ].map(me => enc.encode(JSON.stringify(me)))
  const relMetaEvidenceFiles = [
    relRegistrationMetaEvidence,
    relClearingMetaEvidence
  ].map(rme => enc.encode(JSON.stringify(rme)))

  const files = [...metaEvidenceFiles, ...relMetaEvidenceFiles].map(file => ({
    data: file,
    multihash: keccak256(file)
  }))

  const ipfsMetaEvidenceObjects = (
    await Promise.all(files.map(file => ipfsPublish(file.multihash, file.data)))
  ).map(ipfsMetaEvidenceObject => getIPFSPath(ipfsMetaEvidenceObject))

  return {
    registrationMetaEvidencePath: ipfsMetaEvidenceObjects[0],
    clearingMetaEvidencePath: ipfsMetaEvidenceObjects[1],
    relRegistrationMetaEvidencePath: ipfsMetaEvidenceObjects[2],
    relClearingMetaEvidencePath: ipfsMetaEvidenceObjects[3]
  }
}

interface DeployProps {
  setTxState: (tx: any) => void
  tcrState: Record<string, any>
  setTcrState: (fn: any) => void
  [key: string]: any
}

const Deploy = ({ setTxState, tcrState, setTcrState }: DeployProps) => {
  const chainId = useChainId()
  const { address: account } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { width } = useWindowDimensions()
  const [currentStep, setCurrentStep] = useState(0)
  const [txSubmitted, setTxSubmitted] = useState<any>()
  const [deployedTCRAddress, setDeployedTCRAddress] = useState<any>()
  const [submissionFormOpen, setSubmissionFormOpen] = useState<any>()
  const factoryAddress = factoryAddresses[chainId]
  const defaultTCRAddress = defaultTcrAddresses[chainId]
  const batcherAddress = txBatcherAddresses[chainId]
  const evidenceDisplayInterfaceURI =
    defaultEvidenceDisplayUriClassic[chainId]

  const {
    submissionDeposit,
    metaEvidence,
    challengePeriodDuration
  } = useTcrView(defaultTCRAddress)

  const onDeploy = async () => {
    try {
      const txCount = await publicClient.getTransactionCount({
        address: factoryAddress
      })
      const parentTCRAddress = getContractAddress({
        from: factoryAddress,
        nonce: BigInt(txCount + 1)
      })

      const {
        registrationMetaEvidencePath,
        clearingMetaEvidencePath,
        relRegistrationMetaEvidencePath,
        relClearingMetaEvidencePath
      } = await getTcrMetaEvidence(
        tcrState,
        parentTCRAddress,
        evidenceDisplayInterfaceURI
      )

      const relTCRArgs = [
        tcrState.relArbitratorAddress,
        tcrState.relArbitratorExtraData,
        ZERO_ADDRESS,
        relRegistrationMetaEvidencePath,
        relClearingMetaEvidencePath,
        tcrState.relGovernorAddress,
        parseEther(
          tcrState.relTcrDisabled
            ? '10000000000000'
            : tcrState.relSubmissionBaseDeposit.toString()
        ),
        parseEther(tcrState.relRemovalBaseDeposit.toString()),
        parseEther(tcrState.relSubmissionChallengeBaseDeposit.toString()),
        parseEther(tcrState.relRemovalChallengeBaseDeposit.toString()),
        Number(tcrState.relChallengePeriodDuration) * 60 * 60,
        [
          Math.ceil(Number(tcrState.relSharedStakeMultiplier)) * 100,
          Math.ceil(Number(tcrState.relWinnerStakeMultiplier)) * 100,
          Math.ceil(Number(tcrState.relLoserStakeMultiplier)) * 100
        ]
      ]
      const relData = encodeFunctionData({
        abi: _GTCRFactory,
        functionName: 'deploy',
        args: relTCRArgs
      })
      const relTCRAddress = getContractAddress({
        from: factoryAddress,
        nonce: BigInt(txCount)
      })

      const TCRArgs = [
        tcrState.arbitratorAddress,
        tcrState.arbitratorExtraData,
        relTCRAddress,
        registrationMetaEvidencePath,
        clearingMetaEvidencePath,
        tcrState.governorAddress,
        parseEther(tcrState.submissionBaseDeposit.toString()),
        parseEther(tcrState.removalBaseDeposit.toString()),
        parseEther(tcrState.submissionChallengeBaseDeposit.toString()),
        parseEther(tcrState.removalChallengeBaseDeposit.toString()),
        Number(tcrState.challengePeriodDuration) * 60 * 60,
        [
          Math.ceil(Number(tcrState.sharedStakeMultiplier)) * 100,
          Math.ceil(Number(tcrState.winnerStakeMultiplier)) * 100,
          Math.ceil(Number(tcrState.loserStakeMultiplier)) * 100
        ]
      ]
      const tcrData = encodeFunctionData({
        abi: _GTCRFactory,
        functionName: 'deploy',
        args: TCRArgs
      })

      const targets = [factoryAddress, factoryAddress]
      const values = [0n, 0n]
      const datas = [relData, tcrData]

      const { request } = await simulateContract(wagmiConfig, {
        address: batcherAddress,
        abi: _txBatcher,
        functionName: 'batchSend',
        args: [targets, values, datas],
        gas: 8000000n,
        account
      })

      setCurrentStep(1)

      const result = await wrapWithToast(
        () => walletClient.writeContract(request),
        publicClient
      )

      if (result.status) {
        const txHash = result.result.transactionHash
        setTxSubmitted(txHash)

        let contractAddress = parentTCRAddress
        try {
          const newGTCRLogs = result.result.logs
            .map(log => {
              try {
                return decodeEventLog({
                  abi: _GTCRFactory,
                  data: log.data,
                  topics: log.topics
                })
              } catch {
                return null
              }
            })
            .filter(parsed => parsed && parsed.eventName === 'NewGTCR')
          if (newGTCRLogs.length >= 2) {
            contractAddress = newGTCRLogs[1].args._address
          } else if (newGTCRLogs.length === 1) {
            contractAddress = newGTCRLogs[0].args._address
          }
        } catch (err) {
          console.error('Error parsing deploy logs:', err)
        }

        setTxState({ txHash, status: 'mined', contractAddress })
        setTcrState(prevState => ({
          ...prevState,
          finished: true
        }))
        setCurrentStep(2)
        setDeployedTCRAddress(contractAddress)
      }
    } catch (err) {
      console.error('Error deploying list:', err)
    }
  }

  return (
    <>
      <StyledCard title="Deploy the list">
        {currentStep === 0 && (
          <StyledAlert
            showIcon
            type="info"
            closable
            message="On your marks..."
            description="When you are ready, click deploy. You may also want to add it to The Registry so people can find it. If so, don't close the window and wait for the transaction to mine."
          />
        )}
        {currentStep === 1 && (
          <StyledAlert
            showIcon
            type="info"
            closable
            message="Deploy in progress. Please do not close the window until the process is finished."
          />
        )}
        <StyledSteps
          current={currentStep}
          direction={width < 750 ? 'vertical' : 'horizontal'}
        >
          <Steps.Step
            title="Start"
            description={currentStep > 0 && 'Finished'}
            icon={<Icon type="fire" />}
          />
          <Steps.Step
            title="Deploying list"
            description={currentStep > 1 && 'Finished'}
            icon={
              currentStep < 1 ? (
                <Icon type="star" />
              ) : currentStep === 1 ? (
                <Icon type="loading" />
              ) : (
                <Icon type="check" />
              )
            }
          />
          <Steps.Step title="Finished!" icon={<Icon type="flag" />} />
        </StyledSteps>
        {currentStep === 2 && (
          <StyledAlert
            type="success"
            showIcon
            message="Success!"
            description={
              <>
                <StyledDiv>
                  Your list was created at the following address:{' '}
                  <Link
                    to={`/tcr/${chainId}/${tcrState.transactions[txSubmitted].contractAddress}`}
                  >
                    {tcrState.transactions[txSubmitted].contractAddress}
                  </Link>
                  .
                </StyledDiv>
                <StyledDiv>
                  You may want to bookmark its address or, if it adheres to the
                  listing criteria,{' '}
                  <Button
                    type="link"
                    onClick={setSubmissionFormOpen}
                    style={{ padding: 0 }}
                  >
                    submit it to{' '}
                    {(metaEvidence && metaEvidence.metadata.tcrTitle) ||
                      'Curated Lists'}{' '}
                    so other users can find it.
                  </Button>
                </StyledDiv>
              </>
            }
          />
        )}
        {currentStep === 0 && (
          <StyledSpan>
            <StyledActions>
              <EnsureAuth>
                <StyledButton
                  type="primary"
                  onClick={onDeploy}
                  icon={
                    currentStep === 0 || currentStep === 2 ? 'fire' : 'loading'
                  }
                >
                  Deploy!
                </StyledButton>
              </EnsureAuth>
            </StyledActions>
          </StyledSpan>
        )}
      </StyledCard>
      {metaEvidence && (
        <SubmitModal
          initialValues={[deployedTCRAddress]}
          visible={!!submissionFormOpen}
          onCancel={() => setSubmissionFormOpen(false)}
          submissionDeposit={submissionDeposit}
          tcrAddress={defaultTCRAddress}
          metaEvidence={metaEvidence}
          challengePeriodDuration={challengePeriodDuration}
        />
      )}
    </>
  )
}

export default Deploy
