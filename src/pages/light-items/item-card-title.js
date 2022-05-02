import React, { useContext, useMemo } from 'react'
import { Tooltip, Icon } from 'antd'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import PropTypes from 'prop-types'
import ItemStatusBadge from 'components/item-status-badge'
import ETHAmount from 'components/eth-amount'
import ItemPropTypes from 'prop-types/item'
import { itemToStatusCode, STATUS_CODE } from 'utils/item-status'
import { WalletContext } from 'contexts/wallet-context'
import { LightTCRViewContext } from 'contexts/light-tcr-view-context'
import useHumanizedCountdown from 'hooks/countdown'
import useNativeCurrency from 'hooks/native-currency'

const ItemCardTitle = ({ statusCode, tcrData }) => {
  const {
    submissionBaseDeposit,
    removalBaseDeposit,
    challengePeriodDuration
  } = useContext(LightTCRViewContext)
  const { timestamp } = useContext(WalletContext)
  const { disputed, submissionTime } = tcrData || {}
  const nativeCurrency = useNativeCurrency()

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
              <ETHAmount
                amount={bounty}
                decimals={3}
                displayUnit={` ${nativeCurrency}`}
              />
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
          <Tooltip title="This is the challenge period before this item is accepted into the list.">
            &nbsp;
            <Icon type="question-circle-o" />
          </Tooltip>
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
