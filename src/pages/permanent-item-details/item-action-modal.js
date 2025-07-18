import React from 'react'
import { STATUS_CODE, getActionLabel } from 'utils/permanent-item-status'
import ChallengeModal from './modals/challenge'
import SubmitModal from './modals/submit'
import CrowdfundModal from './modals/crowdfund'

// ok this is one of the hardest ones to get, right?
// lets think aloud for a bit
// remove modal will be smart and hanlde both start w, approve into challenge and some explainer
// 1. if absent, that'd be resubmit same item right?
// 2. if pending/valid its either challenge/start withdraw, depending on whether signer is curr submitter AND wt === 0
// 3. crowdfund is kinda the same too?
// evidence is triggered somew else
// exec withdrawal is handled already.

const ItemActionModal = ({
  statusCode,
  isOpen,
  itemName,
  onClose,
  fileURI,
  item,
  submissionDeposit,
  challengePeriodDuration,
  tcrAddress,
  metaEvidence,
  appealCost,
  arbitrationCost
}) => {
  // Common button properties.
  const rest = {
    visible: isOpen,
    title: getActionLabel({ statusCode, itemName }),
    onCancel: onClose
  }

  switch (statusCode) {
    case STATUS_CODE.ACCEPTED:
    case STATUS_CODE.PENDING:
      return (
        <ChallengeModal
          item={item}
          itemName={itemName}
          fileURI={fileURI}
          statusCode={statusCode}
          arbitrationCost={arbitrationCost}
          {...rest}
        />
      )
    case STATUS_CODE.ABSENT:
      return (
        <SubmitModal
          initialValues={item.decodedData}
          submissionDeposit={submissionDeposit}
          tcrAddress={tcrAddress}
          metaEvidence={metaEvidence}
          columns={metaEvidence.metadata.columns}
          challengePeriodDuration={challengePeriodDuration}
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
          appealCost={appealCost}
          {...rest}
        />
      )
    case STATUS_CODE.WAITING_ARBITRATOR:
      return null
    default:
      throw new Error(`Unhandled status code ${statusCode}`)
  }
}

export default ItemActionModal
