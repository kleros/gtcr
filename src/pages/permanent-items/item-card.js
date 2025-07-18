import React, { useState, useCallback } from 'react'
import styled, { css } from 'styled-components'
import { Card, Button, Result } from 'antd'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import ItemCardContent from 'components/permanent-item-card-content'
import { itemToStatusCode, STATUS_CODE } from 'utils/permanent-item-status'
import ItemCardTitle from './item-card-title'

export const FlipCardInner = styled.div`
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

export const FlipCard = styled.div`
  perspective: 1000px;
`

export const FlipCardFront = styled.div`
  backface-visibility: hidden;
  box-sizing: border-box;
  width: 100%;
  flex: none;
  margin-right: -100%;
`

export const FlipCardBack = styled.div`
  transform: rotateY(180deg);
  backface-visibility: hidden;
  box-sizing: border-box;
  width: 100%;
  flex: none;
`

export const CardNSFWWarn = styled(Card)`
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

export const StyledCardInfo = styled(Card)`
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1;

  & > .ant-card-head {
    display: flex;

    & > .ant-card-head-wrapper {
      width: 100%;
      font-size: 14px;
    }
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

export const CardBlock = styled.div`
  position: relative;
  height: 100%;
`

export const HideCardButton = styled(Button)`
  pointer-events: auto;
  width: 100%;
  height: 100%;
`

const CardItemInfo = ({
  item,
  statusCode,
  registry,
  chainId,
  tcrAddress,
  metadata,
  toggleReveal,
  forceReveal
}) => {
  let content
  const { itemName } = metadata || {}

  if (item.errors && item.errors.length > 0)
    content = (
      <Result
        status="warning"
        subTitle={item.errors.map((e, i) => (
          <p key={i}>{e}</p>
        ))}
      />
    )
  else
    content = (
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
        title={
          <ItemCardTitle
            statusCode={statusCode}
            item={item}
            registry={registry}
          />
        }
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

const ItemCard = ({ item, registry, timestamp, forceReveal, ...rest }) => {
  const [revealed, setRevealed] = useState()
  const toggleReveal = useCallback(() => {
    setRevealed(!revealed)
  }, [revealed])
  if (!registry || !timestamp || !item)
    return <Card style={{ height: '100%' }} loading />

  const statusCode = itemToStatusCode(item, timestamp, registry)

  if (
    statusCode !== STATUS_CODE.ABSENT &&
    statusCode !== STATUS_CODE.DISPUTED &&
    statusCode !== STATUS_CODE.PENDING_WITHDRAWAL &&
    statusCode !== STATUS_CODE.CROWDFUNDING &&
    statusCode !== STATUS_CODE.CROWDFUNDING_WINNER
  )
    return (
      <CardItemInfo
        item={item}
        statusCode={statusCode}
        registry={registry}
        {...rest}
      />
    )

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
            registry={registry}
            toggleReveal={toggleReveal}
            forceReveal={forceReveal}
            {...rest}
          />
        </FlipCardBack>
      </FlipCardInner>
    </FlipCard>
  )
}

export default ItemCard
