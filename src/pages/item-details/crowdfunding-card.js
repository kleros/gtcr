import React, { useContext } from 'react'
import { Progress } from 'antd'
import {
  SUBGRAPH_RULING,
  PARTY,
  itemToStatusCode,
  STATUS_CODE
} from 'utils/item-status'
import { TCRViewContext } from 'contexts/tcr-view-context'
import useRequiredFees from 'hooks/required-fees'
import { BigNumber, formatEther } from 'ethers/utils'
import itemPropType from 'prop-types/item'
import BNPropType from 'prop-types/bn'
import useNativeCurrency from 'hooks/native-currency'
import {
  StyledSection,
  StyledTitle,
  StyledParagraph,
  StyledIcon,
  StyledCard,
  StyledContent
} from 'pages/light-item-details/crowdfunding-card'

const CrowdfundingCard = ({ item, timestamp, appealCost }) => {
  const {
    challengePeriodDuration,
    sharedStakeMultiplier,
    winnerStakeMultiplier,
    loserStakeMultiplier,
    MULTIPLIER_DIVISOR
  } = useContext(TCRViewContext)
  const nativeCurrency = useNativeCurrency()

  const requesterFees = useRequiredFees({
    side: PARTY.REQUESTER,
    sharedStakeMultiplier,
    winnerStakeMultiplier,
    loserStakeMultiplier,
    currentRuling: item && item.currentRuling,
    item,
    MULTIPLIER_DIVISOR,
    appealCost
  })
  const challengerFees = useRequiredFees({
    side: PARTY.CHALLENGER,
    sharedStakeMultiplier,
    winnerStakeMultiplier,
    loserStakeMultiplier,
    currentRuling: item && item.currentRuling,
    item,
    MULTIPLIER_DIVISOR,
    appealCost
  })

  if (!item || !challengePeriodDuration) return null
  const round = item.requests[0].rounds[0]
  const { hasPaidRequester, hasPaidChallenger, currentRuling } = round

  let { amountPaidRequester, amountPaidChallenger } = round
  amountPaidRequester = new BigNumber(amountPaidRequester)
  amountPaidChallenger = new BigNumber(amountPaidChallenger)

  if (
    !requesterFees ||
    !challengerFees ||
    !challengerFees.requiredForSide ||
    !challengerFees.potentialReward ||
    !requesterFees.requiredForSide ||
    !requesterFees.potentialReward ||
    !appealCost
  )
    return null

  const statusCode = itemToStatusCode(item, timestamp, challengePeriodDuration)

  if (
    !(
      statusCode === STATUS_CODE.CROWDFUNDING ||
      statusCode === STATUS_CODE.CROWDFUNDING_WINNER
    )
  )
    return null

  const requesterPercentage =
    amountPaidRequester
      .mul(MULTIPLIER_DIVISOR)
      .div(requesterFees.requiredForSide)
      .toNumber() / 100
  const challengerPercentage =
    amountPaidChallenger
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
            percent={hasPaidRequester ? 100 : requesterPercentage}
            status={hasPaidRequester ? 'success' : 'active'}
            showInfo={false}
          />
          <br />
          <StyledParagraph>
            {hasPaidRequester
              ? `Submitter funded. The challenger must now fully fund his side of the appeal before the deadline in order not to lose the dispute.`
              : `Contribute arbitration fees to the submitter's appeal for a chance to win at most ${formatEther(
                  requesterFees.potentialReward
                )} ${nativeCurrency}.`}
          </StyledParagraph>
        </StyledSection>
        <StyledSection>
          <StyledTitle strong level={4}>
            Challenger
          </StyledTitle>
          <Progress
            percent={hasPaidChallenger ? 100 : challengerPercentage}
            status={hasPaidChallenger ? 'success' : 'active'}
            showInfo={false}
          />
          <br />
          <StyledParagraph>
            {hasPaidChallenger
              ? 'Challenger fully funded. The submitter must now fully fund his side of the appeal before the deadline in order not to lose the dispute.'
              : `Contribute arbitration fees to the challenger's appeal for a chance to win at most ${formatEther(
                  challengerFees.potentialReward
                )} ${nativeCurrency}.`}
          </StyledParagraph>
        </StyledSection>
        <StyledSection>
          <StyledIcon icon="info-circle" size="2x" />
          <StyledParagraph>
            {currentRuling === SUBGRAPH_RULING.NONE
              ? 'The arbitrator did not give a decisive ruling. If a party fully funds his side of an appeal, the other must also fund in order to not lose the dispute.'
              : `If the ${
                  currentRuling === SUBGRAPH_RULING.ACCEPT
                    ? 'challenger'
                    : 'submitter'
                } fully funds his side of the appeal, the ${
                  currentRuling === SUBGRAPH_RULING.ACCEPT
                    ? 'submitter'
                    : 'challenger'
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
