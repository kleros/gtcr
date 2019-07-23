import { Card, Button, Alert, Spin, Icon } from 'antd'
import PropTypes from 'prop-types'
import React, { useContext, useState } from 'react'
import { WalletContext } from '../../bootstrap/wallet-context'
import { ethers } from 'ethers'
import FastJsonRpcSigner from '../../utils/fast-signer'
import GTCR from '../../assets/contracts/ItemMock.json'
import styled from 'styled-components/macro'

const StyledButton = styled(Button)`
  margin-right: 7px;
`

const StyledDiv = styled.div`
  word-break: break-all;
`

const StyledAlert = styled(Alert)`
  margin-bottom: 24px;
`

const Deploy = ({ resetTcrState, setTxState, tcrState }) => {
  const { setPendingCallback } = useContext(WalletContext)
  const [txSubmitted, setTxSubmitted] = useState()

  const onDeploy = () => {
    setPendingCallback({
      action: async ({ library, account }) => {
        // TODO: replace this when v5 of ethers is out.
        // See https://github.com/ethers-io/ethers.js/issues/511
        const signer = new FastJsonRpcSigner(library.getSigner(account))
        const factory = ethers.ContractFactory.fromSolidity(GTCR, signer)
        const tx = await factory.deploy([0, 32], [32, 32])
        setTxState({ txHash: tx.deployTransaction.hash, status: 'pending' })
        setTxSubmitted(tx.deployTransaction.hash)
        return {
          tx,
          actionDescription: 'Deploying GTCR',
          onTxMined: ({ contractAddress }) =>
            setTxState({
              txHash: tx.deployTransaction.hash,
              status: 'mined',
              contractAddress
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
