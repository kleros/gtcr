import React from 'react'
import styled from 'styled-components'
import { Button } from 'antd'
import DisplaySelector from './display-selector'
import { ItemTypes } from '@kleros/gtcr-encoder'
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

const PermanentItemCardContent = ({ item, chainId, tcrAddress }) => {
  const navigateAndScrollTop = useNavigateAndScrollTop()

  return (
    <Container>
      <div>
        {item.metadata.props
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
                allowedFileTypes={[]}
                truncateLinks
              />
            </StyledItemCol>
          ))}
      </div>
      <Button
        onClick={() =>
          navigateAndScrollTop(`/tcr/${chainId}/${tcrAddress}/${item.itemID}`)
        }
      >
        Details
      </Button>
    </Container>
  )
}

export default PermanentItemCardContent
