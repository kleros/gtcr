import React, { useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components/macro'
import { useWeb3Context } from 'web3-react'
import { ethers } from 'ethers'
import { Result, Skeleton, Button } from 'antd'
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import useMetaEvidence from '../hooks/meta-evidence'
import itemTypes from '../utils/item-types'
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

const TCRCardContent = ({ tcrAddress, currentTCRAddress, ID }) => {
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
    return (
      <StyledResult
        status="warning"
        title="Errored submission"
        subTitle={message}
      />
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
      <>
        <StyledItemCol>
          <DisplaySelector type={itemTypes.IMAGE} value={metadata.logoURI} />
        </StyledItemCol>
        <StyledItemCol>
          <DisplaySelector type={itemTypes.TEXT} value={metadata.tcrTitle} />
        </StyledItemCol>
        <StyledItemCol>
          <Link to={`/tcr/${currentTCRAddress}/${ID}`}>
            <Button>Details</Button>
          </Link>
          <Link to={`/tcr/${tcrAddress}`} style={{ marginLeft: '12px' }}>
            <Button type="primary">Open List</Button>
          </Link>
        </StyledItemCol>
      </>
    )
  } catch (err) {
    return <StyledResult status="warning" subTitle={err.message} />
  }
}

TCRCardContent.propTypes = {
  tcrAddress: PropTypes.string
}

TCRCardContent.defaultProps = {
  tcrAddress: null
}

export default TCRCardContent
