import React, { useContext } from 'react'
import { Tooltip } from 'antd'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import PropTypes from 'prop-types'
import ItemStatusBadge from '../../components/item-status-badge'
import ETHAmount from '../../components/eth-amount'
import ItemPropTypes from '../../prop-types/item'
import { itemToStatusCode, STATUS_CODE } from '../../utils/item-status'
import { WalletContext } from '../../bootstrap/wallet-context'
import { TCRViewContext } from '../../bootstrap/tcr-view-context'

const ItemCardTitle = ({ statusCode, tcrData }) => {
  const {
    submissionBaseDeposit,
    removalBaseDeposit,
    challengePeriodDuration
  } = useContext(TCRViewContext)
  const { timestamp } = useContext(WalletContext)

  if (typeof statusCode !== 'number')
    statusCode = itemToStatusCode(tcrData, timestamp, challengePeriodDuration)

  let bounty
  if (typeof statusCode === 'number')
    if (statusCode === STATUS_CODE.SUBMITTED) bounty = submissionBaseDeposit
    else if (statusCode === STATUS_CODE.REMOVAL_REQUESTED)
      bounty = removalBaseDeposit

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <ItemStatusBadge statusCode={statusCode} dark />
      {bounty && (
        <Tooltip title="This is the bounty on this item.">
          <ETHAmount amount={bounty} decimals={3} displayUnit />
          <FontAwesomeIcon
            icon="coins"
            color="white"
            style={{ marginLeft: '6px' }}
          />
        </Tooltip>
      )}
    </div>
  )
}

ItemCardTitle.propTypes = {
  statusCode: PropTypes.number,
  tcrData: ItemPropTypes
}

ItemCardTitle.defaultProps = {
  statusCode: null,
  tcrData: null
}

export default ItemCardTitle
