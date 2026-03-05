import React from 'react'
import { Skeleton, Button } from 'components/ui'
import useUrlChainId from 'hooks/use-url-chain-id'
import { ItemTypes } from '@kleros/gtcr-encoder'
import DisplaySelector from './display-selector'
import useNavigateAndScrollTop from 'hooks/navigate-and-scroll-top'
import useTcrMetaEvidence from 'hooks/use-tcr-meta-evidence'
import {
  StyledItemCol,
  StyledResult,
  Container,
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
  hideDetailsButton = false,
}: TCRCardContentProps) => {
  const chainId = useUrlChainId()

  const { data: metaEvidence } = useTcrMetaEvidence(
    tcrAddress ?? undefined,
    chainId ?? undefined,
  )
  const { getLinkProps } = useNavigateAndScrollTop()

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
              {...getLinkProps(`/tcr/${chainId}/${currentTCRAddress}/${ID}`)}
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
