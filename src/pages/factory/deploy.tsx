import { Card, Button, Alert, Steps } from 'components/ui'
import Icon from 'components/ui/Icon'
import { Link } from 'react-router-dom'
import React, { useState } from 'react'
import {
  parseEther,
  encodeFunctionData,
  getContractAddress,
  decodeEventLog,
} from 'viem'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import styled from 'styled-components'
import _GTCRFactory from 'assets/abis/LightGTCRFactory.json'
import ipfsPublish from 'utils/ipfs-publish'
import { getIPFSPath } from 'utils/get-ipfs-path'
import { ZERO_ADDRESS, isVowel } from 'utils/string'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { wagmiConfig } from 'config/wagmi'
import useWindowDimensions from 'hooks/window-dimensions'
import EnsureAuth from 'components/ensure-auth'
import SubmitModal from '../item-details/modals/submit'
import useTcrView from 'hooks/tcr-view'
import {
  defaultEvidenceDisplayUri,
  defaultTcrAddresses,
  lgtcrFactoryAddresses,
  txBatcherAddresses,
} from 'config/tcr-addresses'

export const StyledDiv = styled.div`
  word-break: break-all;
`

export const StyledSteps = styled(Steps)`
  margin: 24px 0;
`

export const StyledAlert = styled(Alert)`
  margin-bottom: 24px;
`

export const StyledCard = styled(Card)`
  & > .ui-card-body {
    display: flex;
    flex-direction: column;
  }
`

export const StyledActions = styled.div`
  display: flex;
  justify-content: flex-end;
`

export const StyledButton = styled(Button)`
  margin-left: 12px;
  text-transform: capitalize;
`

export const StyledSpan = styled.span`
  display: flex;
  align-items: center;
  justify-content: flex-end;
`

export const _txBatcher = [
  {
    constant: false,
    inputs: [
      { name: 'targets', type: 'address[]' },
      { name: 'values', type: 'uint256[]' },
      { name: 'datas', type: 'bytes[]' },
    ],
    name: 'batchSend',
    outputs: [],
    payable: true,
    stateMutability: 'payable',
    type: 'function',
  },
]

const getTcrMetaEvidence = async (
  tcrState,
  parentTCRAddress,
  evidenceDisplayInterfaceURI,
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
    relTcrDisabled,
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
    relTcrDisabled,
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
    relTcrDisabled: true,
  }

  const commonMetaEvidenceProps = {
    category: 'Curated Lists',
    question: `Does the ${
      (itemName && itemName.toLowerCase()) || 'item'
    } comply with the required criteria?`,
    fileURI: tcrPrimaryDocument,
    evidenceDisplayInterfaceURI,
    metadata,
  }

  const commonRelMetaEvidenceProps = {
    ...commonMetaEvidenceProps,
    question: `Does the ${relItemName} comply with the required criteria?`,
    fileURI: relTcrDisabled
      ? process.env.REACT_APP_REJECT_ALL_POLICY_URI
      : relTcrPrimaryDocument,
    metadata: relMetadata,
    _v: '1.0.0',
    evidenceDisplayInterfaceRequiredParams: [
      'disputeID',
      'arbitrableContractAddress',
      'arbitratorContractAddress',
      'arbitrableChainID',
      'arbitrableJsonRpcUrl',
    ],
  }

  const registrationMetaEvidence = {
    name: 'reg-meta-evidence.json',
    data: {
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
          `Select this if you think the ${
            (itemName && itemName.toLowerCase()) || 'item'
          } complies with the required criteria and should be added.`,
          `Select this if you think the ${
            (itemName && itemName.toLowerCase()) || 'item'
          } does not comply with the required criteria and should not be added.`,
        ],
      },
      ...commonMetaEvidenceProps,
    },
  }
  const clearingMetaEvidence = {
    name: 'clr-meta-evidence.json',
    data: {
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
          `Select this if you think the ${
            (itemName && itemName.toLowerCase()) || 'item'
          } does not comply with the required criteria and should be removed.`,
          `Select this if you think the ${
            (itemName && itemName.toLowerCase()) || 'item'
          } complies with the required criteria and should not be removed.`,
        ],
      },
      ...commonMetaEvidenceProps,
    },
  }

  const relRegistrationMetaEvidence = {
    name: 'rel-reg-meta-evidence.json',
    data: {
      title: `Add a ${relItemName} to ${relTcrTitle}`,
      description: `Someone requested to add a ${relItemName} to ${relTcrTitle}.`,
      rulingOptions: {
        titles: ['Yes, Add It', "No, Don't Add It"],
        descriptions: [
          `Select this if you think the ${relItemName} complies with the required criteria and should be added.`,
          `Select this if you think the ${relItemName} does not comply with the required criteria and should not be added.`,
        ],
      },
      ...commonRelMetaEvidenceProps,
    },
  }
  const relClearingMetaEvidence = {
    name: 'rel-clr-meta-evidence.json',
    data: {
      title: `Remove a ${relItemName} from ${relTcrTitle}`,
      description: `Someone requested to remove a ${relItemName} from ${relTcrTitle}.`,
      rulingOptions: {
        titles: ['Yes, Remove It', "No, Don't Remove It"],
        descriptions: [
          `Select this if you think the ${relItemName} does not comply with the required criteria and should be removed.`,
          `Select this if you think the ${relItemName} complies with the required criteria and should not be removed.`,
        ],
      },
      ...commonRelMetaEvidenceProps,
    },
  }

  const enc = new TextEncoder()

  const files = [
    registrationMetaEvidence,
    clearingMetaEvidence,
    relRegistrationMetaEvidence,
    relClearingMetaEvidence,
  ].map(({ name, data }) => ({
    name,
    data: enc.encode(JSON.stringify(data)),
  }))

  const ipfsMetaEvidenceObjects = (
    await Promise.all(files.map(({ name, data }) => ipfsPublish(name, data)))
  ).map((ipfsMetaEvidenceObject) => getIPFSPath(ipfsMetaEvidenceObject))

  const [
    registrationMetaEvidencePath,
    clearingMetaEvidencePath,
    relRegistrationMetaEvidencePath,
    relClearingMetaEvidencePath,
  ] = ipfsMetaEvidenceObjects

  return {
    registrationMetaEvidencePath,
    clearingMetaEvidencePath,
    relRegistrationMetaEvidencePath,
    relClearingMetaEvidencePath,
  }
}

