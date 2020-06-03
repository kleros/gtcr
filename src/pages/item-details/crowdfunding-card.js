import React, { useContext } from 'react'
import { Card, Typography, Progress } from 'antd'
import styled from 'styled-components/macro'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  DISPUTE_STATUS,
  PARTY,
  itemToStatusCode,
  STATUS_CODE
} from '../../utils/item-status'
import { TCRViewContext } from '../../bootstrap/tcr-view-context'
import useRequiredFees from '../../hooks/required-fees'
import { formatEther } from 'ethers/utils'
import itemPropType from '../../prop-types/item'
import BNPropType from '../../prop-types/bn'

const StyledCard = styled(Card)`
  background: linear-gradient(111.6deg, #4d00b4 46.25%, #6500b4 96.25%);
  color: white;
  margin: 40px 0 20px;
`

const StyledContent = styled.div`
  display: flex;
  justify-content: space-between;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`

const StyledSection = styled.div`
  display: flex;
  flex: 1 1 0px;
  flex-direction: column;
  align-items: center;
  margin: 12px;

  @media (max-width: 768px) {
    flex-direction: column;
    width: auto;
  }
`

const StyledTitle = styled(Typography.Title)`
  color: white !important;
  text-align: center;
`

const StyledParagraph = styled(Typography.Paragraph)`
  color: white;
  text-align: center;
`

const StyledIcon = styled(FontAwesomeIcon)`
  margin: 12px;
`

const CrowdfundingCard = ({ item, timestamp }) => {
  const {
    challengePeriodDuration,
    sharedStakeMultiplier,
    winnerStakeMultiplier,
    loserStakeMultiplier,
    MULTIPLIER_DIVISOR
  } = useContext(TCRViewContext)

  const requesterFees = useRequiredFees({
    side: PARTY.REQUESTER,
    sharedStakeMultiplier,
    winnerStakeMultiplier,
    loserStakeMultiplier,
    currentRuling: item && item.currentRuling,
    item,
    MULTIPLIER_DIVISOR
  })
  const challengerFees = useRequiredFees({
    side: PARTY.CHALLENGER,
    sharedStakeMultiplier,
    winnerStakeMultiplier,
    loserStakeMultiplier,
    currentRuling: item && item.currentRuling,
    item,
    MULTIPLIER_DIVISOR
  })

  if (
    !item ||
    !challengePeriodDuration ||
    item.disputeStatus !== DISPUTE_STATUS.APPEALABLE
  )
    return null

  const { hasPaid, amountPaid, currentRuling } = item

  if (
    !challengerFees.requiredForSide ||
    !challengerFees.potentialReward ||
    !requesterFees.requiredForSide ||
    !requesterFees.potentialReward
  )
    return null

  const statusCode = itemToStatusCode(item, timestamp, challengePeriodDuration)

  if (statusCode === STATUS_CODE.WAITING_ENFORCEMENT) return null

  const requesterPercentage =
    amountPaid[PARTY.REQUESTER]
      .mul(MULTIPLIER_DIVISOR)
      .div(requesterFees.requiredForSide)
      .toNumber() / 100
  const challengerPercentage =
    amountPaid[PARTY.CHALLENGER]
      .mul(MULTIPLIER_DIVISOR)
      .div(challengerFees.requiredForSide)
      .toNumber() / 100

  return (
    <StyledCard>
      <StyledContent>
        <StyledSection>
          <StyledTitle strong level={4}>
            Appeal Crowdfunding
          </StyledTitle>
          <StyledIcon icon="coins" size="2x" />
          <StyledParagraph>
            Contribute appeal fees and earn rewards if the side you back wins
            the round
          </StyledParagraph>
        </StyledSection>
        <StyledSection>
          <StyledTitle strong level={4}>
            Submitter
          </StyledTitle>
          <Progress
            percent={hasPaid[PARTY.REQUESTER] ? 100 : requesterPercentage}
            status={hasPaid[PARTY.REQUESTER] ? 'success' : 'active'}
            showInfo={false}
          />
          <br />
          <StyledParagraph>
            {hasPaid[PARTY.REQUESTER]
              ? `Submitter funded. The challenger must now fully fund his side of the appeal before the deadline in order not to lose the dispute.`
              : `Contribute arbitration fees to the submitter's appeal for a chance to win up to ${formatEther(
                  requesterFees.potentialReward
                )} ETH.`}
          </StyledParagraph>
        </StyledSection>
        <StyledSection>
          <StyledTitle strong level={4}>
            Challenger
          </StyledTitle>
          <Progress
            percent={hasPaid[PARTY.CHALLENGER] ? 100 : challengerPercentage}
            status={hasPaid[PARTY.CHALLENGER] ? 'success' : 'active'}
            showInfo={false}
          />
          <br />
          <StyledParagraph>
            {hasPaid[PARTY.CHALLENGER]
              ? 'Challenger fully funded. The submitter must now fully fund his side of the appeal before the deadline in order not to lose the dispute.'
              : `Contribute arbitration fees to the challenger's appeal for a chance to win up to ${formatEther(
                  challengerFees.potentialReward
                )} ETH.`}
          </StyledParagraph>
        </StyledSection>
        <StyledSection>
          <StyledIcon icon="info-circle" size="2x" />
          <StyledParagraph>
            {currentRuling === PARTY.NONE
              ? 'The arbitrator did not give a decisive ruling. If a party fully funds his side of an appeal, the other must also fund in order to not lose the dispute.'
              : `If the ${
                  currentRuling === PARTY.REQUESTER ? 'challenger' : 'submitter'
                } fully funds his side of the appeal, the ${
                  currentRuling === PARTY.REQUESTER ? 'submitter' : 'challenger'
                } must also fund his side of the appeal in order not to lose the case.`}
          </StyledParagraph>
        </StyledSection>
      </StyledContent>
    </StyledCard>
  )
}

CrowdfundingCard.propTypes = {
  item: itemPropType,
  timestamp: BNPropType
}

CrowdfundingCard.defaultProps = {
  item: null,
  timestamp: null
}

export default CrowdfundingCard
