import React from 'react'
import styled from 'styled-components'
import { Button } from 'antd'
import PropTypes from 'prop-types'
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
                truncateLinks
              />
            </StyledItemCol>
          ))}
        {isSeerRegistry(tcrAddress, chainId) && item && (
          <SeerCardContent
            chainId={chainId}
            contractAddress={item.columns[1].value}
            imagesIpfsHash={item.columns[0].value}
            marketName={item.seerMarketData?.marketName}
            outcomes={item.seerMarketData?.outcomes}
            smallDisplay
          />
        )}
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
