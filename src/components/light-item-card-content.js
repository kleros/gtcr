import React from 'react'
import styled from 'styled-components/macro'
import PropTypes from 'prop-types'
import DisplaySelector from './display-selector'
import { ItemTypes } from '@kleros/gtcr-encoder'
import { Button } from 'antd'
import useNavigateAndScrollTop from 'hooks/navigate-and-scroll-top'

export const Container = styled.div`
  display: flex;
  height: 100%;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
`

export const StyledItemCol = styled.div`
  margin-bottom: 8px;
  text-align: center;
`

const LightItemCardContent = ({ item, chainId, tcrAddress }) => {
  const navigateAndScrollTop = useNavigateAndScrollTop()

  const allowedFileTypes =
    item.columns.filter(col => col.allowedFileTypes)[0]?.allowedFileTypes || ''

  return (
    <Container>
      <div>
        {item.tcrData.mergedData
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
                allowedFileTypes={allowedFileTypes}
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

LightItemCardContent.propTypes = {
  item: PropTypes.shape({
    tcrData: PropTypes.shape({
      ID: PropTypes.string.isRequired,
      mergedData: PropTypes.arrayOf(
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
      )
    }).isRequired
  }).isRequired,
  tcrAddress: PropTypes.string.isRequired
}

export default LightItemCardContent
