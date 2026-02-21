import React from 'react'
import styled from 'styled-components'
import { useWeb3Context } from 'hooks/use-web3-context'
import useUrlChainId from 'hooks/use-url-chain-id'
import { getAddressPage } from '../utils/network-utils'
import { shortenAddress } from '../utils/string'

const StyledA = styled.a`
  text-decoration: underline;
`

const ETHAddress: React.FC<{ address: string }> = ({ address }) => {
  const { networkId } = useWeb3Context()
  const urlChainId = useUrlChainId()

  const fullPage = getAddressPage({
    networkId: urlChainId ?? networkId,
    address,
  })
  return (
    <StyledA href={fullPage} target="_blank" rel="noopener noreferrer">
      {shortenAddress(address)}
    </StyledA>
  )
}

export default ETHAddress
