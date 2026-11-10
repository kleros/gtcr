import React, { useMemo } from 'react'
import type { BigNumber } from 'ethers'
import { STATUS_CODE } from 'utils/permanent-item-status'
import { stakeActionLabel } from 'components/permanent-item-action-button'
import ChallengeModal from './modals/challenge'
import SubmitModal from './modals/submit'
import CrowdfundModal from './modals/crowdfund'

/*
 * Picks the modal behind the item's one action: challenge while listed,
 * resubmit once off the list, fund an appeal while an appeal is open.
 */

interface ItemActionModalProps {
  statusCode: number
  isOpen: boolean
  itemName: string
  onClose: () => void
  item: SubgraphItem
  metaEvidence?: MetaEvidence
  appealCost?: BigNumber | undefined
  arbitrationCost?: BigNumber | undefined
}

const ItemActionModal = ({
  statusCode,
  isOpen,
  itemName,
  onClose,
  item,
  metaEvidence,
  appealCost,
  arbitrationCost,
}: ItemActionModalProps) => {
  const rest = {
    visible: isOpen,
    title: stakeActionLabel({ statusCode, itemName }),
    onCancel: onClose,
  }
  const r = useMemo(() => item?.registry, [item])
  const policyURI = r?.arbitrationSettings?.[0]?.metadata?.policyURI
  const submitMetadata = metaEvidence?.metadata
    ? {
        title: String(
          metaEvidence.metadata.tcrTitle ?? metaEvidence.metadata.title ?? '',
        ),
        itemName: metaEvidence.metadata.itemName ?? '',
        policyURI: String(metaEvidence.metadata.policyURI ?? ''),
      }
    : undefined

  switch (statusCode) {
    case STATUS_CODE.ACCEPTED:
    case STATUS_CODE.PENDING:
      return (
        <ChallengeModal
          item={item}
          itemName={itemName}
          arbitrationCost={arbitrationCost}
          {...rest}
        />
      )
    case STATUS_CODE.REJECTED:
    case STATUS_CODE.REMOVED:
    case STATUS_CODE.WITHDRAWN:
      return (
        <SubmitModal
          initialValues={item.decodedData}
          submissionDeposit={r?.submissionMinDeposit}
          submissionPeriod={r?.submissionPeriod}
          arbitrationCost={arbitrationCost}
          withdrawingPeriod={r?.withdrawingPeriod}
          challengeStakeMultiplier={r?.challengeStakeMultiplier}
          tcrAddress={r?.id}
          tokenAddress={r?.token}
          metadata={submitMetadata}
          columns={metaEvidence?.metadata?.columns ?? []}
          {...rest}
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
