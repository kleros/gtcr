import { Card, Button, Alert, Spin, Icon } from 'antd'
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

const StyledButton = styled(Button)`
  margin-right: 7px;
`

const StyledDiv = styled.div`
  word-break: break-all;
`

const StyledAlert = styled(Alert)`
  margin-bottom: 24px;
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
    tcrDescription: `A TCR of TCRs related to ${tcrTitle}`,
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

const Deploy = ({ resetTcrState, setTxState, tcrState }) => {
  const { networkId } = useWeb3Context()
  const { pushWeb3Action } = useContext(WalletContext)
  const factoryAddress = useNetworkEnvVariable(
    'REACT_APP_FACTORY_ADDRESSES',
    networkId
  )

  const [txSubmitted, setTxSubmitted] = useState()

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
      return {
        tx: relTCRtx,
        actionMessage: 'Deploying Badges TCR',
        deployTCR: true,
        onTxMined: async ({ contractAddress }) => {
          setTxState({
            txHash: relTCRtx.hash,
            status: 'mined',
            contractAddress
          })

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
            setTxState({ txHash: tx.hash, status: 'pending' })
            setTxSubmitted(tx.hash)
            return {
              tx,
              actionMessage: 'Deploying TCR',
              deployTCR: true,
              onTxMined: async ({ contractAddress }) => {
                setTxState({
                  txHash: tx.hash,
                  status: 'mined',
                  contractAddress
                })
              }
            }
          })
        }
      }
    })
  }

  return (
    <Card title="Deploy the TCR">
      {!txSubmitted && (
        <StyledButton type="primary" onClick={onDeploy}>
          Deploy!
        </StyledButton>
      )}
      {txSubmitted ? (
        tcrState.transactions[txSubmitted].status === 'pending' ? (
          <StyledAlert
            type="info"
            message={
              <>
                <Spin
                  indicator={
                    <Icon type="loading" style={{ fontSize: 24 }} spin />
                  }
                />{' '}
                Transaction pending...
              </>
            }
          />
        ) : (
          tcrState.transactions[txSubmitted].contractAddress && (
            <StyledAlert
              type="info"
              message={
                <StyledDiv>
                  TCR Deployed at{' '}
                  <Link
                    to={`/tcr/${tcrState.transactions[txSubmitted].contractAddress}`}
                  >
                    {tcrState.transactions[txSubmitted].contractAddress}
                  </Link>
                </StyledDiv>
              }
            />
          )
        )
      ) : null}
      <StyledButton onClick={resetTcrState}>Start over</StyledButton>
    </Card>
  )
}

Deploy.propTypes = {
  resetTcrState: PropTypes.func.isRequired,
  setTxState: PropTypes.func.isRequired,
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
