import React, { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import PropTypes from 'prop-types'
import { Card, Button, Result } from 'antd'
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
  height: 100%;

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
    flex: 1;
  }
`

const StyledCardInfo = styled(Card)`
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  pointer-events: none;
  z-index: 1;

  & > .ant-card-head {
    display: flex;
  }

  & > .ant-card-body {
    align-items: center;
    display: flex;
    flex-direction: column;
    flex: 1;
    justify-content: flex-start;
  }

  & > .ant-card-actions > li {
    margin: 0;
    height: 46px;

    & > span {
      width: 100%;
      height: 100%;
    }
  }
`

const CardLink = styled(Link)`
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  right: 0;
`

const CardBlock = styled.div`
  position: relative;
  height: 100%;
`

const HideCardButton = styled(Button)`
  pointer-events: auto;
  width: 100%;
  height: 100%;
`

const CardItemInfo = ({
  item,
  statusCode,
  tcrAddress,
  metaEvidence,
  toggleReveal,
  forceReveal
}) => {
  let content
  if (item.errors.length > 0)
    content = (
      <Result
        status="warning"
        subTitle={item.errors.map(e => (
          <p>{e}</p>
        ))}
      />
    )
  else
    content = metaEvidence.metadata.isTCRofTCRs ? (
      <TCRCard tcrAddress={item.columns[0].value} />
    ) : (
      <ItemCardContent item={item} />
    )

  return (
    <CardBlock>
      <CardLink to={`/tcr/${tcrAddress}/${item.tcrData.ID}`} />
      <StyledCardInfo
        title={<ItemStatusBadge statusCode={statusCode} dark />}
        actions={
          !forceReveal &&
          toggleReveal && [
            <HideCardButton type="link" onClick={toggleReveal}>
              Hide
            </HideCardButton>
          ]
        }
      >
        {content}
      </StyledCardInfo>
    </CardBlock>
  )
}

CardItemInfo.propTypes = {
  tcrAddress: PropTypes.string.isRequired,
  statusCode: PropTypes.number.isRequired,
  toggleReveal: PropTypes.func,
  forceReveal: PropTypes.bool,
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
        value: PropTypes.string
      })
    ),
    errors: PropTypes.arrayOf(PropTypes.string)
  }).isRequired
}

CardItemInfo.defaultProps = { toggleReveal: null, forceReveal: null }

const ItemCard = ({
  item,
  challengePeriodDuration,
  timestamp,
  forceReveal,
  ...rest
}) => {
  const [revealed, setRevealed] = useState()
  const toggleReveal = useCallback(() => {
    setRevealed(!revealed)
  }, [revealed])
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
            <Button type="primary" onClick={toggleReveal}>
              Reveal
            </Button>
          </CardNSFWWarn>
        </FlipCardFront>
        <FlipCardBack>
          <CardItemInfo
            item={item}
            statusCode={statusCode}
            {...rest}
            toggleReveal={toggleReveal}
            forceReveal={forceReveal}
          />
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
        value: PropTypes.string
      })
    ),
    errors: PropTypes.arrayOf(PropTypes.string)
  }).isRequired
}

ItemCard.defaultProps = {
  forceReveal: null
}

export default ItemCard
