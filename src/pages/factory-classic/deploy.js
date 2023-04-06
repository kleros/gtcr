import { Card, Button, Alert, Icon, Steps } from 'antd'
import { Link } from 'react-router-dom'
import PropTypes from 'prop-types'
import React, { useContext, useState } from 'react'
import { ethers } from 'ethers'
import Archon from '@kleros/archon'
import { parseEther, getContractAddress, bigNumberify } from 'ethers/utils'
import styled from 'styled-components/macro'
import { useWeb3Context } from 'web3-react'
import { abi as _GTCRFactory } from '@kleros/tcr/build/contracts/GTCRFactory.json'
import ipfsPublish from 'utils/ipfs-publish'
import { WalletContext } from 'contexts/wallet-context'
import { ZERO_ADDRESS, isVowel } from 'utils/string'
import useWindowDimensions from 'hooks/window-dimensions'
import SubmitModal from '../item-details/modals/submit'
import useTcrView from 'hooks/tcr-view'
import {
  defaultEvidenceDisplayUriClassic,
  defaultTcrAddresses,
  factoryAddresses,
  txBatcherAddresses
} from 'config/tcr-addresses'

const _txBatcher = [
  {
    constant: false,
    inputs: [
      { name: 'targets', type: 'address[]' },
      { name: 'values', type: 'uint256[]' },
      { name: 'datas', type: 'bytes[]' }
    ],
    name: 'batchSend',
    outputs: [],
    payable: true,
    stateMutability: 'payable',
    type: 'function'
  }
]

const StyledDiv = styled.div`
  word-break: break-all;
`

const StyledSteps = styled(Steps)`
  margin: 24px 0;
`

const StyledAlert = styled(Alert)`
  margin-bottom: 24px;
`

const StyledCard = styled(Card)`
  & > .ant-card-body {
    display: flex;
    flex-direction: column;
  }
`

const StyledActions = styled.div`
  display: flex;
  justify-content: flex-end;
`

const StyledButton = styled(Button)`
  margin-left: 12px;
  text-transform: capitalize;
`

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
  ].map(metaEvidence => enc.encode(JSON.stringify(metaEvidence)))
  const relMetaEvidenceFiles = [
    relRegistrationMetaEvidence,
    relClearingMetaEvidence
  ].map(relMetaEvidence => enc.encode(JSON.stringify(relMetaEvidence)))

  /* eslint-disable prettier/prettier unicorn */
  const files = [...metaEvidenceFiles, ...relMetaEvidenceFiles].map(file => ({
    data: file,
    multihash: Archon.utils.multihashFile(file, 0x1b)
  }))
  /* eslint-enable prettier/prettier unicorn */

  const ipfsMetaEvidenceObjects = (
    await Promise.all(files.map(file => ipfsPublish(file.multihash, file.data)))
  ).map(
    ipfsMetaEvidenceObject =>
      `/ipfs/${ipfsMetaEvidenceObject[1].hash + ipfsMetaEvidenceObject[0].path}`
  )

  return {
    registrationMetaEvidencePath: ipfsMetaEvidenceObjects[0],
    clearingMetaEvidencePath: ipfsMetaEvidenceObjects[1],
    relRegistrationMetaEvidencePath: ipfsMetaEvidenceObjects[2],
    relClearingMetaEvidencePath: ipfsMetaEvidenceObjects[3]
  }
}

