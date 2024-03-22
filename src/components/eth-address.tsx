import React from 'react'
import styled from 'styled-components'
import { useWeb3Context } from 'web3-react'
import { getAddressPage } from '../utils/network-utils'

const StyledA = styled.a`
  text-decoration: underline;
`

const ETHAddress: React.FC<{ address: string; forceEth: boolean }> = ({
  address,
  forceEth
}) => {
  const { networkId } = useWeb3Context()
  const fullPage = forceEth
    ? `https://etherscan.io/address/${address}`
    : getAddressPage({ networkId, address })
  return (
    <StyledA href={fullPage}>
      {address.slice(0, 6)}...{address.slice(address.length - 4)}
    </StyledA>
  )
}

export default ETHAddress