interface DeployProps {
  setTxState: (tx: Record<string, unknown>) => void
  tcrState: Record<string, unknown>
  setTcrState: (
    fn: (prev: Record<string, unknown>) => Record<string, unknown>,
  ) => void
  [key: string]: unknown
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
  const factoryAddress = lgtcrFactoryAddresses[chainId]
  const defaultTCRAddress = defaultTcrAddresses[chainId]
  const batcherAddress = txBatcherAddresses[chainId]
  const evidenceDisplayInterfaceURI = defaultEvidenceDisplayUri[chainId]
  const { submissionDeposit, metaEvidence, challengePeriodDuration } =
    useTcrView(defaultTCRAddress)

  const onDeploy = async () => {
    try {
      const txCount = await publicClient.getTransactionCount({
        address: factoryAddress,
      })
      const parentTCRAddress = getContractAddress({
        from: factoryAddress,
        nonce: BigInt(txCount + 1),
      })

      const {
        registrationMetaEvidencePath,
        clearingMetaEvidencePath,
        relRegistrationMetaEvidencePath,
        relClearingMetaEvidencePath,
      } = await getTcrMetaEvidence(
        tcrState,
        parentTCRAddress,
        evidenceDisplayInterfaceURI,
      )

      const relTCRArgs = [
        tcrState.relArbitratorAddress,
        tcrState.relArbitratorExtraData,
        ZERO_ADDRESS,
        relRegistrationMetaEvidencePath,
        relClearingMetaEvidencePath,
        tcrState.relGovernorAddress,
        [
          parseEther(
            tcrState.relTcrDisabled
              ? '10000000000000'
              : tcrState.relSubmissionBaseDeposit.toString(),
          ),
          parseEther(tcrState.relRemovalBaseDeposit.toString()),
          parseEther(tcrState.relSubmissionChallengeBaseDeposit.toString()),
          parseEther(tcrState.relRemovalChallengeBaseDeposit.toString()),
        ],
        Number(tcrState.relChallengePeriodDuration) * 60 * 60,
        [
          Math.ceil(Number(tcrState.relSharedStakeMultiplier)) * 100,
          Math.ceil(Number(tcrState.relWinnerStakeMultiplier)) * 100,
          Math.ceil(Number(tcrState.relLoserStakeMultiplier)) * 100,
        ],
        ZERO_ADDRESS,
      ]

      const relData = encodeFunctionData({
        abi: _GTCRFactory,
        functionName: 'deploy',
        args: relTCRArgs,
      })
      const relTCRAddress = getContractAddress({
        from: factoryAddress,
        nonce: BigInt(txCount),
      })

      const TCRArgs = [
        tcrState.arbitratorAddress,
        tcrState.arbitratorExtraData,
        relTCRAddress,
        registrationMetaEvidencePath,
        clearingMetaEvidencePath,
        tcrState.governorAddress,
        [
          parseEther(tcrState.submissionBaseDeposit.toString()),
          parseEther(tcrState.removalBaseDeposit.toString()),
          parseEther(tcrState.submissionChallengeBaseDeposit.toString()),
          parseEther(tcrState.removalChallengeBaseDeposit.toString()),
        ],
        Number(tcrState.challengePeriodDuration) * 60 * 60,
        [
          Math.ceil(Number(tcrState.sharedStakeMultiplier)) * 100,
          Math.ceil(Number(tcrState.winnerStakeMultiplier)) * 100,
          Math.ceil(Number(tcrState.loserStakeMultiplier)) * 100,
        ],
        ZERO_ADDRESS,
      ]
      const tcrData = encodeFunctionData({
        abi: _GTCRFactory,
        functionName: 'deploy',
        args: TCRArgs,
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
        account,
      })

      setCurrentStep(1)

      const result = await wrapWithToast(
        () => walletClient.writeContract(request),
        publicClient,
      )

      if (result.status) {
        const txHash = result.result.transactionHash
        setTxSubmitted(txHash)

        // Find the deployed contract address from the receipt logs
        let contractAddress = parentTCRAddress // fallback to predicted address
        try {
          const newGTCRLogs = result.result.logs
            .map((log) => {
              try {
                return decodeEventLog({
                  abi: _GTCRFactory,
                  data: log.data,
                  topics: log.topics,
                })
              } catch {
                return null
              }
            })
            .filter((parsed) => parsed && parsed.eventName === 'NewGTCR')
          // The second NewGTCR event is the parent TCR
          if (newGTCRLogs.length >= 2)
            contractAddress = newGTCRLogs[1].args._address
          else if (newGTCRLogs.length === 1)
            contractAddress = newGTCRLogs[0].args._address
        } catch (err) {
          console.error('Error parsing deploy logs:', err)
        }

        setTxState({ txHash, status: 'mined', contractAddress })
        setTcrState((prevState) => ({
          ...prevState,
          finished: true,
        }))
        setCurrentStep(2)
        setDeployedTCRAddress(contractAddress)
      }
    } catch (err) {
      console.error('Error deploying list:', err)
      errorToast(parseWagmiError(err))
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
