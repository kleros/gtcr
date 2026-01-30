import React from 'react'
import styled from 'styled-components'
import { Button } from 'antd'
import PropTypes from 'prop-types'
import { useParams, Link } from 'react-router-dom'
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

const GTCRAddress = ({ address, disabled }) => {
  const { chainId } = useParams()

  // this avoids crashes when it looks for the address "Error decoding GTCR address"
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return null

  return (
    <>
      <StyledSpan>
        <ETHAddress address={address || ZERO_ADDRESS} />
      </StyledSpan>
      {disabled ? (
        <StyledButton disabled>Visit</StyledButton>
      ) : (
        <Link to={`/tcr/${chainId}/${address}`}>
          <StyledButton>Visit</StyledButton>
        </Link>
      )}
    </>
  )
}

GTCRAddress.propTypes = {
  address: PropTypes.string.isRequired,
  disabled: PropTypes.bool
}

GTCRAddress.defaultProps = {
  disabled: false
}

export default GTCRAddress
