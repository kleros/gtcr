import React, { useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components/macro'
import { useWeb3Context } from 'web3-react'
import { ethers } from 'ethers'
import { Result, Skeleton, Button } from 'antd'
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import useMetaEvidence from '../hooks/meta-evidence'
import { ItemTypes } from '@kleros/gtcr-encoder'
import DisplaySelector from './display-selector'
import { Link } from 'react-router-dom'

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
  const { library, active, networkId } = useWeb3Context()
  const [error, setError] = useState()
  const gtcr = useMemo(() => {
    if (!library || !active || !tcrAddress || !networkId) return
    try {
      return new ethers.Contract(tcrAddress, _gtcr, library)
    } catch (err) {
      console.error('Error instantiating gtcr contract', err)
      setError(err)
    }
  }, [active, library, networkId, tcrAddress])

  const { metaEvidence, error: metaEvidenceError } = useMetaEvidence({
    arbitrable: gtcr,
    library
  })

  if (error || metaEvidenceError) {
    const { message } = error || metaEvidenceError
    // this type of error is fixed by itself given a few seconds
    // it occurs because it attempts to look for the following
    // contract: "Error decoding text"
    // more info https://github.com/kleros/gtcr/issues/184
    if (!/UseSTD3ASCIIRules/.test(message))
      return (
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <StyledItemCol>
            <StyledResult
              status="warning"
              title="Errored submission"
              subTitle={message}
            />
          </StyledItemCol>
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
  }

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
