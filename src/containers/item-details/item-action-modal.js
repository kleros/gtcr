import React, { useContext } from 'react'
import { Modal, Descriptions, Typography, Divider } from 'antd'
import { ethers } from 'ethers'
import { abi as _gtcr } from '../../assets/contracts/GTCRMock.json'
import { STATUS_CODE, getActionLabel } from '../../utils/item-status'
import { TCRViewContext } from '../../bootstrap/tcr-view-context'
import ETHAmount from '../../components/eth-amount'
import { WalletContext } from '../../bootstrap/wallet-context'

const ItemActionModal = ({
  statusCode,
  isOpen,
  itemName,
  onClose,
  fileURI,
  item
}) => {
  // Common button properties
  const rest = {
    visible: isOpen,
    title: getActionLabel({ statusCode, itemName }),
    onCancel: onClose
  }

  // Get contract data.
  const { requestDeposit, tcrAddress } = useContext(TCRViewContext)
  const { pushWeb3Action } = useContext(WalletContext)

  const requestStatusChange = () => {
    pushWeb3Action(async (_, signer) => {
      const gtcr = new ethers.Contract(tcrAddress, _gtcr, signer)

      // Request signature and submit.
      const tx = await gtcr.requestStatusChange(item.data, {
        value: requestDeposit
      })

      rest.onCancel() // Hide the submission modal.
      return {
        tx,
        actionMessage: `Requesting ${itemName || 'item'} removal`
      }
    })
  }

  switch (statusCode) {
    case STATUS_CODE.REGISTERED: {
      return (
        <Modal {...rest} onOk={requestStatusChange}>
          <Typography.Title level={4}>
            See the&nbsp;
            <a
              href={`${process.env.REACT_APP_IPFS_GATEWAY}${fileURI || ''}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Listing Criteria
            </a>
            .
          </Typography.Title>
          <Typography.Paragraph>
            To submit a removal request, a deposit is required. This value will
            be reimbursed after the challenge period if no one challenges the
            request.
          </Typography.Paragraph>
          <Divider />
          <Descriptions
            bordered
            column={{ xxl: 4, xl: 3, lg: 3, md: 3, sm: 2, xs: 1 }}
          >
            <Descriptions.Item label="Total Deposit Required">
              <ETHAmount decimals={3} amount={requestDeposit.toString()} />
            </Descriptions.Item>
          </Descriptions>
        </Modal>
      )
    }
    case STATUS_CODE.REJECTED:
      return <Modal {...rest}>Resubmit</Modal>
    case STATUS_CODE.SUBMITTED:
      return <Modal {...rest}>Challenge Submission</Modal>
    case STATUS_CODE.REMOVAL_REQUESTED:
      return <Modal {...rest}>Challenge Removal</Modal>
    case STATUS_CODE.CROWDFUNDING:
      return <Modal {...rest}>Select who to crowdfund</Modal>
    case STATUS_CODE.CROWDFUNDING_WINNER:
      return <Modal {...rest}>Crowdfund winner</Modal>
    default:
      throw new Error(`Unhandled status code ${statusCode}`)
  }
}

export default ItemActionModal
