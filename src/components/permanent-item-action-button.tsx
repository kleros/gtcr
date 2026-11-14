import React from 'react'
import styled from 'styled-components'
import { Button, type ButtonVariant } from 'components/curate/primitives'
import { STATUS_CODE } from 'utils/permanent-item-status'

/*
 * The one action a Stake Curate item offers in each status, as a button whose
 * label is a verb and whose amounts (token stake + arbitration in the
 * chain's currency) are spelled out next to it. While jurors are deciding
 * there is nothing to do: the item page shows "Add evidence" instead, and
 * this button, if rendered, is disabled and says why.
 */

/** Sentence-case label for the action an item offers in a status. */
export const stakeActionLabel = ({
  statusCode,
  itemName = 'item',
}: {
  statusCode: number
  itemName?: string
}): string => {
  switch (statusCode) {
    case STATUS_CODE.REJECTED:
    case STATUS_CODE.REMOVED:
    case STATUS_CODE.WITHDRAWN:
      return `Resubmit ${itemName}`
    case STATUS_CODE.PENDING:
    case STATUS_CODE.ACCEPTED:
      return `Challenge ${itemName}`
    case STATUS_CODE.CROWDFUNDING:
    case STATUS_CODE.CROWDFUNDING_WINNER:
      return 'Fund an appeal'
    case STATUS_CODE.DISPUTED:
      return 'Jurors deciding'
    case STATUS_CODE.WAITING_ARBITRATOR:
      return 'Awaiting ruling'
    case STATUS_CODE.PENDING_WITHDRAWAL:
      return 'Execute withdrawal'
    default:
      throw new Error(`Unhandled status code ${statusCode}`)
  }
}

/** Statuses in which nobody can act on the item until the arbitrator does. */
export const isPassiveStatus = (statusCode: number): boolean =>
  statusCode === STATUS_CODE.DISPUTED ||
  statusCode === STATUS_CODE.WAITING_ARBITRATOR

/* Wraps when both amounts do not fit on one line (phones). */
const ActionButton = styled(Button)`
  flex-wrap: wrap;
  column-gap: 6px;
  row-gap: 0;
  height: auto;
  min-height: 44px;
  padding: 10px 18px;
  white-space: normal;
  text-align: center;
`

/* Set apart by weight, not opacity: faded white falls under 4.5:1 on the blue fill. */
const Amounts = styled.span`
  font-weight: 400;
  font-variant-numeric: tabular-nums;
`

interface ItemActionButtonProps {
  statusCode?: number | null
  itemName?: string | null
  itemID?: string | null
  onClick?: (() => void) | null
  type?: ButtonVariant | null
  /** "60 sDAI + 36 xDAI": the exact amounts the action sends. */
  amounts?: React.ReactNode
  disabled?: boolean
  /** Why the button is disabled ("Connect a wallet to challenge"). */
  blocker?: string
  loading?: boolean
  block?: boolean
  /** Lets a page render the button twice (rail and phone bar) with distinct ids. */
  id?: string
}

const ItemActionButton = ({
  statusCode,
  itemName,
  itemID,
  onClick,
  type,
  amounts,
  disabled,
  blocker,
  loading,
  block,
  id = 'item-action-button',
}: ItemActionButtonProps) => {
  if ((!statusCode && statusCode !== 0) || !itemName || !itemID)
    return (
      <ActionButton
        id={id}
        type="button"
        $variant={type ?? 'primary'}
        $block={block}
        disabled
        aria-disabled
      >
        Loading…
      </ActionButton>
    )

  const passive = isPassiveStatus(statusCode)
  const isDisabled = Boolean(disabled || passive || loading)
  const reason = passive ? 'Nothing to do until the arbitrator rules' : blocker

  return (
    <ActionButton
      id={id}
      type="button"
      $variant={type ?? 'primary'}
      $block={block}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      title={isDisabled ? reason : undefined}
      onClick={onClick ?? undefined}
    >
      {loading ? (
        'Waiting for your wallet…'
      ) : (
        <>
          <span>{stakeActionLabel({ statusCode, itemName })}</span>
          {amounts && <Amounts>· {amounts}</Amounts>}
        </>
      )}
    </ActionButton>
  )
}

export default ItemActionButton
