import React, { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import PropTypes from 'prop-types'
import { Card, Button } from 'antd'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import ItemStatusBadge from '../../components/item-status-badge'
import TCRCard from '../../components/tcr-card-content'
import ItemCardContent from '../../components/item-card-content'
import BNPropType from '../../prop-types/bn'
import { itemToStatusCode, STATUS_CODE } from '../../utils/item-status'
// eslint-disable-next-line import/named
import styled, { css } from 'styled-components/macro'

const FlipCardInner = styled.div`
  text-align: center;
  transition: transform 0.6s;
  transform-style: preserve-3d;
  display: flex;
  flex-flow: row nowrap;
  ${({ revealed }) =>
    revealed &&
    css`
      transform: rotateY(180deg);
    `}
`

const FlipCard = styled.div`
  perspective: 1000px;
`

const FlipCardFront = styled.div`
  backface-visibility: hidden;
  box-sizing: border-box;
  width: 100%;
  flex: none;
  margin-right: -100%;
`

const FlipCardBack = styled.div`
  transform: rotateY(180deg);
  backface-visibility: hidden;
  box-sizing: border-box;
  width: 100%;
  flex: none;
`

const CardNSFWWarn = styled(Card)`
  height: 100%;
  color: white;
  background: rgba(0, 0, 0, 0)
    linear-gradient(111.6deg, rgb(77, 0, 180) 46.25%, rgb(101, 0, 180) 96.25%)
    repeat scroll 0% 0%;

  & > .ant-card-body {
    align-items: center;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
  }
`

const StyledCardInfo = styled(Card)`
  height: 100%;

  & > .ant-card-head {
    display: flex;
  }
`

const CardItemInfo = ({ item, statusCode, tcrAddress, metaEvidence }) => (
  <Link to={`/tcr/${tcrAddress}/${item.tcrData.ID}`}>
    <StyledCardInfo title={<ItemStatusBadge statusCode={statusCode} dark />}>
      {metaEvidence.metadata.isTCRofTCRs ? (
        <TCRCard tcrAddress={item.columns[0].value} />
      ) : (
        <ItemCardContent item={item} />
      )}
    </StyledCardInfo>
  </Link>
)

CardItemInfo.propTypes = {
  tcrAddress: PropTypes.string.isRequired,
  statusCode: PropTypes.number.isRequired,
  metaEvidence: PropTypes.shape({
    metadata: PropTypes.shape({
      isTCRofTCRs: PropTypes.bool
    }).isRequired
  }).isRequired,
  item: PropTypes.shape({
    tcrData: PropTypes.shape({
      ID: PropTypes.string
    }),
    columns: PropTypes.arrayOf(
      PropTypes.shape({
        value: PropTypes.string.isRequired
      })
    )
  }).isRequired
}

const ItemCard = ({
  item,
  challengePeriodDuration,
  timestamp,
  forceReveal,
  ...rest
}) => {
  const [revealed, setRevealed] = useState()
  const onReveal = useCallback(() => {
    setRevealed(true)
  }, [])
  if (!challengePeriodDuration || !timestamp || !item)
    return <Card style={{ height: '100%' }} loading {...rest} />

  const statusCode = itemToStatusCode(
    item.tcrData,
    timestamp,
    challengePeriodDuration
  )

  if (
    statusCode !== STATUS_CODE.REJECTED &&
    statusCode !== STATUS_CODE.CHALLENGED &&
    statusCode !== STATUS_CODE.CROWDFUNDING &&
    statusCode !== STATUS_CODE.CROWDFUNDING_WINNER
  )
    return <CardItemInfo item={item} statusCode={statusCode} {...rest} />

  return (
    <FlipCard>
      <FlipCardInner revealed={forceReveal || revealed}>
        <FlipCardFront>
          <CardNSFWWarn>
            <FontAwesomeIcon icon="exclamation-triangle" size="2x" />
            <p>Warning: potentially offensive content</p>
            <Button type="primary" onClick={onReveal}>
              Reveal
            </Button>
          </CardNSFWWarn>
        </FlipCardFront>
        <FlipCardBack>
          <CardItemInfo item={item} statusCode={statusCode} {...rest} />
        </FlipCardBack>
      </FlipCardInner>
    </FlipCard>
  )
}

ItemCard.propTypes = {
  tcrAddress: PropTypes.string.isRequired,
  challengePeriodDuration: BNPropType.isRequired,
  forceReveal: PropTypes.bool,
  timestamp: BNPropType.isRequired,
  metaEvidence: PropTypes.shape({
    metadata: PropTypes.shape({
      isTCRofTCRs: PropTypes.bool
    }).isRequired
  }).isRequired,
  item: PropTypes.shape({
    tcrData: PropTypes.shape({
      ID: PropTypes.string
    }),
    columns: PropTypes.arrayOf(
      PropTypes.shape({
        value: PropTypes.string.isRequired
      })
    )
  }).isRequired
}

ItemCard.defaultProps = {
  forceReveal: null
}

export default ItemCard
