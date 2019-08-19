import React from 'react'
import PropTypes from 'prop-types'
import { STATUS_CODE, getActionLabel } from '../utils/item-status'
import { Button } from 'antd'

const ItemActionButton = ({ statusCode, itemName, itemID, onClick }) => {
  if ((!statusCode && statusCode !== 0) || !itemName || !itemID)
    return (
      <Button type="primary" disabled loading>
        Loading...
      </Button>
    )

  return (
    <Button
      type="primary"
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
  onClick: PropTypes.func
}

ItemActionButton.defaultProps = {
  statusCode: null,
  itemName: null,
  itemID: null,
  onClick: null
}

export default ItemActionButton
