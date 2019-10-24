import React from 'react'
import PropTypes from 'prop-types'
import { Card, Icon, Tooltip } from 'antd'
import itemPropTypes from '../prop-types/item'
import DisplaySelector from './display-selector'
import styled from 'styled-components/macro'

const StyledFields = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
`

const StyledField = styled.div`
  margin-bottom: 16px;
  margin-right: 16px;
`

const ItemDetailsCard = ({ title, columns, loading, item }) => (
  <Card title={title} loading={loading}>
    {columns && (
      <StyledFields>
        {columns.map((column, index) => (
          <StyledField key={index}>
            <span>
              {column.label}
              {column.description && (
                <Tooltip title={column.description}>
                  &nbsp;
                  <Icon type="question-circle-o" />
                </Tooltip>
              )}
            </span>
            :{' '}
            <DisplaySelector
              type={column.type}
              value={item && item.decodedData[index]}
            />
          </StyledField>
        ))}
      </StyledFields>
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
