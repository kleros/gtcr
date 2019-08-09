import React from 'react'
import { Modal } from 'antd'
import { STATUS_CODE } from '../utils/item-status'

const ItemActionModal = ({ statusCode, isOpen, itemName }) => {
  switch (statusCode) {
    case STATUS_CODE.REGISTERED:
      return (
        <Modal visible={isOpen} title={`Remove ${itemName || 'item'}`}>
          Remove
        </Modal>
      )
    case STATUS_CODE.REJECTED:
      return (
        <Modal visible={isOpen} title={`Resubmit ${itemName || 'item'}`}>
          Resubmit
        </Modal>
      )
    case STATUS_CODE.SUBMITTED:
      return (
        <Modal visible={isOpen} title="Challenge Submission">
          Challenge Submission
        </Modal>
      )
    case STATUS_CODE.REMOVAL_REQUESTED:
      return (
        <Modal visible={isOpen} title="Challenge Removal">
          Challenge Removal
        </Modal>
      )
    case STATUS_CODE.CROWDFUNDING:
      return (
        <Modal visible={isOpen} title="Contribute to appeal crowdfunding">
          Select who to crowdfund
        </Modal>
      )
    case STATUS_CODE.CROWDFUNDING_WINNER:
      return (
        <Modal visible={isOpen} title="Contribute to appeal crowdfunding">
          Crowdfund winner
        </Modal>
      )
    default:
      throw new Error(`Unhandled status code ${statusCode}`)
  }
}

export default ItemActionModal
