import React from 'react'
import styled from 'styled-components/macro'
import PropTypes from 'prop-types'
import DisplaySelector from './display-selector'
import itemTypes from '../utils/item-types'
import { Button } from 'antd'
import { Link } from 'react-router-dom'

const StyledItemCol = styled.div`
  margin-bottom: 8px;
  text-align: center;
`

const StyledButton = styled(Button)`
  pointer-events: auto;
`

const ItemCardContent = ({ item, tcrAddress }) => (
  <div
    style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between'
    }}
  >
    <div>
      {item.columns
        .filter(col => col.isIdentifier || col.type === itemTypes.IMAGE)
        .map((column, j) => (
          <StyledItemCol key={j}>
            <DisplaySelector type={column.type} value={column.value} />
          </StyledItemCol>
        ))}
    </div>
    <Link to={`/tcr/${tcrAddress}/${item.tcrData.ID}`}>
      <StyledButton>Details</StyledButton>
    </Link>
  </div>
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
  tcrAddress: PropTypes.string.isRequired
}

export default ItemCardContent
