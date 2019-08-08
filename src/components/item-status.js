import React from 'react'
import {
  STATUS_COLOR,
  STATUS_TEXT,
  STATUS_CODE,
  itemToStatusCode
} from '../utils/item-status'
import { Badge, Skeleton } from 'antd'
import styled from 'styled-components/macro'
import PropTypes from 'prop-types'
import itemPropTypes from '../utils/item-prop-types'

const SkeletonTitleProps = { width: 90 }
const StyledSkeleton = styled(Skeleton)`
  display: inline;

  .ant-skeleton-title {
    margin: -3px 0;
  }
`

const badgeStatus = statusCode => {
  switch (statusCode) {
    case STATUS_CODE.REMOVAL_REQUESTED:
    case STATUS_CODE.SUBMITTED:
    case STATUS_CODE.WAITING_ARBITRATOR:
    case STATUS_CODE.CROWDFUNDING:
    case STATUS_CODE.CROWDFUNDING_WINNER:
    case STATUS_CODE.PENDING_SUBMISSION:
    case STATUS_CODE.PENDING_REMOVAL:
      return 'processing'
    case STATUS_CODE.REJECTED:
    case STATUS_CODE.REGISTERED:
      return 'default'
    default:
      throw new Error(`Unhandled status code ${statusCode}`)
  }
}

const ItemStatus = ({
  item,
  timestamp,
  challengePeriodDuration,
  statusCode
}) => {
  if (statusCode)
    return (
      <Badge
        status={badgeStatus(statusCode)}
        color={STATUS_COLOR[statusCode]}
        text={STATUS_TEXT[statusCode]}
      />
    )

  if (!item || !timestamp || !challengePeriodDuration)
    return (
      <StyledSkeleton active paragraph={false} title={SkeletonTitleProps} />
    )

  statusCode = itemToStatusCode(item, timestamp, challengePeriodDuration)

  return (
    <Badge
      status={badgeStatus(statusCode)}
      color={STATUS_COLOR[statusCode]}
      text={STATUS_TEXT[statusCode]}
    />
  )
}

ItemStatus.propTypes = {
  statusCode: PropTypes.number,
  item: itemPropTypes,

  // BN.js instances
  timestamp: PropTypes.shape({}),
  challengePeriodDuration: PropTypes.shape({})
}

ItemStatus.defaultProps = {
  item: null,
  statusCode: null,
  timestamp: null,
  challengePeriodDuration: null
}

export default ItemStatus
