import React from 'react'
import PropTypes from 'prop-types'
import { Button } from 'antd'
import styled from 'styled-components'
import { STATUS_CODE, getActionLabel } from '../utils/permanent-item-status'

const StyledButton = styled(Button)`
  text-transform: capitalize;
`

const ItemActionButton = ({ statusCode, itemName, itemID, onClick, type }) => {
  if ((!statusCode && statusCode !== 0) || !itemName || !itemID)
    return (
      <Button id="item-action-button" type={type || 'primary'} disabled loading>
        Loading...
      </Button>
    )

  const disabled =
    statusCode === STATUS_CODE.WAITING_ARBITRATOR ||
    statusCode === STATUS_CODE.DISPUTED

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
              color: 'white'
            }
          : null
      }
    >
      {getActionLabel({ statusCode, itemName })}
    </StyledButton>
  )
}

ItemActionButton.propTypes = {
  statusCode: PropTypes.number,
  itemName: PropTypes.string,
  itemID: PropTypes.string,
  onClick: PropTypes.func,
  type: PropTypes.string
}

ItemActionButton.defaultProps = {
  statusCode: null,
  itemName: null,
  itemID: null,
  onClick: null,
  type: null
}

export default ItemActionButton
