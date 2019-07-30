import { Card, Button, Alert, Spin, Icon } from 'antd'
import PropTypes from 'prop-types'
import React, { useContext, useState } from 'react'
import { WalletContext } from '../../bootstrap/wallet-context'
import { ethers } from 'ethers'
import FastJsonRpcSigner from '../../utils/fast-signer'
import _GTCR from '../../assets/contracts/ItemMock.json'
import styled from 'styled-components/macro'
import itemTypes from '../../utils/item-types'
import ipfsPublish from '../../utils/ipfs-publish'
import Archon from '@kleros/archon'

const StyledButton = styled(Button)`
  margin-right: 7px;
`

const StyledDiv = styled.div`
  word-break: break-all;
`

const StyledAlert = styled(Alert)`
  margin-bottom: 24px;
`

const getItemSchema = tcrState => {
  const lengths = tcrState.columns
    .filter(col => !!itemTypes[col.type])
    .map(col => itemTypes[col.type])
  // We use 143 bytes as the max length as that is the length of a multihash-based ipfs path, prepended with /ipfs/. e.g.:
  // /ipfs/Qmds1Eh4NAFfVuoUX6ZYdcBYQ7rYHQAQmgdBw3Jc9Ckvd8/Bcd77GogNGAV4q9hgVT6fo6kMwrvUDU3uUp69BYuJ8Xb3tdHLanXAZuiHexNdFBX4DMpadjpNftii2P5VqphnSFKZz
  const IPFS_MULTIHASH_PATH_LENGTH = 143
  if (tcrState.columns.length > lengths.length)
    // This means one or more columns are stored offchain.
    // Storing columns offchain is done by adding an onchain column to the item schema, which
    // holds a link to a JSON file with the offchain column values.
    lengths.push(IPFS_MULTIHASH_PATH_LENGTH)

  const offsets = [0]
  for (let i = 1; i < lengths.length; i++)
    offsets.push(offsets[i - 1] + lengths[i - 1])

  return { offsets, lengths }
}

const getTcrMetaEvidence = async tcrState => {
  const { title, description, columns } = tcrState
  const tcrMetadata = { title, description, columns }

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
    pushWeb3Action(async ({ library, account }) => {
      // TODO: Remove FastJsonRpcSigner when ethers v5 is out.
      // See https://github.com/ethers-io/ethers.js/issues/511
      const signer = new FastJsonRpcSigner(library.getSigner(account))
      const factory = ethers.ContractFactory.fromSolidity(_GTCR, signer)
      const { offsets, lengths } = getItemSchema(tcrState)
      const registrationMetaEvidence = await getTcrMetaEvidence(tcrState)
      const clearingMetaEvidence = await getTcrMetaEvidence(tcrState)
      const latestBlockNumber = await library.getBlockNumber()

      const tx = await factory.deploy(
        offsets,
        lengths,
        registrationMetaEvidence,
        clearingMetaEvidence,
        latestBlockNumber
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
                  {tcrState.transactions[txSubmitted].contractAddress}
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
    ).isRequired
  }).isRequired
}

export default Deploy
