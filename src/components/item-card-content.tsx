import React from 'react'
import DisplaySelector from './display-selector'
import { ItemTypes } from '@kleros/gtcr-encoder'
import { Button } from 'components/ui'
import useNavigateAndScrollTop from 'hooks/navigate-and-scroll-top'
import { StyledItemCol } from './light-tcr-card-content'
import { Container } from './light-item-card-content'

interface ItemCardContentProps {
  item: SubgraphItem
  chainId: string | number
  tcrAddress: string
}

const ItemCardContent = ({
  item,
  chainId,
  tcrAddress,
}: ItemCardContentProps) => {
  const { getLinkProps } = useNavigateAndScrollTop()

  return (
    <Container>
      <div>
        {item.columns
          .filter(
            (col) =>
              col.isIdentifier ||
              col.type === ItemTypes.IMAGE ||
              col.type === ItemTypes.FILE,
          )
          .map((column, j) => (
            <StyledItemCol key={j}>
              <DisplaySelector
                type={column.type}
                value={column.value}
                allowedFileTypes={column.allowedFileTypes}
                truncateLinks
              />
            </StyledItemCol>
          ))}
      </div>
      <Button
        {...getLinkProps(
          `/tcr/${chainId}/${tcrAddress}/${item.tcrData.ID}`,
        )}
      >
        Details
      </Button>
    </Container>
  )
}

export default React.memo(ItemCardContent)
