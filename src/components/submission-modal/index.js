import React, { useContext } from 'react'
import { Spin, Modal, Button } from 'antd'
import styled from 'styled-components/macro'
import PropTypes from 'prop-types'
import SubmissionForm from './form'
import web3EthAbi from 'web3-eth-abi'
import FastJsonRpcSigner from '../../utils/fast-signer'
import { abi } from '../../assets/contracts/GTCRMock.json'
import { WalletContext } from '../../bootstrap/wallet-context'
import { ethers } from 'ethers'
import { typeToSolidity } from '../../utils/item-types'

const StyledSpin = styled(Spin)`
  left: 50%;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
`

const SubmissionModal = ({ metaEvidence, tcrAddress, ...rest }) => {
  const { pushWeb3Action } = useContext(WalletContext)
  if (!metaEvidence)
    return (
      <Modal
        title="Submit Item"
        footer={[
          <Button key="back" onClick={rest.onCancel}>
            Cancel
          </Button>
        ]}
        {...rest}
      >
        <StyledSpin />
      </Modal>
    )

  const postSubmit = (values, columns) => {
    const encodedParams = web3EthAbi.encodeParameters(
      columns.map(column => typeToSolidity[column.type]),
      columns.map(column => values[column.label])
    )
    pushWeb3Action(async ({ library, account }) => {
      // TODO: Remove FastJsonRpcSigner when ethers v5 is out.
      // See https://github.com/ethers-io/ethers.js/issues/511
      const signer = new FastJsonRpcSigner(library.getSigner(account))
      const gtcr = new ethers.Contract(tcrAddress, abi, signer)

      const tx = await gtcr.addItem(encodedParams)
      rest.onCancel()
      return {
        tx,
        actionMessage: `Submitting ${metaEvidence.itemName || 'item'}`
      }
    })
  }

  return (
    <Modal
      title={`Submit ${metaEvidence.itemName || 'Item'}`}
      footer={null}
      {...rest.onCancel}
      {...rest}
    >
      <SubmissionForm
        columns={metaEvidence.columns}
        postSubmit={postSubmit}
        onCancel={rest.onCancel}
      />
    </Modal>
  )
}

SubmissionModal.propTypes = {
  metaEvidence: PropTypes.shape({
    itemName: PropTypes.string,
    columns: PropTypes.arrayOf(
      PropTypes.shape({
        label: PropTypes.string.isRequired,
        description: PropTypes.string.isRequired
      })
    )
  }),
  tcrAddress: PropTypes.string.isRequired
}

SubmissionModal.defaultProps = {
  metaEvidence: null
}

export default SubmissionModal
