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
import { ZERO_ADDRESS } from '../../utils/string'

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
  const { title, description, columns, itemName } = tcrState
  const tcrMetadata = { title, description, columns, itemName }

  const enc = new TextEncoder()
  const fileData = enc.encode(JSON.stringify(tcrMetadata))
  /* eslint-disable prettier/prettier */
  const fileMultihash = Archon.utils.multihashFile(
    tcrMetadata,
    0x1B
  )
  /* eslint-enable prettier/prettier */
  const ipfsMetaEvidenceObject = await ipfsPublish(
    fileMultihash,
    fileData,
    process.env.REACT_APP_IPFS_GATEWAY
  )
  const ipfsMetaEvidencePath = `/ipfs/${ipfsMetaEvidenceObject[1].hash +
    ipfsMetaEvidenceObject[0].path}`

  return ipfsMetaEvidencePath
}

const Deploy = ({ resetTcrState, setTxState, tcrState }) => {
  const { pushWeb3Action } = useContext(WalletContext)
  const [txSubmitted, setTxSubmitted] = useState()

  const onDeploy = () => {
    pushWeb3Action(async ({ account }, signer) => {
      const factory = ethers.ContractFactory.fromSolidity(_GTCR, signer)
      const registrationMetaEvidence = await getTcrMetaEvidence(tcrState)
      const clearingMetaEvidence = await getTcrMetaEvidence(tcrState)

      const tx = await factory.deploy(
        tcrState.arbitratorAddress,
        '0x00', // Arbitrator extra data.
        ZERO_ADDRESS,
        registrationMetaEvidence,
        clearingMetaEvidence,
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
