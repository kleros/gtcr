import React, { useContext, useMemo } from 'react'
import { Tooltip, Icon } from 'antd'
import ItemStatusBadge from 'components/item-status-badge'
import ETHAmount from 'components/eth-amount'
import { itemToStatusCode } from 'utils/item-status'
import { WalletContext } from 'contexts/wallet-context'
import { TCRViewContext } from 'contexts/tcr-view-context'
import useHumanizedCountdown from 'hooks/countdown'
import useNativeCurrency from 'hooks/native-currency'
import {
  Container,
  StatusAndBountyContainer,
  BountyContainer,
  StyledFontAwesomeIcon,
  CountdownContainer
} from 'pages/light-items/item-card-title'

const ItemCardTitle = ({ statusCode, tcrData }) => {
  const { challengePeriodDuration } = useContext(TCRViewContext)
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
  const bounty = tcrData.deposit

  if (typeof statusCode !== 'number')
    statusCode = itemToStatusCode(tcrData, timestamp, challengePeriodDuration)

  return (
    <Container>
      <StatusAndBountyContainer>
        <ItemStatusBadge statusCode={statusCode} dark />
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

export default ItemCardTitle
