import React from 'react'
import PropTypes from 'prop-types'
import { STATUS_CODE, getActionLabel } from '../utils/item-status'
import { Button } from 'antd'

const ItemActionButton = ({ statusCode, itemName, itemID, onClick, type }) => {
  if ((!statusCode && statusCode !== 0) || !itemName || !itemID)
    return (
      <Button type={type || 'primary'} disabled loading>
        Loading...
      </Button>
    )

  return (
    <Button
      type={type || 'primary'}
      onClick={onClick}
      disabled={
        statusCode === STATUS_CODE.WAITING_ARBITRATOR ||
        statusCode === STATUS_CODE.CHALLENGED ||
        statusCode === STATUS_CODE.WAITING_ENFORCEMENT
      }
    >
      {getActionLabel({ statusCode, itemName })}
    </Button>
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
