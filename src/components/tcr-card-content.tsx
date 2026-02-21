import React, { useEffect, useState } from 'react'
import { Skeleton, Button } from 'components/ui'
import { useParams } from 'react-router-dom'
import { ItemTypes } from '@kleros/gtcr-encoder'
import DisplaySelector from './display-selector'
import { fetchMetaEvidence } from 'hooks/tcr-view'
import useNavigateAndScrollTop from 'hooks/navigate-and-scroll-top'
import { parseIpfs } from 'utils/ipfs-parse'
import {
  StyledItemCol,
  StyledResult,
  Container
} from './light-tcr-card-content'

interface TCRCardContentProps {
  tcrAddress?: string | null
  currentTCRAddress?: string | null
  ID?: string | null
  hideDetailsButton?: boolean
}

const TCRCardContent = ({
  tcrAddress = null,
  currentTCRAddress = null,
  ID = null,
  hideDetailsButton = false
}: TCRCardContentProps) => {
  const { chainId } = useParams()

  const [metaEvidence, setMetaEvidence] = useState()
  const navigateAndScrollTop = useNavigateAndScrollTop()

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
              onClick={() =>
                navigateAndScrollTop(
                  `/tcr/${chainId}/${currentTCRAddress}/${ID}`
                )
              }
            >
              Details
            </Button>
          )}
          <Button
            type="primary"
            onClick={() =>
              navigateAndScrollTop(`/tcr/${chainId}/${tcrAddress}`)
            }
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
