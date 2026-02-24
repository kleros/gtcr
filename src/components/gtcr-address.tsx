import React from 'react'
import styled from 'styled-components'
import { Button } from 'components/ui'
import { Link } from 'react-router-dom'
import useUrlChainId from 'hooks/use-url-chain-id'
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

interface GTCRAddressProps {
  address: string
  disabled?: boolean
}

const GTCRAddress = ({ address, disabled }: GTCRAddressProps) => {
  const chainId = useUrlChainId()

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

export default GTCRAddress
