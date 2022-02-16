import PropTypes from 'prop-types'
import React from 'react'
import { useWeb3Context } from 'web3-react'
import { getAddressPage } from '../utils/network-utils'

const ETHAddress = ({ address }) => {
  const { networkId } = useWeb3Context()
  const fullPage = getAddressPage({ networkId, address })
  return (
    <a href={fullPage} style={{ textDecoration: 'underline' }}>
      {address.slice(0, 6)}...{address.slice(address.length - 4)}
    </a>
  )
}

ETHAddress.propTypes = {
  address: PropTypes.string.isRequired
}

export default ETHAddress
