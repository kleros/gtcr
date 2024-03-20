import React from 'react'
import PropTypes from 'prop-types'
import DisplaySelector from './display-selector'
import { ItemTypes } from '@kleros/gtcr-encoder'
import { Button } from 'antd'
import useNavigateAndScrollTop from 'hooks/navigate-and-scroll-top'
import { StyledItemCol } from './light-tcr-card-content'
import { Container } from './light-item-card-content'

const ItemCardContent = ({ item, chainId, tcrAddress }) => {
  const navigateAndScrollTop = useNavigateAndScrollTop()

  return (
    <Container>
      <div>
        {item.columns
          .filter(
            col =>
              col.isIdentifier ||
              col.type === ItemTypes.IMAGE ||
              col.type === ItemTypes.FILE
          )
          .map((column, j) => (
            <StyledItemCol key={j}>
              <DisplaySelector
                type={column.type}
                value={column.value}
                allowedFileTypes={column.allowedFileTypes}
              />
            </StyledItemCol>
          ))}
      </div>
      <Button
        onClick={() =>
          navigateAndScrollTop(
            `/tcr/${chainId}/${tcrAddress}/${item.tcrData.ID}`
          )
        }
      >
        Details
      </Button>
    </Container>
  )
}

ItemCardContent.propTypes = {
  item: PropTypes.shape({
    columns: PropTypes.arrayOf(
      PropTypes.shape({
        isIdentifier: PropTypes.bool,
        type: PropTypes.oneOf(Object.values(ItemTypes)),
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
