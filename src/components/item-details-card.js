import React from 'react'
import PropTypes from 'prop-types'
import {
  Card,
  Descriptions,
  Icon,
  Tooltip,
  Typography,
  Switch,
  Divider
} from 'antd'
import EthAddress from './eth-address'
import itemTypes from '../utils/item-types'
import { ZERO_ADDRESS, LOREM_IPSUM } from '../utils/string'
import ItemStatus from './item-status'
import itemPropTypes from '../utils/item-prop-types'

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

const ItemDetailsCard = ({
  title,
  columns,
  loading,
  item,
  timestamp,
  challengePeriodDuration,
  statusCode
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
            <DisplaySelector
              type={column.type}
              value={item && item.data[index]}
            />
          </Descriptions.Item>
        ))}
      </Descriptions>
    )}
    <Divider />
    <Descriptions>
      <Descriptions.Item label="Status" span={3}>
        <ItemStatus
          item={item}
          challengePeriodDuration={challengePeriodDuration}
          timestamp={timestamp}
          statusCode={statusCode}
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
  item: itemPropTypes,
  loading: PropTypes.bool,
  statusCode: PropTypes.number,

  // BN.js instances.
  timestamp: PropTypes.shape({}),
  challengePeriodDuration: PropTypes.shape({})
}

ItemDetailsCard.defaultProps = {
  columns: null,
  title: null,
  item: null,
  loading: null,
  statusCode: 0,
  timestamp: null,
  challengePeriodDuration: null
}

export default ItemDetailsCard
