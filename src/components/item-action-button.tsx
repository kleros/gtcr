import React from 'react'
import { Button } from 'components/ui'
import styled, { useTheme } from 'styled-components'
import { STATUS_CODE, getActionLabel } from '../utils/item-status'

const StyledButton = styled(Button)`
  text-transform: capitalize;
`

interface ItemActionButtonProps {
  statusCode?: number | null
  itemName?: string | null
  itemID?: string | null
  onClick?: (() => void) | null
  type?: string | null
}

const ItemActionButton = ({
  statusCode,
  itemName,
  itemID,
  onClick,
  type,
}: ItemActionButtonProps) => {
  const theme = useTheme()
  if ((!statusCode && statusCode !== 0) || !itemName || !itemID)
    return (
      <Button id="item-action-button" type={type || 'primary'} disabled loading>
        Loading...
      </Button>
    )

  const disabled =
    statusCode === STATUS_CODE.WAITING_ARBITRATOR ||
    statusCode === STATUS_CODE.CHALLENGED ||
    statusCode === STATUS_CODE.WAITING_ENFORCEMENT

  return (
    <StyledButton
      id="item-action-button"
      type={type || 'primary'}
      onClick={onClick}
      disabled={disabled}
      style={
        disabled
          ? {
              backgroundColor: 'transparent',
              border: 'none',
              color: theme.textPrimary,
            }
          : null
      }
    >
      {getActionLabel({ statusCode, itemName })}
    </StyledButton>
  )
}

export default ItemActionButton
