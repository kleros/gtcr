import React from 'react'
import PropTypes from 'prop-types'
import {
  Card,
  Descriptions,
  Icon,
  Tooltip,
  Typography,
  Switch,
  Skeleton
} from 'antd'
import styled from 'styled-components/macro'
import EthAddress from './eth-address'
import itemTypes from '../utils/item-types'
import { ZERO_ADDRESS, LOREM_IPSUM } from '../utils/string'
import itemPropTypes from '../prop-types/item'

const SkeletonTitleProps = { width: '150px' }
const StyledSkeleton = styled(Skeleton)`
  display: inline;

  .ant-skeleton-title {
    margin: -3px 0;
  }
`

const DisplaySelector = ({ type, value }) => {
  switch (type) {
    case itemTypes.ADDRESS:
      return <EthAddress address={value || ZERO_ADDRESS} />
    case itemTypes.TEXT:
    case itemTypes.NUMBER:
      return (
        <Typography.Text>
          {value || (
            <StyledSkeleton paragraph={false} title={SkeletonTitleProps} />
          )}
        </Typography.Text>
      )
    case itemTypes.BOOLEAN:
      return <Switch disabled checked={value} />
    case itemTypes.LONGTEXT:
      return <Typography.Paragraph>{value || LOREM_IPSUM}</Typography.Paragraph>
    default:
      throw new Error(`Unhandled type ${type}.`)
  }
}

const ItemDetailsCard = ({ title, columns, loading, item }) => (
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
              value={item && item.decodedData[index]}
            />
          </Descriptions.Item>
        ))}
      </Descriptions>
    )}
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
  loading: PropTypes.bool
}

ItemDetailsCard.defaultProps = {
  columns: null,
  title: null,
  item: null,
  loading: null
}

export default ItemDetailsCard
