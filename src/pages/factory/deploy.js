import { Card, Button, Alert, Spin, Icon } from 'antd'
import { Link } from 'react-router-dom'
import PropTypes from 'prop-types'
import React, { useContext, useState } from 'react'
import { WalletContext } from '../../bootstrap/wallet-context'
import { ethers } from 'ethers'
import _GTCR from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import styled from 'styled-components/macro'
import ipfsPublish from '../../utils/ipfs-publish'
import Archon from '@kleros/archon'
import { parseEther } from 'ethers/utils'
import { ZERO_ADDRESS, isVowel } from '../../utils/string'

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
  const { tcrTitle, tcrDescription, columns, itemName } = tcrState
  const tcrMetaEvidence = { tcrTitle, tcrDescription, columns, itemName }

  // Using a placeholder evidence display URI and primary document.
  // TODO: Set the evidence display URI.
  // TODO: Allow user to set the primary document.
  const metaEvidence = {
    category: 'Curated Lists',
    question: `Does the ${(itemName && itemName.toLowerCase()) ||
      'item'} comply with the required criteria?`,
    fileURI:
      '/ipfs/QmRNK2cpW2i4Q9BBp58ALuhHnXuKEPkSBLU5q4mdtBG9i4/dutchx-badge.pdf',
    evidenceDisplayInterfaceURL:
      'https://ipfs.kleros.io/ipfs/QmaP1GLa7tnoRXGzyyJste2zk7VcZaVUG637sL7EZ8pqq4/index.html',
    evidenceDisplayInterfaceHash:
      'Bcd8UMiP7N3KV5PWgi7jtwqGZriGsuwWcA174Whz6HHUGGoekWWf4kWWJ8zifKcuifRpk3woaYKgqdDzwx6NZ87asZ',
    ...tcrMetaEvidence
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

  const enc = new TextEncoder()
  const metaEvidenceFiles = [
    registrationMetaEvidence,
    clearingMetaEvidence
  ].map(metaEvidence => enc.encode(JSON.stringify(metaEvidence)))

  /* eslint-disable prettier/prettier */
  const files = metaEvidenceFiles.map(file => ({
    data: file,
    multihash: Archon.utils.multihashFile(file, 0x1B)
  }))
  /* eslint-enable prettier/prettier */

  const ipfsMetaEvidenceObjects = (await Promise.all(
    files.map(file => ipfsPublish(file.multihash, file.data))
  )).map(
    ipfsMetaEvidenceObject =>
      `/ipfs/${ipfsMetaEvidenceObject[1].hash + ipfsMetaEvidenceObject[0].path}`
  )

  return {
    registrationMetaEvidencePath: ipfsMetaEvidenceObjects[0],
    clearingMetaEvidencePath: ipfsMetaEvidenceObjects[1]
  }
}

const Deploy = ({ resetTcrState, setTxState, tcrState }) => {
  const { pushWeb3Action } = useContext(WalletContext)
  const [txSubmitted, setTxSubmitted] = useState()

  const onDeploy = () => {
    pushWeb3Action(async ({ account }, signer) => {
      const factory = ethers.ContractFactory.fromSolidity(_GTCR, signer)
      const {
        registrationMetaEvidencePath,
        clearingMetaEvidencePath
      } = await getTcrMetaEvidence(tcrState)

      const tx = await factory.deploy(
        tcrState.arbitratorAddress,
        '0x00', // Arbitrator extra data.
        ZERO_ADDRESS,
        registrationMetaEvidencePath,
        clearingMetaEvidencePath,
        account,
        parseEther(tcrState.requesterBaseDeposit.toString()),
        parseEther(tcrState.challengerBaseDeposit.toString()),
        (60 * 60 * 24).toString(), // Challenge period duration (in seconds)
        '10000', // Shared stake multiplier in basis points.
        '10000', // Winner stake multiplier in basis points.
        '20000', // Loser stake multiplier in basis points.
        { gasLimit: 6000000 }
      )
      setTxState({ txHash: tx.deployTransaction.hash, status: 'pending' })
      setTxSubmitted(tx.deployTransaction.hash)
      return {
        tx,
        actionMessage: 'Deploying TCR',
        onTxMined: ({ contractAddress }) =>
          setTxState({
            txHash: tx.deployTransaction.hash,
            status: 'mined',
            contractAddress
          })
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
                />
                {`  Transaction pending...`}
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
    requesterBaseDeposit: PropTypes.number.isRequired,
    challengerBaseDeposit: PropTypes.number.isRequired
  }).isRequired
}

export default Deploy
