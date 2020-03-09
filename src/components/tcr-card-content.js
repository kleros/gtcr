import React, { useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components/macro'
import { useWeb3Context } from 'web3-react'
import { ethers } from 'ethers'
import { Result, Spin } from 'antd'
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import useMetadata from '../hooks/meta-data'
import itemTypes from '../utils/item-types'
import DisplaySelector from './display-selector'

const StyledItemCol = styled.div`
  margin-bottom: 8px;
  text-align: center;
`

const TCRCard = ({ tcrAddress }) => {
  const { library, active, networkId } = useWeb3Context()
  const [error, setError] = useState()
  const gtcr = useMemo(() => {
    if (!library || !active || !tcrAddress || !networkId) return
    try {
      return new ethers.Contract(tcrAddress, _gtcr, library)
    } catch (err) {
      console.error('Error instantiating gtcr contract', err)
      setError('Error setting up this TCR')
    }
  }, [active, library, networkId, tcrAddress])

  const { metadata, error: metadataError } = useMetadata({
    arbitrable: gtcr,
    library
  })

  if (error || metadataError)
    return (
      <Result
        status="error"
        title="Error fetching this TCR"
        subTitle={error || metadataError}
      />
    )

  if (!metadata) return <Spin />

  return (
    <>
      <StyledItemCol>
        <DisplaySelector type={itemTypes.IMAGE} value={metadata.logoURI} />
      </StyledItemCol>
      <StyledItemCol>
        <DisplaySelector type={itemTypes.TEXT} value={metadata.tcrTitle} />
      </StyledItemCol>
      <StyledItemCol>
        <DisplaySelector type={itemTypes.GTCR_ADDRESS} value={tcrAddress} />
      </StyledItemCol>
    </>
  )
}

TCRCard.propTypes = {
  tcrAddress: PropTypes.string.isRequired
}

export default TCRCard
