import React from 'react'
import styled from 'styled-components'
import { Button } from 'components/ui'
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
  margin-bottom: 12px;
  text-align: center;
  font-size: 14px;
`

type ItemColumn = Column & { value?: string | number | boolean | null }

interface PermanentItemCardContentProps {
  item: SubgraphItem
  chainId: string | number
  tcrAddress: string
}

const PermanentItemCardContent = ({
  item,
  chainId,
  tcrAddress,
}: PermanentItemCardContentProps) => {
  const { getLinkProps } = useNavigateAndScrollTop()
  const metadata = item.metadata as { props: ItemColumn[] }

  return (
    <Container>
      <div>
        {metadata.props
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
                truncateLinks
                linkImage
              />
            </StyledItemCol>
          ))}
      </div>
      <Button {...getLinkProps(`/tcr/${chainId}/${tcrAddress}/${item.itemID}`)}>
        Details
      </Button>
    </Container>
  )
}

export default React.memo(PermanentItemCardContent)
