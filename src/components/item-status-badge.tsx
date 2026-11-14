import React, { useMemo } from 'react'
import type { BigNumber } from 'ethers'
import { STATUS_CODE } from 'utils/item-status'
import useNow from 'hooks/use-now'
import { SkeletonBlock } from 'components/curate/primitives'
import {
  EntryStatus,
  lightEntryStatus,
  type EntryStatusView,
} from 'components/curate/entry-status'

/*
 * Entry status as a dot and a plain label with the time left (DESIGN.md).
 * Given an item, it derives the status and its deadline from the request
 * data; given only a status code, it shows the label without a countdown.
 */

const viewFromCode = (statusCode: number): EntryStatusView | undefined => {
  switch (statusCode) {
    case STATUS_CODE.REGISTERED:
      return { code: statusCode, tone: 'registered', label: 'Registered' }
    case STATUS_CODE.SUBMITTED:
      return {
        code: statusCode,
        tone: 'window',
        label: 'Submitted',
        detail: 'challenge window open',
      }
    case STATUS_CODE.REMOVAL_REQUESTED:
      return {
        code: statusCode,
        tone: 'window',
        label: 'Removal requested',
        detail: 'challenge window open',
      }
    case STATUS_CODE.PENDING_SUBMISSION:
      return {
        code: statusCode,
        tone: 'neutral',
        label: 'Ready to execute',
        detail: 'unchallenged submission',
      }
    case STATUS_CODE.PENDING_REMOVAL:
      return {
        code: statusCode,
        tone: 'neutral',
        label: 'Ready to execute',
        detail: 'unchallenged removal',
      }
    case STATUS_CODE.CHALLENGED:
      return {
        code: statusCode,
        tone: 'contested',
        label: 'Challenged',
        detail: 'jurors deciding',
      }
    case STATUS_CODE.CROWDFUNDING:
      return { code: statusCode, tone: 'contested', label: 'Appeal open' }
    case STATUS_CODE.CROWDFUNDING_WINNER:
      return {
        code: statusCode,
        tone: 'contested',
        label: 'Appeal · winner funding',
      }
    case STATUS_CODE.WAITING_ARBITRATOR:
      return {
        code: statusCode,
        tone: 'contested',
        label: 'Awaiting ruling',
        detail: 'appeal period over',
      }
    case STATUS_CODE.WAITING_ENFORCEMENT:
      return {
        code: statusCode,
        tone: 'contested',
        label: 'Ruling final',
        detail: 'awaiting enforcement',
      }
    case STATUS_CODE.REJECTED:
      return { code: statusCode, tone: 'off', label: 'Rejected' }
    case STATUS_CODE.REMOVED:
      return { code: statusCode, tone: 'off', label: 'Removed' }
    default:
      return undefined
  }
}

interface ItemStatusBadgeProps {
  item?: SubgraphItem | null
  timestamp?: BigNumber | null
  challengePeriodDuration?: BigNumber | null
  statusCode?: number | null
  /** Kept for callers; the status roles follow the theme on their own. */
  dark?: boolean | null
}

const ItemStatusBadge = ({
  item,
  timestamp,
  challengePeriodDuration,
  statusCode,
}: ItemStatusBadgeProps) => {
  const now = useNow()
  const view = useMemo(
    () =>
      typeof statusCode === 'number'
        ? viewFromCode(statusCode)
        : lightEntryStatus(
            item ?? undefined,
            timestamp,
            challengePeriodDuration,
          ),
    [statusCode, item, timestamp, challengePeriodDuration],
  )

  // Status can't be determined yet (clock/params still loading, or the item
  // has no requests indexed): show a skeleton instead of crashing the view.
  if (!view) return <SkeletonBlock $height="18px" $width="120px" />

  return <EntryStatus status={view} now={now} />
}

export default ItemStatusBadge
