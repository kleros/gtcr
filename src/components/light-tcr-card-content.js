import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components/macro'
import { useWeb3Context } from 'web3-react'
import { Result, Skeleton, Button } from 'antd'
import { ItemTypes } from '@kleros/gtcr-encoder'
import DisplaySelector from './display-selector'
import { Link } from 'react-router-dom'
import { fetchMetaEvidence } from 'hooks/tcr-view'
import { parseIpfs } from 'utils/ipfs-parse'

const StyledItemCol = styled.div`
  margin-bottom: 8px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
`

const StyledResult = styled(Result)`
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
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}
      >
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
            <Link to={`/tcr/${networkId}/${currentTCRAddress}/${ID}`}>
              <Button>Details</Button>
            </Link>
          )}
          <Link
            to={`/tcr/${networkId}/${tcrAddress}`}
            style={{ marginLeft: '12px' }}
          >
            <Button type="primary">Open List</Button>
          </Link>
        </StyledItemCol>
      </div>
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
