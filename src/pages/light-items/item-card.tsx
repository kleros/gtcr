import React, { useState, useCallback } from 'react'
import styled, { css } from 'styled-components'
import { Card, Button, Result } from 'components/ui'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import TCRCardContent from 'components/light-tcr-card-content'
import ItemCardContent from 'components/light-item-card-content'
import { itemToStatusCode, STATUS_CODE } from 'utils/item-status'
import useCheckPermanentList from 'hooks/use-check-permanent-list'
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

export const CardNSFWWarn = styled.div`
  height: 100%;
  color: white;
  background: ${({ theme }) => theme.cardHeaderGradient};
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-around;
  padding: 24px;

  p,
  svg {
    color: white;
    fill: white;
  }

  p {
    font-size: 14px;
  }
`

export const StyledCardInfo = styled(Card)`
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1;
  background: ${({ theme }) => theme.componentBackground};
  border-color: ${({ theme }) => theme.borderColor};
  transition: background 0.3s ease, border-color 0.3s ease;

  & > .ui-card-head {
    display: flex;
    background: ${({ theme }) => theme.cardHeaderGradient};
    color: white;
    border-color: ${({ theme }) =>
      theme.name === 'dark' ? theme.borderColor : 'transparent'};

    & > .ui-card-head-wrapper {
      width: 100%;
      font-size: 14px;

      .ui-card-head-title {
        color: white;
      }
      .ui-card-extra {
        color: white;
      }
    }
  }

  & > .ui-card-body {
    align-items: center;
    display: flex;
    flex-direction: column;
    flex: 1;
    justify-content: flex-start;
    color: ${({ theme }) => theme.textPrimary};
  }

  & > .ui-card-actions {
    background: ${({ theme }) => theme.componentBackground};
    border-color: ${({ theme }) => theme.borderColor};
  }

  & > .ui-card-actions > li {
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

interface CardItemInfoProps {
  item: SubgraphItem
  statusCode: number
  chainId?: string
  tcrAddress: string
  metaEvidence: MetaEvidence
  toggleReveal?: (() => void) | null
  forceReveal?: boolean | null
}

const CardItemInfo = ({
  item,
  statusCode,
  chainId,
  tcrAddress,
  metaEvidence,
  toggleReveal = null,
  forceReveal = null
}: CardItemInfoProps) => {
  let content
  const { metadata } = metaEvidence || {}
  const { itemName, isTCRofTCRs } = metadata || {}
  const childTcrAddress = isTCRofTCRs ? item.columns[0]?.value : null

  const { isPermanentList } = useCheckPermanentList(childTcrAddress, chainId)

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
        title={
          <ItemCardTitle
            statusCode={statusCode}
            tcrData={item.tcrData}
            isPermanentList={isPermanentList}
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

interface ItemCardProps {
  item: SubgraphItem
  challengePeriodDuration: BigNumber
  timestamp: BigNumber
  forceReveal?: boolean | null
  [key: string]: unknown
}

const ItemCard = ({
  item,
  challengePeriodDuration,
  timestamp,
  forceReveal = null,
  ...rest
}: ItemCardProps) => {
  const [revealed, setRevealed] = useState<boolean | undefined>()
  const toggleReveal = useCallback(() => {
    setRevealed(!revealed)
  }, [revealed])
  if (!challengePeriodDuration || !timestamp || !item)
    return <Card style={{ height: '100%' }} loading />

  const statusCode = itemToStatusCode(
    item.tcrData,
    timestamp,
    challengePeriodDuration
  )

  if (
    statusCode !== STATUS_CODE.REJECTED &&
    statusCode !== STATUS_CODE.REMOVED &&
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


export default React.memo(ItemCard)
