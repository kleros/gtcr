import React from 'react'
import styled from 'styled-components'
import { Button } from 'components/ui'
import DisplaySelector from './display-selector'
import { ItemTypes } from '@kleros/gtcr-encoder'
import useNavigateAndScrollTop from 'hooks/navigate-and-scroll-top'
import SeerCardContent from 'components/custom-registries/seer/seer-card-content'
import { isSeerRegistry } from 'components/custom-registries/seer/is-seer-registry'

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

interface LightItemCardContentProps {
  item: SubgraphItem
  chainId: string | number
  tcrAddress: string
}

const LightItemCardContent = ({
  item,
  chainId,
  tcrAddress,
}: LightItemCardContentProps) => {
  const { getLinkProps } = useNavigateAndScrollTop()
  const columns = item.columns as ItemColumn[]
  const tcrData = item.tcrData as { ID: string; mergedData: ItemColumn[] }
  const seerMarketData = item.seerMarketData as
    | { marketName?: string; outcomes?: string[] }
    | undefined

  const allowedFileTypes =
    columns.filter((col) => col.allowedFileTypes)[0]?.allowedFileTypes || ''

  return (
    <Container>
      <div>
        {tcrData.mergedData
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
                allowedFileTypes={allowedFileTypes}
                truncateLinks
                linkImage
              />
            </StyledItemCol>
          ))}
        {isSeerRegistry(tcrAddress, chainId) && item && (
          <SeerCardContent
            chainId={chainId}
            contractAddress={columns[1].value as string}
            marketName={seerMarketData?.marketName}
            outcomes={seerMarketData?.outcomes}
          />
        )}
      </div>
      <Button {...getLinkProps(`/tcr/${chainId}/${tcrAddress}/${tcrData.ID}`)}>
        Details
      </Button>
    </Container>
  )
}

export default React.memo(LightItemCardContent)
