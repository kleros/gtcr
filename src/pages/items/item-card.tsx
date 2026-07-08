import React, { useState, useCallback } from 'react'
import { BigNumber } from 'ethers'
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
  StyledCardInfo,
  EnrichedItem,
} from 'pages/light-items/item-card'

interface CardItemInfoProps {
  item: EnrichedItem
  statusCode: number
  chainId?: number | null
  tcrAddress: string
  metaEvidence?: MetaEvidence
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
  forceReveal = null,
}: CardItemInfoProps) => {
  let content
  const { metadata } = metaEvidence || {}
  const { isTCRofTCRs } = metadata || {}
  const childTcrAddress = isTCRofTCRs ? (item.columns[0]?.value ?? null) : null

  const { isPermanentList } = useCheckPermanentList(
    childTcrAddress,
    chainId ?? null,
  )

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
    content = isTCRofTCRs ? (
      <TCRCardContent
        ID={item.tcrData.ID}
        tcrAddress={item.columns[0]?.value}
        currentTCRAddress={tcrAddress}
      />
    ) : chainId != null ? (
      <ItemCardContent item={item} chainId={chainId} tcrAddress={tcrAddress} />
    ) : null

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
            <HideCardButton key="hide" type="link" onClick={toggleReveal}>
              Hide
            </HideCardButton>,
          ]
        }
      >
        {content}
      </StyledCardInfo>
    </CardBlock>
  )
}

interface ItemCardProps {
  item: EnrichedItem
  challengePeriodDuration?: BigNumber
  timestamp?: BigNumber
  forceReveal?: boolean | null
  metaEvidence?: MetaEvidence
  chainId?: number | null
  tcrAddress: string
}

const ItemCard = ({
  item,
  challengePeriodDuration,
  timestamp,
  forceReveal = null,
  metaEvidence,
  chainId,
  tcrAddress,
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
    challengePeriodDuration,
  )

  if (statusCode === undefined)
    return <Card style={{ height: '100%' }} loading />

  if (
    statusCode !== STATUS_CODE.REJECTED &&
    statusCode !== STATUS_CODE.REMOVED &&
    statusCode !== STATUS_CODE.CHALLENGED &&
    statusCode !== STATUS_CODE.CROWDFUNDING &&
    statusCode !== STATUS_CODE.CROWDFUNDING_WINNER
  )
    return (
      <CardItemInfo
        item={item}
        statusCode={statusCode}
        metaEvidence={metaEvidence}
        chainId={chainId}
        tcrAddress={tcrAddress}
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
            toggleReveal={toggleReveal}
            forceReveal={forceReveal}
            metaEvidence={metaEvidence}
            chainId={chainId}
            tcrAddress={tcrAddress}
          />
        </FlipCardBack>
      </FlipCardInner>
    </FlipCard>
  )
}

export default React.memo(ItemCard)
