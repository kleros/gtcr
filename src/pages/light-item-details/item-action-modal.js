import React from 'react'
import { STATUS_CODE, getActionLabel } from '../../utils/item-status'
import RemoveModal from './modals/remove'
import ChallengeModal from './modals/challenge'
import SubmitModal from './modals/submit'
import SubmitConnectModal from './modals/submit-connect'
import CrowdfundModal from './modals/crowdfund'

const ItemActionModal = ({
  statusCode,
  isOpen,
  itemName,
  onClose,
  fileURI,
  item,
  isConnectedTCR,
  submissionDeposit,
  challengePeriodDuration,
  tcrAddress,
  metaEvidence,
  gtcrView
}) => {
  // Common button properties.
  const rest = {
    visible: isOpen,
    title: getActionLabel({ statusCode, itemName }),
    onCancel: onClose
  }

  switch (statusCode) {
    case STATUS_CODE.REGISTERED: {
      return (
        <RemoveModal
          item={item}
          itemName={itemName}
          fileURI={fileURI}
          {...rest}
        />
      )
    }
    case STATUS_CODE.REJECTED:
      return isConnectedTCR ? (
        <SubmitConnectModal
          initialValues={item.decodedData}
          tcrAddress={tcrAddress}
          gtcrView={gtcrView}
          {...rest}
        />
      ) : (
        <SubmitModal
          initialValues={item.decodedData}
          submissionDeposit={submissionDeposit}
          tcrAddress={tcrAddress}
          metaEvidence={metaEvidence}
          challengePeriodDuration={challengePeriodDuration}
          {...rest}
        />
      )
    case STATUS_CODE.REMOVAL_REQUESTED:
    case STATUS_CODE.SUBMITTED:
      return (
        <ChallengeModal
          item={item}
          itemName={itemName}
          fileURI={fileURI}
          statusCode={statusCode}
          {...rest}
        />
      )
    case STATUS_CODE.CROWDFUNDING:
    case STATUS_CODE.CROWDFUNDING_WINNER:
      return (
        <CrowdfundModal
          statusCode={statusCode}
          item={item}
          fileURI={fileURI}
          {...rest}
        />
      )
    case STATUS_CODE.WAITING_ARBITRATOR:
    case STATUS_CODE.WAITING_ENFORCEMENT:
      return null
    default:
      throw new Error(`Unhandled status code ${statusCode}`)
  }
}

export default ItemActionModal
