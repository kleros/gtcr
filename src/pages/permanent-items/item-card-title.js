import React, { useMemo } from 'react'
import styled from 'styled-components'
import { Tooltip, Icon } from 'antd'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import ItemStatusBadge from 'components/permanent-item-status-badge'
import ETHAmount from 'components/eth-amount'
import useHumanizedCountdown from 'hooks/countdown'
import { STATUS_CODE } from 'utils/permanent-item-status'

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 40.5px;
  justify-content: center;
`

export const StatusAndBountyContainer = styled.div`
  display: flex;
  justify-content: space-between;
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

const ItemCardTitle = ({ statusCode, item, registry }) => {
  // Get remaining submission period, if applicable and build countdown.
  const timeUntilValid = useMemo(() => {
    if (
      !['Submitted', 'Reincluded'].includes(item.status) ||
      statusCode === STATUS_CODE.PENDING_WITHDRAWAL
    )
      return

    const deadline =
      item.status === 'Submitted'
        ? Number(item.includedAt) + Number(registry.submissionPeriod)
        : Number(item.includedAt) + Number(registry.reinclusionPeriod)

    return deadline - Date.now()
  }, [item, registry, statusCode])

  const validityCountdown = useHumanizedCountdown(timeUntilValid, 1)

  const bounty = item.stake

  return (
    <Container>
      <StatusAndBountyContainer>
        <ItemStatusBadge statusCode={statusCode} dark />

        {statusCode !== STATUS_CODE.ABSENT && (
          <BountyContainer>
            <Tooltip title="This is the bounty on this item.">
              <ETHAmount amount={bounty} decimals={3} displayUnit={` sDAI`} />
              <StyledFontAwesomeIcon icon="coins" color="white" />
            </Tooltip>
          </BountyContainer>
        )}
      </StatusAndBountyContainer>
      {timeUntilValid > 0 && (
        <CountdownContainer>
          Ends {validityCountdown}
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
