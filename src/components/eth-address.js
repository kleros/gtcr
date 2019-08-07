import PropTypes from 'prop-types'
import React from 'react'
import { useWeb3Context } from 'web3-react'
import { NETWORK, NETWORK_NAME } from '../utils/network-names'

const ETHAddress = ({ address }) => {
  const { networkId } = useWeb3Context()
  return (
    <a
      href={`https://${
        networkId !== NETWORK.MAINNET ? `${NETWORK_NAME[networkId]}.` : ''
      }etherscan.io/address/${address}`}
      rel="noopener noreferrer"
      target="_blank"
    >
      {address.slice(0, 6)}...{address.slice(address.length - 4)}
    </a>
  )
}

ETHAddress.propTypes = {
  address: PropTypes.string.isRequired
}

export default ETHAddress
