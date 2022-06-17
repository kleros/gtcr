import React from 'react'
import {
  STATUS_COLOR,
  STATUS_TEXT,
  STATUS_CODE,
  itemToStatusCode
} from '../utils/helpers/item-status'
import { Badge, Skeleton } from 'antd'
import styled from 'styled-components/macro'

const SkeletonTitleProps = { width: 90 }
const StyledSkeleton = styled(Skeleton)`
  display: inline;

  .ant-skeleton-title {
    margin: -3px 0;
  }
`

// For clarity, here "badge" refers to the ant design component,
// and not badges related to connection between TCRs.
const badgeStatus = statusCode => {
  switch (statusCode) {
    case STATUS_CODE.REMOVAL_REQUESTED:
    case STATUS_CODE.SUBMITTED:
    case STATUS_CODE.WAITING_ARBITRATOR:
    case STATUS_CODE.CROWDFUNDING:
    case STATUS_CODE.CROWDFUNDING_WINNER:
    case STATUS_CODE.PENDING_SUBMISSION:
    case STATUS_CODE.PENDING_REMOVAL:
    case STATUS_CODE.CHALLENGED:
    case STATUS_CODE.WAITING_ENFORCEMENT:
      return 'processing'
    case STATUS_CODE.REJECTED:
    case STATUS_CODE.REGISTERED:
      return 'default'
    default:
      throw new Error(`Unhandled status code ${statusCode}`)
  }
}

// A wrapper around antdesign's badge component.
const ItemStatusBadge = ({
  item,
  timestamp,
  challengePeriodDuration,
  statusCode,
  dark
}) => {
  if (statusCode)
    return (
      <Badge
        status={badgeStatus(statusCode)}
        color={STATUS_COLOR[statusCode]}
        text={STATUS_TEXT[statusCode]}
        style={{ color: dark ? 'white' : '' }}
      />
    )

  if (
    typeof statusCode !== 'number' &&
    !item &&
    !timestamp &&
    !challengePeriodDuration
  )
    return (
      <StyledSkeleton active paragraph={false} title={SkeletonTitleProps} />
    )

  if (typeof statusCode !== 'number')
    statusCode = itemToStatusCode(item, timestamp, challengePeriodDuration)

  return (
    <Badge
      status={badgeStatus(statusCode)}
      color={STATUS_COLOR[statusCode]}
      text={STATUS_TEXT[statusCode]}
      style={{ color: dark ? 'white' : '' }}
    />
  )
}

export default ItemStatusBadge
