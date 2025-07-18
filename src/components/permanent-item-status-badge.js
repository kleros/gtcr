import React from 'react'
import {
  STATUS_COLOR,
  STATUS_TEXT,
  STATUS_CODE
} from '../utils/permanent-item-status'
import { Badge, Icon, Skeleton } from 'antd'
import styled from 'styled-components'

const SkeletonTitleProps = { width: 90 }
const StyledSkeleton = styled(Skeleton)`
  display: inline;

  .ant-skeleton-title {
    margin: -3px 0;
  }
`

const ItemStatusBadgeWrap = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`

const ItemStatusIconWrap = styled.div`
  margin-left: 8px;
`

const iconTypes = {
  [STATUS_CODE.ACCEPTED]: 'check-circle',
  [STATUS_CODE.DISPUTED]: 'fire',
  [STATUS_CODE.CROWDFUNDING]: 'dollar',
  [STATUS_CODE.CROWDFUNDING_WINNER]: 'dollar',
  [STATUS_CODE.PENDING]: 'hourglass',
  [STATUS_CODE.PENDING_WITHDRAWAL]: 'hourglass',
  [STATUS_CODE.ABSENT]: 'close',
  [STATUS_CODE.WAITING_ARBITRATOR]: 'hourglass'
}

const ItemStatusIcon = ({ statusCode }) => (
  <ItemStatusIconWrap>
    <Icon type={iconTypes[statusCode]} />
  </ItemStatusIconWrap>
)

// For clarity, here "badge" refers to the ant design component,
// and not badges related to connection between TCRs.
const badgeStatus = statusCode => {
  switch (statusCode) {
    case STATUS_CODE.CROWDFUNDING:
    case STATUS_CODE.CROWDFUNDING_WINNER:
    case STATUS_CODE.WAITING_ARBITRATOR:
    case STATUS_CODE.DISPUTED:
    case STATUS_CODE.PENDING:
    case STATUS_CODE.PENDING_WITHDRAWAL:
      return 'processing'
    case STATUS_CODE.ABSENT:
    case STATUS_CODE.ACCEPTED:
      return 'default'
    default:
      throw new Error(`Unhandled status code ${statusCode}`)
  }
}

// A wrapper around antdesign's badge component.
const ItemStatusBadge = ({ item, timestamp, statusCode, dark }) => {
  if (statusCode)
    return (
      <ItemStatusBadgeWrap>
        <Badge
          status={badgeStatus(statusCode)}
          color={STATUS_COLOR[statusCode]}
          text={STATUS_TEXT[statusCode]}
          style={{ color: dark ? 'white' : '' }}
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
        style={{ color: dark ? 'white' : '' }}
      />
      <ItemStatusIcon statusCode={statusCode} />
    </ItemStatusBadgeWrap>
  )
}

export default ItemStatusBadge
