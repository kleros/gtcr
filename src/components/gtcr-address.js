import React from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components/macro'
import { utils } from 'ethers'
import { Button } from 'antd'
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
  // this avoids crashes when it looks for the address "Error decoding GTCR address"
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return null
  return (
    <>
      <StyledSpan>
        <ETHAddress address={address || ZERO_ADDRESS} />
      </StyledSpan>
      <StyledButton href={`/tcr/${utils.getAddress(address)}`}>
        Visit
      </StyledButton>
    </>
  )
}

GTCRAddress.propTypes = {
  address: PropTypes.string.isRequired
}

export default GTCRAddress
