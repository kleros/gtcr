import React, { useState, useCallback } from 'react'
import PropTypes from 'prop-types'
import { Card, Button, Result } from 'antd'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
// eslint-disable-next-line import/named
import TCRCardContent from 'components/tcr-card-content'
import ItemCardContent from 'components/item-card-content'
import BNPropType from 'prop-types/bn'
import { itemToStatusCode, STATUS_CODE } from 'utils/item-status'
import ItemCardTitle from './item-card-title'
import {
  FlipCardBack,
  FlipCardFront,
  FlipCardInner,
  CardBlock,
  HideCardButton,
  FlipCard,
  CardNSFWWarn,
  StyledCardInfo
} from 'pages/light-items/item-card'

const CardItemInfo = ({
  item,
  statusCode,
  chainId,
  tcrAddress,
  metaEvidence,
  toggleReveal,
  forceReveal
}) => {
  let content
  const { metadata } = metaEvidence || {}
  const { itemName, isTCRofTCRs } = metadata || {}

  if (item.errors.length > 0)
    content = (
      <Result
        status="warning"
        subTitle={item.errors.map((e, i) => (
          <p key={i}>{e}</p>
        ))}
      />
    )
  else
    content = isTCRofTCRs ? (
      <TCRCardContent
        ID={item.tcrData.ID}
        tcrAddress={item.columns[0].value}
        itemName={itemName}
        currentTCRAddress={tcrAddress}
      />
    ) : (
      <ItemCardContent
        item={item}
        chainId={chainId}
        tcrAddress={tcrAddress}
        itemName={itemName}
      />
    )

  return (
    <CardBlock>
      <StyledCardInfo
        title={<ItemCardTitle statusCode={statusCode} tcrData={item.tcrData} />}
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
              Show
            </Button>
          </CardNSFWWarn>
        </FlipCardFront>
        <FlipCardBack>
          <CardItemInfo
            item={item}
            statusCode={statusCode}
            toggleReveal={toggleReveal}
            forceReveal={forceReveal}
            {...rest}
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
