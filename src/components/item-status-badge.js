import React from 'react'
import {
  STATUS_COLOR,
  STATUS_TEXT,
  STATUS_CODE,
  itemToStatusCode
} from '../utils/item-status'
import { Badge, Icon, Skeleton } from 'antd'
import styled from 'styled-components'
import PropTypes from 'prop-types'
import itemPropTypes from '../prop-types/item'
import BNPropType from '../prop-types/bn'

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
  [STATUS_CODE.REGISTERED]: 'check-circle',
  [STATUS_CODE.CHALLENGED]: 'fire',
  [STATUS_CODE.CROWDFUNDING]: 'dollar',
  [STATUS_CODE.CROWDFUNDING_WINNER]: 'dollar',
  [STATUS_CODE.PENDING_REMOVAL]: 'hourglass',
  [STATUS_CODE.PENDING_SUBMISSION]: 'hourglass',
  [STATUS_CODE.REJECTED]: 'close',
  [STATUS_CODE.REMOVED]: 'close',
  [STATUS_CODE.SUBMITTED]: 'hourglass',
  [STATUS_CODE.WAITING_ARBITRATOR]: 'hourglass',
  [STATUS_CODE.WAITING_ENFORCEMENT]: 'hourglass',
  [STATUS_CODE.REMOVAL_REQUESTED]: 'hourglass'
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
    case STATUS_CODE.REMOVED:
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

ItemStatusBadge.propTypes = {
  statusCode: PropTypes.number,
  item: itemPropTypes,
  timestamp: BNPropType,
  challengePeriodDuration: BNPropType,
  dark: PropTypes.bool
}

ItemStatusBadge.defaultProps = {
  item: null,
  statusCode: null,
  timestamp: null,
  challengePeriodDuration: null,
  dark: null
}

export default ItemStatusBadge