const Deploy = ({ setTxState, tcrState, setTcrState }) => {
  const { networkId, library } = useWeb3Context()
  const { pushWeb3Action } = useContext(WalletContext)
  const { width } = useWindowDimensions()
  const [currentStep, setCurrentStep] = useState(0)
  const [txSubmitted, setTxSubmitted] = useState()
  const [deployedTCRAddress, setDeployedTCRAddress] = useState()
  const [submissionFormOpen, setSubmissionFormOpen] = useState()
  const factoryAddress = factoryAddresses[networkId]
  const defaultTCRAddress = defaultTcrAddresses[networkId]
  const batcherAddress = txBatcherAddresses[networkId]
  const evidenceDisplayInterfaceURI =
    defaultEvidenceDisplayUriClassic[networkId]

  const {
    submissionDeposit,
    metaEvidence,
    challengePeriodDuration
  } = useTcrView(defaultTCRAddress)

  const onDeploy = () => {
    pushWeb3Action(async (_, signer) => {
      // We link the related badges TCR to its parent together by the parents address.
      // the nonce is txCount + 1 because the related badges TCR is deployed first.
      const txCount = await library.getTransactionCount(factoryAddress)
      const parentTCRAddress = getContractAddress({
        from: factoryAddress,
        nonce: txCount + 1
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

      // To deploy two contracts at once, we use a transaction batcher.
      // See github.com/kleros/action-callback-bots for an example.
      const factory = new ethers.Contract(factoryAddress, _GTCRFactory, signer)
      const txBatcher = new ethers.Contract(batcherAddress, _txBatcher, signer)

      const relTCRArgs = [
        tcrState.relArbitratorAddress,
        tcrState.relArbitratorExtraData, // Arbitrator extra data.
        ZERO_ADDRESS,
        relRegistrationMetaEvidencePath,
        relClearingMetaEvidencePath,
        tcrState.relGovernorAddress,
        parseEther(
          tcrState.relTcrDisabled
            ? '10000000000000' // Use a very large deposit to make submissions impossible.
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
        ] // Shared, winner and loser stake multipliers in basis points.
      ]
      const relData = factory.interface.functions.deploy.encode(relTCRArgs)
      const relTCRAddress = getContractAddress({
        from: factoryAddress,
        nonce: txCount
      })

      const TCRArgs = [
        tcrState.arbitratorAddress,
        tcrState.arbitratorExtraData, // Arbitrator extra data.
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
        ] // Shared, winner and loser stake multipliers in basis points.
      ]
      const tcrData = factory.interface.functions.deploy.encode(TCRArgs)

      const targets = [factory.address, factory.address]
      const values = [bigNumberify(0), bigNumberify(0)]
      const datas = [relData, tcrData]

      const deployTx = await txBatcher.batchSend(targets, values, datas, {
        gasLimit: 8000000
      })
      setCurrentStep(1)
      setTxState({ txHash: deployTx.hash, status: 'pending', networkId })
      setTxSubmitted(deployTx.hash)
      return {
        tx: deployTx,
        actionMessage: 'Deploying List',
        deployTCR: true,
        onTxMined: async ({ contractAddress }) => {
          setTxState({
            txHash: deployTx.hash,
            status: 'mined',
            contractAddress
          })
          setTcrState(prevState => ({
            ...prevState,
            finished: true
          }))
          setCurrentStep(2)
          setDeployedTCRAddress(contractAddress)
        }
      }
    })
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
                    to={`/tcr/${networkId}/${tcrState.transactions[txSubmitted].contractAddress}`}
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
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end'
            }}
          >
            <StyledActions>
              <StyledButton
                type="primary"
                onClick={onDeploy}
                icon={
                  currentStep === 0 || currentStep === 2 ? 'fire' : 'loading'
                }
              >
                Deploy!
              </StyledButton>
            </StyledActions>
          </span>
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

Deploy.propTypes = {
  setTxState: PropTypes.func.isRequired,
  setTcrState: PropTypes.func.isRequired,
  tcrState: PropTypes.shape({
    transactions: PropTypes.objectOf(
      PropTypes.shape({
        status: PropTypes.oneOf(['pending', 'mined', null]),
        contractAddress: PropTypes.string
      })
    ).isRequired,
    arbitratorAddress: PropTypes.string.isRequired,
    arbitratorExtraData: PropTypes.string.isRequired,
    governorAddress: PropTypes.string.isRequired,
    submissionChallengeBaseDeposit: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string
    ]).isRequired,
    removalChallengeBaseDeposit: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string
    ]).isRequired,
    submissionBaseDeposit: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string
    ]).isRequired,
    removalBaseDeposit: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string
    ]).isRequired,
    challengePeriodDuration: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string
    ]).isRequired,
    sharedStakeMultiplier: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string
    ]).isRequired,
    winnerStakeMultiplier: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string
    ]).isRequired,
    loserStakeMultiplier: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string
    ]).isRequired,
    relArbitratorAddress: PropTypes.string.isRequired,
    relArbitratorExtraData: PropTypes.string.isRequired,
    relGovernorAddress: PropTypes.string.isRequired,
    relSubmissionChallengeBaseDeposit: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string
    ]).isRequired,
    relRemovalChallengeBaseDeposit: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string
    ]).isRequired,
    relSubmissionBaseDeposit: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string
    ]).isRequired,
    relRemovalBaseDeposit: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string
    ]).isRequired,
    relChallengePeriodDuration: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string
    ]).isRequired,
    relSharedStakeMultiplier: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string
    ]).isRequired,
    relWinnerStakeMultiplier: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string
    ]).isRequired,
    relLoserStakeMultiplier: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string
    ]).isRequired,
    relTcrDisabled: PropTypes.bool
  }).isRequired
}

export default Deploy
