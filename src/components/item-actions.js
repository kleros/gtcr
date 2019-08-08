import React from 'react'
import { Descriptions, Button, Skeleton } from 'antd'
import ItemStatus from './item-status'
import { itemToStatusCode, STATUS_CODE } from '../utils/item-status'
import styled from 'styled-components/macro'
import PropTypes from 'prop-types'
import itemPropTypes from '../utils/item-prop-types'
import ETHAddress from './eth-address'

const ItemActionButton = ({ statusCode, itemName }) => {
  if (!statusCode || !itemName)
    return (
      <Button type="primary" disabled loading>
        Loading...
      </Button>
    )

  switch (statusCode) {
    case STATUS_CODE.REJECTED:
      return <Button type="primary">Resubmit {itemName}</Button>
    case STATUS_CODE.REGISTERED:
      return <Button type="primary">Remove {itemName}</Button>
    case STATUS_CODE.SUBMITTED:
      return (
        <Button size="large" type="challenge">
          Challenge Submission
        </Button>
      )
    case STATUS_CODE.REMOVAL_REQUESTED:
      return (
        <Button size="large" type="challenge">
          Challenge Removal
        </Button>
      )
    case STATUS_CODE.CROWDFUNDING:
    case STATUS_CODE.CROWDFUNDING_WINNER:
      return <Button type="primary">Fund Appeal</Button>
    case STATUS_CODE.PENDING_SUBMISSION:
      return <Button type="primary">Execute Submission</Button>
    case STATUS_CODE.PENDING_REMOVAL:
      return <Button type="primary">Execute Removal</Button>
    case STATUS_CODE.CHALLENGED:
    case STATUS_CODE.WAITING_ARBITRATOR:
      return (
        <Button type="primary" disabled>
          Waiting Arbitrator
        </Button>
      )
    default:
      throw new Error(`Unhandled status code ${statusCode}`)
  }
}

const StyledRequestInfo = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
`

const StyledDescriptions = styled(Descriptions)`
  max-width: 500px;
`

const ItemActions = ({
  item,
  itemName,
  challengePeriodDuration,
  timestamp
}) => {
  if (!item || !timestamp || !challengePeriodDuration)
    return <Skeleton active title={false} paragraph={{ rows: 2 }} />

  const statusCode = itemToStatusCode(item, timestamp, challengePeriodDuration)

  return (
    <StyledRequestInfo>
      <StyledDescriptions>
        <Descriptions.Item label="Status" span={2}>
          <ItemStatus
            item={item}
            challengePeriodDuration={challengePeriodDuration}
            timestamp={timestamp}
          />
        </Descriptions.Item>
        <Descriptions.Item label="Requester">
          <ETHAddress address={item.requester} />
        </Descriptions.Item>
      </StyledDescriptions>
      <ItemActionButton statusCode={statusCode} itemName={itemName} />
    </StyledRequestInfo>
  )
}

ItemActions.propTypes = {
  item: itemPropTypes,
  itemName: PropTypes.string,

  // BN.js instances.
  challengePeriodDuration: PropTypes.shape({}),
  timestamp: PropTypes.shape({})
}

ItemActions.defaultProps = {
  item: null,
  itemName: null,
  challengePeriodDuration: null,
  timestamp: null
}

export default ItemActions
