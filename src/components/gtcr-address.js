import React, { useCallback } from 'react'
import styled from 'styled-components'
import { Button } from 'antd'
import PropTypes from 'prop-types'
import { useParams } from 'react-router-dom'
import { ZERO_ADDRESS } from '../utils/string'
import ETHAddress from './eth-address'

const StyledButton = styled(Button)`
  pointer-events: auto;
  text-transform: capitalize;
`

const StyledSpan = styled.span`
  margin: 0 12px 0 0;
  pointer-events: auto;
`

const GTCRAddress = ({ address }) => {
  const { chainId } = useParams()
  // We reload the page because the UI needs to redetect what type of TCR it is.
  const navigateReload = useCallback(() => {
    window.location.assign(`/tcr/${chainId}/${address}`)
  }, [chainId, address])

  // this avoids crashes when it looks for the address "Error decoding GTCR address"
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return null

  return (
    <>
      <StyledSpan>
        <ETHAddress address={address || ZERO_ADDRESS} />
      </StyledSpan>
      <StyledButton onClick={navigateReload}>Visit</StyledButton>
    </>
  )
}

GTCRAddress.propTypes = {
  address: PropTypes.string.isRequired
}

export default GTCRAddress
