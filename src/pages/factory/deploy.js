import { Card, Button, Alert, Icon, Steps } from 'antd'
import { Link } from 'react-router-dom'
import PropTypes from 'prop-types'
import React, { useContext, useState } from 'react'
import { WalletContext } from '../../bootstrap/wallet-context'
import { ethers } from 'ethers'
import { abi as _GTCRFactory } from '@kleros/tcr/build/contracts/GTCRFactory.json'
import styled from 'styled-components/macro'
import ipfsPublish from '../../utils/ipfs-publish'
import Archon from '@kleros/archon'
import { parseEther } from 'ethers/utils'
import { ZERO_ADDRESS, isVowel } from '../../utils/string'
import { useWeb3Context } from 'web3-react'
import useNetworkEnvVariable from '../../hooks/network-env'
import useWindowDimensions from '../../hooks/window-dimensions'

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
`

const getTcrMetaEvidence = async tcrState => {
  const {
    tcrTitle,
    tcrDescription,
    columns,
    itemName,
    tcrPrimaryDocument,
    tcrLogo,
    requireRemovalEvidence,
    relColumns,
    relItemName,
    relTcrPrimaryDocument,
    relRequireRemovalEvidence,
    isTCRofTCRs
  } = tcrState
  const metadata = {
    tcrTitle,
    tcrDescription,
    columns,
    itemName,
    logoURI: tcrLogo,
    requireRemovalEvidence,
    isTCRofTCRs
  }

  const relTcrTitle = `${tcrTitle} enabled badges`
  const relMetadata = {
    tcrTitle: relTcrTitle,
    tcrDescription: `A List of lists related to ${tcrTitle}`,
    columns: relColumns,
    itemName: relItemName,
    isConnectedTCR: true,
    requireRemovalEvidence: relRequireRemovalEvidence,
    isTCRofTCRs: true
  }

  const metaEvidence = {
    category: 'Curated Lists',
    question: `Does the ${(itemName && itemName.toLowerCase()) ||
      'item'} comply with the required criteria?`,
    fileURI: tcrPrimaryDocument,
    evidenceDisplayInterfaceURI:
      process.env.REACT_APP_DEFAULT_EVIDENCE_DISPLAY_URI,
    evidenceDisplayInterfaceHash: Archon.utils.multihashFile(
      await (
        await fetch(
          `${process.env.REACT_APP_IPFS_GATEWAY}${process.env.REACT_APP_DEFAULT_EVIDENCE_DISPLAY_URI}`
        )
      ).text(),
      0x1B // eslint-disable-line
    ),
    metadata
  }

  const relMetaEvidence = {
    ...metaEvidence,
    question: `Does the ${relItemName} comply with the required criteria?`,
    fileURI: relTcrPrimaryDocument,
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

  /* eslint-disable prettier/prettier */
  const files = [...metaEvidenceFiles, ...relMetaEvidenceFiles].map(file => ({
    data: file,
    multihash: Archon.utils.multihashFile(file, 0x1B)
  }))
  /* eslint-enable prettier/prettier */

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
  const { networkId } = useWeb3Context()
  const { pushWeb3Action } = useContext(WalletContext)
  const { width } = useWindowDimensions()
  const [currentStep, setCurrentStep] = useState(0)
  const [txSubmitted, setTxSubmitted] = useState()
  const factoryAddress = useNetworkEnvVariable(
    'REACT_APP_FACTORY_ADDRESSES',
    networkId
  )

  const onDeploy = () => {
    pushWeb3Action(async (_, signer) => {
      const {
        registrationMetaEvidencePath,
        clearingMetaEvidencePath,
        relRegistrationMetaEvidencePath,
        relClearingMetaEvidencePath
      } = await getTcrMetaEvidence(tcrState)

      const factory = new ethers.Contract(factoryAddress, _GTCRFactory, signer)
      const relTCRtx = await factory.deploy(
        tcrState.relArbitratorAddress,
        tcrState.relArbitratorExtraData, // Arbitrator extra data.
        ZERO_ADDRESS,
        relRegistrationMetaEvidencePath,
        relClearingMetaEvidencePath,
        tcrState.relGovernorAddress,
        parseEther(tcrState.relSubmissionBaseDeposit.toString()),
        parseEther(tcrState.relRemovalBaseDeposit.toString()),
        parseEther(tcrState.relSubmissionChallengeBaseDeposit.toString()),
        parseEther(tcrState.relRemovalChallengeBaseDeposit.toString()),
        Number(tcrState.relChallengePeriodDuration) * 60 * 60,
        [
          tcrState.relSharedStakeMultiplier,
          tcrState.relWinnerStakeMultiplier,
          tcrState.relLooserStakeMultiplier
        ], // Shared, winner and looser stake multipliers in basis points.
        { gasLimit: 6000000 }
      )
      setTxState({ txHash: relTCRtx.hash, status: 'pending' })
      setTxSubmitted(relTCRtx.hash)
      setCurrentStep(1)
      return {
        tx: relTCRtx,
        actionMessage: 'Deploying Badges List',
        deployTCR: true,
        onTxMined: async ({ contractAddress }) => {
          setTxState({
            txHash: relTCRtx.hash,
            status: 'mined',
            contractAddress,
            isConnectedTCR: true
          })
          setCurrentStep(2)

          pushWeb3Action(async () => {
            const tx = await factory.deploy(
              tcrState.arbitratorAddress,
              tcrState.arbitratorExtraData, // Arbitrator extra data.
              contractAddress,
              registrationMetaEvidencePath,
              clearingMetaEvidencePath,
              tcrState.governorAddress,
              parseEther(tcrState.submissionBaseDeposit.toString()),
              parseEther(tcrState.removalBaseDeposit.toString()),
              parseEther(tcrState.submissionChallengeBaseDeposit.toString()),
              parseEther(tcrState.removalChallengeBaseDeposit.toString()),
              Number(tcrState.challengePeriodDuration) * 60 * 60,
              [
                tcrState.sharedStakeMultiplier,
                tcrState.winnerStakeMultiplier,
                tcrState.looserStakeMultiplier
              ], // Shared, winner and looser stake multipliers in basis points.
              { gasLimit: 6000000 }
            )
            setTxState({
              txHash: tx.hash,
              status: 'pending'
            })
            setTxSubmitted(tx.hash)
            return {
              tx,
              actionMessage: 'Deploying List',
              deployTCR: true,
              onTxMined: async ({ contractAddress }) => {
                setTxState({
                  txHash: tx.hash,
                  status: 'mined',
                  contractAddress
                })
                setTcrState(prevState => ({
                  ...prevState,
                  finished: true
                }))
                setCurrentStep(3)
              }
            }
          })
        }
      }
    })
  }

  return (
    <StyledCard title="Deploy the list">
      {currentStep === 0 && (
        <StyledAlert
          showIcon
          type="info"
          closable
          message="On your marks..."
          description="When you are ready, click deploy. Please do not close the window until the process is finished and sign both transactions."
        />
      )}
      {currentStep > 0 && currentStep < 3 && (
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
          title="Deploying Badges list"
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
        <Steps.Step
          title="Deploying list"
          description={currentStep > 2 && 'Finished'}
          icon={
            currentStep < 2 ? (
              <Icon type="star" />
            ) : currentStep === 2 ? (
              <Icon type="loading" />
            ) : (
              <Icon type="check" />
            )
          }
        />
        <Steps.Step title="Finished!" icon={<Icon type="flag" />} />
      </StyledSteps>
      {currentStep === 3 && (
        <StyledAlert
          type="success"
          showIcon
          message="Success!"
          description={
            <>
              <StyledDiv>
                List Deployed at{' '}
                <Link
                  to={`/tcr/${tcrState.transactions[txSubmitted].contractAddress}`}
                >
                  {tcrState.transactions[txSubmitted].contractAddress}
                </Link>
                .
              </StyledDiv>
              <StyledDiv>
                You may want to bookmark its address or, if it adheres to the
                listing criteria, submit it to the List Browser.
              </StyledDiv>
            </>
          }
        />
      )}
      <StyledActions>
        <StyledButton
          type="primary"
          onClick={onDeploy}
          icon={currentStep <= 0 || currentStep === 3 ? 'fire' : 'loading'}
          disabled={currentStep > 0 && currentStep < 3}
        >
          Deploy!
        </StyledButton>
      </StyledActions>
    </StyledCard>
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
    looserStakeMultiplier: PropTypes.oneOfType([
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
    relLooserStakeMultiplier: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string
    ]).isRequired
  }).isRequired
}

export default Deploy
