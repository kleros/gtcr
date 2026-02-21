import React, { useMemo } from 'react'
import { STATUS_CODE, getActionLabel } from 'utils/permanent-item-status'
import ChallengeModal from './modals/challenge'
import SubmitModal from './modals/submit'
import CrowdfundModal from './modals/crowdfund'

interface ItemActionModalProps {
  statusCode: number
  isOpen: boolean
  itemName: string
  onClose: () => void
  fileURI?: string
  item: any
  metaEvidence?: any
  appealCost?: any
  arbitrationCost?: any
}

const ItemActionModal = ({
  statusCode,
  isOpen,
  itemName,
  onClose,
  fileURI,
  item,
  metaEvidence,
  appealCost,
  arbitrationCost
}: ItemActionModalProps) => {
  // Common button properties.
  const rest = {
    visible: isOpen,
    title: getActionLabel({ statusCode, itemName }),
    onCancel: onClose
  }
  const r = useMemo(() => item?.registry, [item])

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
    case STATUS_CODE.REJECTED:
    case STATUS_CODE.REMOVED:
      return (
        <SubmitModal
          initialValues={item.decodedData}
          submissionDeposit={r.submissionMinDeposit}
          submissionPeriod={r.submissionPeriod}
          arbitrationCost={arbitrationCost}
          withdrawingPeriod={r.withdrawingPeriod}
          tcrAddress={r.id}
          tokenAddress={r.token}
          metadata={metaEvidence.metadata}
          columns={metaEvidence.metadata.columns}
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
    case STATUS_CODE.PENDING_WITHDRAWAL:
      return null
    default:
      throw new Error(`Unhandled status code ${statusCode}`)
  }
}

export default ItemActionModal
