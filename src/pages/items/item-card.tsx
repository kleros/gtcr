import React, { useState, useCallback } from 'react'
import { Card, Button, Result } from 'components/ui'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
// eslint-disable-next-line import/named
import TCRCardContent from 'components/tcr-card-content'
import ItemCardContent from 'components/item-card-content'
import { itemToStatusCode, STATUS_CODE } from 'utils/item-status'
import useCheckPermanentList from 'hooks/use-check-permanent-list'
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

interface CardItemInfoProps {
  item: any
  statusCode: number
  chainId?: string
  tcrAddress: string
  metaEvidence: any
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
  item: any
  challengePeriodDuration: any
  timestamp: any
  forceReveal?: boolean | null
  metaEvidence: any
  chainId?: string
  tcrAddress: string
  [key: string]: any
}

const ItemCard = ({
  item,
  challengePeriodDuration,
  timestamp,
  forceReveal = null,
  metaEvidence,
  chainId,
  tcrAddress,
  ...rest
}: ItemCardProps) => {
  const [revealed, setRevealed] = useState<any>()
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
    statusCode !== STATUS_CODE.REMOVED &&
    statusCode !== STATUS_CODE.CHALLENGED &&
    statusCode !== STATUS_CODE.CROWDFUNDING &&
    statusCode !== STATUS_CODE.CROWDFUNDING_WINNER
  )
    return <CardItemInfo item={item} statusCode={statusCode} metaEvidence={metaEvidence} chainId={chainId} tcrAddress={tcrAddress} {...rest} />

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
            metaEvidence={metaEvidence}
            chainId={chainId}
            tcrAddress={tcrAddress}
            {...rest}
          />
        </FlipCardBack>
      </FlipCardInner>
    </FlipCard>
  )
}


export default ItemCard
