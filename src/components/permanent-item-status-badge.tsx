import React from 'react'
import {
  STATUS_COLOR,
  STATUS_TEXT,
  STATUS_CODE,
} from '../utils/permanent-item-status'
import { Badge, Skeleton } from 'components/ui'
import Icon from 'components/ui/Icon'
import styled from 'styled-components'
import { BigNumber } from 'ethers'

const SkeletonTitleProps = { width: 90 }
const StyledSkeleton = styled(Skeleton)`
  display: inline;

  .ui-skeleton-title {
    margin: -3px 0;
  }
`

export const ItemStatusBadgeWrap = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`

const ItemStatusIconWrap = styled.div`
  margin-left: 6px;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
`

const iconTypes = {
  [STATUS_CODE.ACCEPTED]: 'check-circle',
  [STATUS_CODE.DISPUTED]: 'fire',
  [STATUS_CODE.CROWDFUNDING]: 'dollar',
  [STATUS_CODE.CROWDFUNDING_WINNER]: 'dollar',
  [STATUS_CODE.PENDING]: 'hourglass',
  [STATUS_CODE.PENDING_WITHDRAWAL]: 'hourglass',
  [STATUS_CODE.REJECTED]: 'close',
  [STATUS_CODE.REMOVED]: 'close',
  [STATUS_CODE.WAITING_ARBITRATOR]: 'hourglass',
}

export const ItemStatusIcon = ({ statusCode }: { statusCode: number }) => (
  <ItemStatusIconWrap>
    <Icon type={iconTypes[statusCode]} />
  </ItemStatusIconWrap>
)

// For clarity, here "badge" refers to the status badge UI component,
// and not badges related to connection between TCRs.
export const badgeStatus = (statusCode: number) => {
  switch (statusCode) {
    case STATUS_CODE.CROWDFUNDING:
    case STATUS_CODE.CROWDFUNDING_WINNER:
    case STATUS_CODE.WAITING_ARBITRATOR:
    case STATUS_CODE.DISPUTED:
    case STATUS_CODE.PENDING:
    case STATUS_CODE.PENDING_WITHDRAWAL:
      return 'processing'
    case STATUS_CODE.REJECTED:
    case STATUS_CODE.REMOVED:
    case STATUS_CODE.ACCEPTED:
      return 'default'
    default:
      throw new Error(`Unhandled status code ${statusCode}`)
  }
}

interface ItemStatusBadgeProps {
  item?: SubgraphItem
  timestamp?: BigNumber
  statusCode?: number | null
  dark?: boolean | null
}

const ItemStatusBadge = ({
  item,
  timestamp,
  statusCode,
  _dark,
}: ItemStatusBadgeProps) => {
  if (statusCode)
    return (
      <ItemStatusBadgeWrap>
        <Badge
          status={badgeStatus(statusCode)}
          color={STATUS_COLOR[statusCode]}
          text={STATUS_TEXT[statusCode]}
          style={{ color: 'inherit' }}
        />
        <ItemStatusIcon statusCode={statusCode} />
      </ItemStatusBadgeWrap>
    )

  if (typeof statusCode !== 'number' && !item && !timestamp)
    return (
      <StyledSkeleton active paragraph={false} title={SkeletonTitleProps} />
    )

  return (
    <ItemStatusBadgeWrap>
      <Badge
        status={badgeStatus(statusCode)}
        color={STATUS_COLOR[statusCode]}
        text={STATUS_TEXT[statusCode]}
        style={{ color: 'inherit' }}
      />
      <ItemStatusIcon statusCode={statusCode} />
    </ItemStatusBadgeWrap>
  )
}

export default ItemStatusBadge
