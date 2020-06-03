import React, { useContext, useMemo } from 'react'
import { Tooltip } from 'antd'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import PropTypes from 'prop-types'
import ItemStatusBadge from '../../components/item-status-badge'
import ETHAmount from '../../components/eth-amount'
import ItemPropTypes from '../../prop-types/item'
import { itemToStatusCode, STATUS_CODE } from '../../utils/item-status'
import { WalletContext } from '../../bootstrap/wallet-context'
import { TCRViewContext } from '../../bootstrap/tcr-view-context'
import useHumanizedCountdown from '../../hooks/countdown'

const ItemCardTitle = ({ statusCode, tcrData }) => {
  const {
    submissionBaseDeposit,
    removalBaseDeposit,
    challengePeriodDuration
  } = useContext(TCRViewContext)
  const { timestamp } = useContext(WalletContext)
  const { disputed, submissionTime } = tcrData || {}

  // Get remaining challenge period, if applicable and build countdown.
  const challengeRemainingTime = useMemo(() => {
    if (!tcrData || disputed || !submissionTime || !challengePeriodDuration)
      return

    const deadline =
      submissionTime.add(challengePeriodDuration).toNumber() * 1000

    return deadline - Date.now()
  }, [challengePeriodDuration, disputed, submissionTime, tcrData])

  const challengeCountdown = useHumanizedCountdown(challengeRemainingTime, 1)

  if (typeof statusCode !== 'number')
    statusCode = itemToStatusCode(tcrData, timestamp, challengePeriodDuration)

  let bounty
  if (typeof statusCode === 'number')
    if (statusCode === STATUS_CODE.SUBMITTED) bounty = submissionBaseDeposit
    else if (statusCode === STATUS_CODE.REMOVAL_REQUESTED)
      bounty = removalBaseDeposit

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '40.5px',
        justifyContent: 'center'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <ItemStatusBadge statusCode={statusCode} dark />
        {bounty && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Tooltip title="This is the bounty on this item.">
              <ETHAmount amount={bounty} decimals={3} displayUnit />
              <FontAwesomeIcon
                icon="coins"
                color="white"
                style={{ marginLeft: '6px' }}
              />
            </Tooltip>
          </div>
        )}
      </div>
      {bounty && (
        <div
          style={{
            color: '#ffffff5c',
            fontSize: '13px',
            marginLeft: '12px'
          }}
        >
          Ends {challengeCountdown}
        </div>
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
