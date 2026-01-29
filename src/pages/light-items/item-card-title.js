import React, { useContext, useMemo } from 'react'
import styled from 'styled-components'
import { Tooltip, Icon } from 'antd'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import PropTypes from 'prop-types'
import ItemStatusBadge from 'components/item-status-badge'
import ETHAmount from 'components/eth-amount'
import ItemPropTypes from 'prop-types/item'
import { itemToStatusCode } from 'utils/item-status'
import { WalletContext } from 'contexts/wallet-context'
import { LightTCRViewContext } from 'contexts/light-tcr-view-context'
import useHumanizedCountdown from 'hooks/countdown'
import useNativeCurrency from 'hooks/native-currency'
import { ReactComponent as StakeTag } from 'assets/images/logo-stake-tag.svg'

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 40.5px;
  justify-content: center;
`

export const StatusAndBountyContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`

export const StatusGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

export const RightGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

export const BountyContainer = styled.div`
  display: flex;
  flex-direction: column;
`

export const StyledFontAwesomeIcon = styled(FontAwesomeIcon)`
  margin-left: 6px;
`

export const CountdownContainer = styled.div`
  color: #ffffff5c;
  font-size: 13px;
  margin-left: 12px;
`

export const StyledStakeTag = styled(StakeTag)`
  height: 14px;
  width: auto;
  flex-shrink: 0;

  @media (max-width: 500px) {
    height: 12px;
  }

  /* Dark mode: change background and text colors */
  ${({ theme }) =>
    theme.name === 'dark' &&
    `
    path:first-of-type {
      fill: #5a3490;
    }
    path:last-of-type {
      fill: #e8dff5;
    }
  `}
`

const ItemCardTitle = ({ statusCode, tcrData, isPermanentList }) => {
  const { challengePeriodDuration } = useContext(LightTCRViewContext)
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

  const bounty = tcrData.deposit

  return (
    <Container>
      <StatusAndBountyContainer>
        <StatusGroup>
          <ItemStatusBadge statusCode={statusCode} dark />
        </StatusGroup>
        <RightGroup>
          {challengeRemainingTime > 0 && (
            <BountyContainer>
              <Tooltip title="This is the bounty on this item.">
                <ETHAmount
                  amount={bounty}
                  decimals={3}
                  displayUnit={` ${nativeCurrency}`}
                />
                <StyledFontAwesomeIcon icon="coins" color="white" />
              </Tooltip>
            </BountyContainer>
          )}
          {isPermanentList && <StyledStakeTag />}
        </RightGroup>
      </StatusAndBountyContainer>
      {challengeRemainingTime > 0 && (
        <CountdownContainer>
          Ends {challengeCountdown}
          <Tooltip title="This is the challenge period before this item is accepted into the list.">
            &nbsp;
            <Icon type="question-circle-o" />
          </Tooltip>
        </CountdownContainer>
      )}
    </Container>
  )
}

ItemCardTitle.propTypes = {
  statusCode: PropTypes.number,
  tcrData: ItemPropTypes,
  isPermanentList: PropTypes.bool
}

ItemCardTitle.defaultProps = {
  statusCode: null,
  tcrData: null,
  isPermanentList: false
}

export default ItemCardTitle
