import React, { useContext } from 'react'
import { Card, Typography } from 'antd'
import styled from 'styled-components/macro'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  DISPUTE_STATUS,
  itemToStatusCode,
  STATUS_CODE
} from 'utils/item-status'
import { TCRViewContext } from 'contexts/tcr-view-context'
import itemPropType from 'prop-types/item'
import BNPropType from 'prop-types/bn'
import { WalletContext } from 'contexts/wallet-context'
import getNetworkEnv from 'utils/network-env'

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

const CrowdfundingCard = ({ item, timestamp, request }) => {
  const { networkId } = useContext(WalletContext)
  const { arbitrator: klerosAddress, uiURL } =
    getNetworkEnv('REACT_APP_KLEROS_ADDRESSES', networkId) || {}

  const { disputeID, arbitrator } = request || {}

  const { challengePeriodDuration } = useContext(TCRViewContext)

  if (
    !item ||
    !challengePeriodDuration ||
    item.disputeStatus !== DISPUTE_STATUS.APPEALABLE
  )
    return null

  const statusCode = itemToStatusCode(item, timestamp, challengePeriodDuration)

  if (statusCode === STATUS_CODE.WAITING_ENFORCEMENT) return null

  return (
    <StyledCard>
      <StyledContent>
        <StyledSection>
          <StyledTitle strong level={4}>
            Appeal Phase
          </StyledTitle>
          <StyledIcon icon="coins" size="2x" />
          <StyledParagraph>
            Contribute appeal fees and earn rewards if the side you back wins
            the round.
          </StyledParagraph>
          {klerosAddress.toLowerCase() === arbitrator.toLowerCase() ? (
            <StyledParagraph>
              Please{' '}
              <a href={uiURL.replace(':disputeID', disputeID.toString())}>
                go to the Kleros Court
              </a>{' '}
              to manage this step.
            </StyledParagraph>
          ) : (
            <StyledParagraph>
              The arbitrator that rules the inclusion of this item is not
              compatible with Kleros Court. If you wanted to appeal, please
              request assistance in Telegram.
            </StyledParagraph>
          )}
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
