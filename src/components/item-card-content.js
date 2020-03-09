import React from 'react'
import styled from 'styled-components/macro'
import PropTypes from 'prop-types'
import DisplaySelector from './display-selector'
import itemTypes from '../utils/item-types'

const StyledItemCol = styled.div`
  margin-bottom: 8px;
  text-align: center;
`

const ItemCardContent = ({ item }) =>
  item.columns
    .filter(col => col.isIdentifier || col.type === itemTypes.IMAGE)
    .map((column, j) => (
      <StyledItemCol key={j}>
        <DisplaySelector type={column.type} value={column.value} />
      </StyledItemCol>
    ))

ItemCardContent.propTypes = {
  item: PropTypes.shape({
    columns: PropTypes.arrayOf(
      PropTypes.shape({
        isIdentifier: PropTypes.bool,
        type: PropTypes.oneOf(Object.values(itemTypes)),
        value: PropTypes.oneOf([
          PropTypes.bool,
          PropTypes.string,
          PropTypes.number,
          PropTypes.object
        ])
      })
    )
  }).isRequired
}

export default ItemCardContent
