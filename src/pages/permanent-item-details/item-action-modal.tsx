import React, { useMemo } from 'react'
import type { BigNumber } from 'ethers'
import { STATUS_CODE } from 'utils/permanent-item-status'
import { stakeActionLabel } from 'components/permanent-item-action-button'
import { ResubmitRedirect } from 'pages/submit-item/resubmit'
import ChallengeModal from './modals/challenge'
import CrowdfundModal from './modals/crowdfund'

/*
 * Picks the modal behind the item's one action: challenge while listed,
 * fund an appeal while an appeal is open. Off the list, the action is a
 * resubmission on the submit page (an ?action= link is sent there).
 */

interface ItemActionModalProps {
  statusCode: number
  isOpen: boolean
  itemName: string
  onClose: () => void
  item: SubgraphItem
  metaEvidence?: MetaEvidence
  appealCost?: BigNumber | undefined
  appealCostFailed?: boolean
  onRetryAppealCost?: () => void
  /** A challenge's arbitration cost: the setting the contract picks for this entry. */
  challengeArbitrationCost?: BigNumber | undefined
  /** The policy this entry is judged by; the newest one when not given. */
  policyURI?: string
  /** The entry's values are still being read; a resubmission waits for them. */
  valuesPending?: boolean
}

const ItemActionModal = ({
  statusCode,
  isOpen,
  itemName,
  onClose,
  item,
  metaEvidence,
  appealCost,
  appealCostFailed,
  onRetryAppealCost,
  challengeArbitrationCost,
  policyURI: entryPolicyURI,
  valuesPending = false,
}: ItemActionModalProps) => {
  const rest = {
    visible: isOpen,
    title: stakeActionLabel({ statusCode, itemName }),
    onCancel: onClose,
  }
  const r = useMemo(() => item?.registry, [item])
  const policyURI =
    entryPolicyURI ?? r?.arbitrationSettings?.[0]?.metadata?.policyURI

  switch (statusCode) {
    case STATUS_CODE.ACCEPTED:
    case STATUS_CODE.PENDING:
      return (
        <ChallengeModal
          item={item}
          itemName={itemName}
          arbitrationCost={challengeArbitrationCost}
          policyURI={policyURI}
          {...rest}
        />
      )
    case STATUS_CODE.REJECTED:
    case STATUS_CODE.REMOVED:
    case STATUS_CODE.WITHDRAWN:
      return (
        <ResubmitRedirect
          open={isOpen}
          ready={!valuesPending}
          columns={metaEvidence?.metadata?.columns}
          values={item.decodedData}
          onClose={onClose}
        />
      )
    case STATUS_CODE.CROWDFUNDING:
    case STATUS_CODE.CROWDFUNDING_WINNER:
      return (
        <CrowdfundModal
          statusCode={statusCode}
          item={item}
          fileURI={policyURI}
          appealCost={appealCost}
          appealCostFailed={appealCostFailed}
          onRetryAppealCost={onRetryAppealCost}
          {...rest}
        />
      )
    case STATUS_CODE.DISPUTED:
    case STATUS_CODE.WAITING_ARBITRATOR:
    case STATUS_CODE.PENDING_WITHDRAWAL:
      return null
    default:
      throw new Error(`Unhandled status code ${statusCode}`)
  }
}

export default ItemActionModal
