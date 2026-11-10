import React from 'react'
import type { ethers, BigNumber } from 'ethers'
import { STATUS_CODE } from 'utils/item-status'
import { itemActionLabel } from 'components/item-action-button'
import RemoveModal from './modals/remove'
import ChallengeModal from './modals/challenge'
import SubmitModal from './modals/submit'
import SubmitConnectModal from './modals/submit-connect'
import CrowdfundModal from './modals/crowdfund'

/*
 * Opens the one modal a Classic entry's status calls for: remove, resubmit,
 * challenge or contribute appeal fees.
 */

interface ItemActionModalProps {
  statusCode: number
  isOpen: boolean
  itemName: string
  onClose: () => void
  fileURI: string
  item: SubgraphItem
  isConnectedTCR?: boolean
  submissionDeposit?: BigNumber | undefined
  challengePeriodDuration?: BigNumber | undefined
  tcrAddress?: string
  metaEvidence?: MetaEvidence | undefined
  gtcrView?: ethers.Contract | undefined
  appealCost?: BigNumber | undefined
}

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
  gtcrView,
  appealCost,
}: ItemActionModalProps) => {
  // Common modal properties.
  const rest = {
    visible: isOpen,
    title: itemActionLabel(statusCode, itemName),
    onCancel: onClose,
  }

  switch (statusCode) {
    case STATUS_CODE.REGISTERED:
      return (
        <RemoveModal
          item={item}
          itemName={itemName}
          fileURI={fileURI}
          {...rest}
        />
      )
    case STATUS_CODE.REJECTED:
    case STATUS_CODE.REMOVED:
      return isConnectedTCR ? (
        <SubmitConnectModal
          initialValues={item.decodedData?.map(String)}
          tcrAddress={tcrAddress}
          gtcrView={gtcrView}
          {...rest}
        />
      ) : (
        <SubmitModal
          initialValues={item.decodedData?.map(String)}
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
          appealCost={appealCost}
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
