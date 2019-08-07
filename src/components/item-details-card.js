import React from 'react'
import PropTypes from 'prop-types'
import {
  Card,
  Descriptions,
  Icon,
  Tooltip,
  Typography,
  Switch,
  Divider,
  Badge
} from 'antd'
import EthAddress from './eth-address'
import itemTypes from '../utils/item-types'
import { ZERO_ADDRESS, LOREM_IPSUM } from '../utils/string'
import { STATUS_CODE, STATUS_COLOR, STATUS_TEXT } from '../utils/item-status'

const DisplaySelector = ({ type, value }) => {
  switch (type) {
    case itemTypes.ADDRESS:
      return <EthAddress address={value || ZERO_ADDRESS} />
    case itemTypes.TEXT:
    case itemTypes.NUMBER:
      return <Typography.Text>{value || 'XYZ'}</Typography.Text>
    case itemTypes.BOOLEAN:
      return <Switch disabled checked={value} />
    case itemTypes.LONGTEXT:
      return <Typography.Paragraph>{value || LOREM_IPSUM}</Typography.Paragraph>
    default:
      throw new Error(`Unhandled type ${type}.`)
  }
}

const badgeStatus = statusCode => {
  switch (statusCode) {
    case STATUS_CODE.REMOVAL_REQUESTED:
    case STATUS_CODE.SUBMITTED:
    case STATUS_CODE.WAITING_ARBITRATOR:
    case STATUS_CODE.CROWDFUNDING:
    case STATUS_CODE.CROWDFUNDING_WINNER:
    case STATUS_CODE.PENDING_EXECUTION:
      return 'processing'
    case STATUS_CODE.REJECTED:
    case STATUS_CODE.REGISTERED:
      return 'default'
    default:
      throw new Error(`Unhandled status code ${statusCode}`)
  }
}

const ItemDetailsCard = ({
  title,
  columns,
  data,
  loading,
  statusCode = STATUS_CODE.REGISTERED
}) => (
  <Card title={title} loading={loading}>
    {columns && (
      <Descriptions>
        {columns.map((column, index) => (
          <Descriptions.Item
            key={index}
            label={
              <span>
                {column.label}
                {column.description && (
                  <Tooltip title={column.description}>
                    &nbsp;
                    <Icon type="question-circle-o" />
                  </Tooltip>
                )}
              </span>
            }
          >
            <DisplaySelector type={column.type} value={data && data[index]} />
          </Descriptions.Item>
        ))}
      </Descriptions>
    )}
    <Divider />
    <Descriptions>
      <Descriptions.Item label="Status" span={3}>
        <Badge
          status={badgeStatus(statusCode)}
          color={STATUS_COLOR[statusCode]}
          text={STATUS_TEXT[statusCode]}
        />
      </Descriptions.Item>
    </Descriptions>
  </Card>
)

ItemDetailsCard.propTypes = {
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      type: PropTypes.string.isRequired,
      description: PropTypes.string.isRequired
    })
  ),
  title: PropTypes.string,
  data: PropTypes.objectOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.bool,
      PropTypes.number,
      PropTypes.shape({})
    ])
  ),
  loading: PropTypes.bool,
  statusCode: PropTypes.number
}

ItemDetailsCard.defaultProps = {
  columns: null,
  title: null,
  data: null,
  loading: null,
  statusCode: 0
}

export default ItemDetailsCard
