import React from 'react'
import styled from 'styled-components/macro'
import PropTypes from 'prop-types'
import DisplaySelector from './display-selector'
import itemTypes from '../utils/item-types'
import { Button } from 'antd'

const StyledItemCol = styled.div`
  margin-bottom: 8px;
  text-align: center;
`

const StyledButton = styled(Button)`
  pointer-events: auto;
`

const ItemCardContent = ({ item, tcrAddress, itemName }) => (
  <>
    {item.columns
      .filter(col => col.isIdentifier || col.type === itemTypes.IMAGE)
      .map((column, j) => (
        <StyledItemCol key={j}>
          <DisplaySelector type={column.type} value={column.value} />
        </StyledItemCol>
      ))}
    <StyledButton
      href={`/tcr/${tcrAddress}/${item.tcrData.ID}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      {itemName || 'Item'} Details
    </StyledButton>
  </>
)

ItemCardContent.propTypes = {
  item: PropTypes.shape({
    columns: PropTypes.arrayOf(
      PropTypes.shape({
        isIdentifier: PropTypes.bool,
        type: PropTypes.oneOf(Object.values(itemTypes)),
        value: PropTypes.oneOfType([
          PropTypes.bool,
          PropTypes.string,
          PropTypes.number,
          PropTypes.object
        ])
      })
    ),
    tcrData: PropTypes.shape({
      ID: PropTypes.string.isRequired
    }).isRequired
  }).isRequired,
  tcrAddress: PropTypes.string.isRequired,
  itemName: PropTypes.string.isRequired
}

export default ItemCardContent
