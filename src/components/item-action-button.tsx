import React from 'react'
import {
  Button,
  Status,
  type ButtonVariant,
} from 'components/curate/primitives'
import { STATUS_CODE } from 'utils/item-status'

/*
 * The one action an entry offers in its current status (DESIGN.md: verbs on
 * buttons, sentence case, the exact amount on the button). While jurors are
 * deciding there is no action, so the status is shown instead of a disabled
 * "Waiting Arbitrator" button.
 */

export const itemActionLabel = (
  statusCode: number,
  itemName?: string | null,
): string => {
  const name = itemName || 'item'
  switch (statusCode) {
    case STATUS_CODE.REJECTED:
    case STATUS_CODE.REMOVED:
      return `Resubmit ${name}`
    case STATUS_CODE.REGISTERED:
      return `Remove ${name}`
    case STATUS_CODE.SUBMITTED:
      return 'Challenge submission'
    case STATUS_CODE.REMOVAL_REQUESTED:
      return 'Challenge removal'
    case STATUS_CODE.CROWDFUNDING:
    case STATUS_CODE.CROWDFUNDING_WINNER:
      return 'Contribute fees'
    case STATUS_CODE.PENDING_SUBMISSION:
      return 'Execute submission'
    case STATUS_CODE.PENDING_REMOVAL:
      return 'Execute removal'
    case STATUS_CODE.CHALLENGED:
      return 'Challenged'
    case STATUS_CODE.WAITING_ARBITRATOR:
      return 'Awaiting ruling'
    case STATUS_CODE.WAITING_ENFORCEMENT:
      return 'Ruling final'
    default:
      return 'Loading'
  }
}

const variantOf = (type?: string | null): ButtonVariant =>
  type === 'secondary'
    ? 'secondary'
    : type === 'danger'
      ? 'danger'
      : type === 'ghost'
        ? 'ghost'
        : 'primary'

interface ItemActionButtonProps {
  statusCode?: number | null
  itemName?: string | null
  itemID?: string | null
  onClick?: (() => void) | null
  /** primary (default), secondary, ghost or danger. */
  type?: string | null
  /** The exact amount sent by the action, repeated on the button. */
  amount?: React.ReactNode
  disabled?: boolean
  /** Why the button is disabled, named in the tooltip. */
  blocker?: string
  loading?: boolean
  block?: boolean
  size?: 'sm' | 'md'
}

const ItemActionButton = ({
  statusCode,
  itemName,
  itemID,
  onClick,
  type,
  amount,
  disabled,
  blocker,
  loading,
  block,
  size,
}: ItemActionButtonProps) => {
  if ((!statusCode && statusCode !== 0) || !itemName || !itemID)
    return (
      <Button
        id="item-action-button"
        type="button"
        $variant={variantOf(type)}
        $block={block}
        $size={size}
        disabled
        aria-disabled
      >
        Loading…
      </Button>
    )

  if (statusCode === STATUS_CODE.CHALLENGED)
    return (
      <Status tone="contested" label="Challenged" detail="jurors deciding" />
    )
  if (statusCode === STATUS_CODE.WAITING_ARBITRATOR)
    return (
      <Status
        tone="contested"
        label="Awaiting ruling"
        detail="appeal period over"
      />
    )
  if (statusCode === STATUS_CODE.WAITING_ENFORCEMENT)
    return (
      <Status
        tone="contested"
        label="Ruling final"
        detail="awaiting enforcement"
      />
    )

  const isDisabled = !!disabled || !!loading
  return (
    <Button
      id="item-action-button"
      type="button"
      $variant={variantOf(type)}
      $block={block}
      $size={size}
      onClick={onClick ?? undefined}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      title={disabled ? blocker : undefined}
    >
      {loading
        ? 'Waiting for your wallet…'
        : itemActionLabel(statusCode, itemName)}
      {!loading && amount ? <span>· {amount}</span> : null}
    </Button>
  )
}

export default ItemActionButton
