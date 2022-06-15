import React from 'react'
import { useWeb3Context } from 'web3-react'
import { getAddressPage } from '../utils/helpers/network-utils'

const ETHAddress: React.FC<{ address: string; forceEth: boolean }> = ({
  address,
  forceEth
}) => {
  const { networkId } = useWeb3Context()
  const fullPage = forceEth
    ? `https://etherscan.io/address/${address}`
    : getAddressPage({ networkId, address })
  return (
    <a href={fullPage} style={{ textDecoration: 'underline' }}>
      {address.slice(0, 6)}...{address.slice(address.length - 4)}
    </a>
  )
}

export default ETHAddress
