import React from 'react'
import type { BigNumber } from 'ethers'
import { STATUS_CODE } from 'utils/item-status'
import { itemActionLabel } from 'components/item-action-button'
import { ResubmitRedirect } from 'pages/submit-item/resubmit'
import RemoveModal from './modals/remove'
import ChallengeModal from './modals/challenge'
import CrowdfundModal from './modals/crowdfund'

/*
 * Opens the one modal the entry's status calls for: remove, challenge or
 * contribute appeal fees. A resubmission is the submit page's, with the
 * entry's own values (an ?action= link is sent there).
 */

interface ItemActionModalProps {
  statusCode: number
  isOpen: boolean
  itemName: string
  onClose: () => void
  fileURI: string
  item: SubgraphItem
  metaEvidence?: MetaEvidence | undefined
  appealCost?: BigNumber | undefined
  appealCostFailed?: boolean
  retryAppealCost?: () => void
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
  appealCostFailed,
  retryAppealCost,
}: ItemActionModalProps) => {
  // Common modal properties.
  const rest = {
    visible: isOpen,
    title: itemActionLabel(statusCode, itemName),
    onCancel: onClose,
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
    case STATUS_CODE.REMOVED:
      return (
        <ResubmitRedirect
          open={isOpen}
          columns={metaEvidence?.metadata?.columns}
          values={item.decodedData}
          onClose={onClose}
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
          appealCost={appealCost}
          appealCostFailed={appealCostFailed}
          retryAppealCost={retryAppealCost}
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
