import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import { Result, Skeleton, Button } from 'antd'
import PropTypes from 'prop-types'
import { useWeb3Context } from 'web3-react'
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
  margin-bottom: 8px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
`

export const StyledResult = styled(Result)`
  padding: 0;

  & > .ant-result-title {
    line-height: 1.2;
    font-size: 1.4em;
  }
`

const TCRCardContent = ({
  tcrAddress,
  currentTCRAddress,
  ID,
  hideDetailsButton
}) => {
  const { networkId } = useWeb3Context()

  const [metaEvidence, setMetaEvidence] = useState()
  const navigateAndScrollTop = useNavigateAndScrollTop()

  useEffect(() => {
    ;(async () => {
      const fetchedData = await fetchMetaEvidence(tcrAddress, networkId)

      const response = await fetch(parseIpfs(fetchedData.metaEvidenceURI))
      const file = await response.json()
      setMetaEvidence(file)
    })()
  }, [networkId, tcrAddress])
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
                  `/tcr/${networkId}/${currentTCRAddress}/${ID}`
                )
              }
            >
              Details
            </Button>
          )}
          <Button
            type="primary"
            onClick={() =>
              navigateAndScrollTop(`/tcr/${networkId}/${tcrAddress}`)
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

TCRCardContent.propTypes = {
  tcrAddress: PropTypes.string,
  currentTCRAddress: PropTypes.string,
  ID: PropTypes.string,
  hideDetailsButton: PropTypes.bool
}

TCRCardContent.defaultProps = {
  tcrAddress: null,
  currentTCRAddress: null,
  ID: null,
  hideDetailsButton: false
}

export default TCRCardContent
