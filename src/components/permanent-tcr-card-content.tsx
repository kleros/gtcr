import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import { Result, Skeleton, Button } from 'components/ui'
import { useParams } from 'react-router-dom'
import { ItemTypes } from '@kleros/gtcr-encoder'
import DisplaySelector from './display-selector'
import { fetchMetaEvidence } from 'hooks/tcr-view'
import useNavigateAndScrollTop from 'hooks/navigate-and-scroll-top'
import { parseIpfs } from 'utils/ipfs-parse'

export const Container = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
`

export const StyledItemCol = styled.div`
  margin-bottom: 12px;
  text-align: center;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
`

export const StyledResult = styled(Result)`
  padding: 0;

  & > .ui-result-title {
    line-height: 1.2;
    font-size: 1.4em;
  }
`

interface TCRCardContentProps {
  tcrAddress?: string | null
  currentTCRAddress?: string | null
  ID?: string | null
  hideDetailsButton?: boolean
}

const TCRCardContent = ({
  tcrAddress,
  currentTCRAddress,
  ID,
  hideDetailsButton,
}: TCRCardContentProps) => {
  const { chainId } = useParams()

  const [metaEvidence, setMetaEvidence] = useState()
  const { getLinkProps } = useNavigateAndScrollTop()

  useEffect(() => {
    ;(async () => {
      const fetchedData = await fetchMetaEvidence(tcrAddress, chainId)
      const response = await fetch(parseIpfs(fetchedData.metaEvidenceURI))
      const file = await response.json()
      setMetaEvidence(file)
    })()
  }, [chainId, tcrAddress])
  const { metadata } = metaEvidence || {}

  if (!metaEvidence) return <Skeleton active />

  if (!metadata)
    return (
      <StyledResult
        status="warning"
        subTitle="Missing metadata field on list meta evidence."
      />
    )

  try {
    return (
      <Container>
        <div>
          <StyledItemCol>
            <DisplaySelector type={ItemTypes.IMAGE} value={metadata.logoURI} />
          </StyledItemCol>
          <StyledItemCol>
            <DisplaySelector type={ItemTypes.TEXT} value={metadata.tcrTitle} />
          </StyledItemCol>
        </div>
        <StyledItemCol>
          {!hideDetailsButton && (
            <Button
              {...getLinkProps(
                `/tcr/${chainId}/${currentTCRAddress}/${ID}`,
              )}
            >
              Details
            </Button>
          )}
          <Button
            type="primary"
            {...getLinkProps(`/tcr/${chainId}/${tcrAddress}`)}
            style={{ marginLeft: '12px' }}
          >
            Open List
          </Button>
        </StyledItemCol>
      </Container>
    )
  } catch (err) {
    return <StyledResult status="warning" subTitle={err.message} />
  }
}

export default TCRCardContent
