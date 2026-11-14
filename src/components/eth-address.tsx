import React from 'react'
import { useWeb3Context } from 'hooks/use-web3-context'
import useUrlChainId from 'hooks/use-url-chain-id'
import { ChromeAddress } from 'components/curate/chrome-address'
import { truncateMiddle } from 'components/curate/primitives'
import { getAddressPage } from '../utils/network-utils'

/*
 * An account or contract address: middle-truncated mono that opens the
 * explorer of the chain in the URL (else the wallet's chain), plus copy.
 */
const ETHAddress: React.FC<{ address: string }> = ({ address }) => {
  const { networkId } = useWeb3Context()
  const urlChainId = useUrlChainId()

  const fullPage = getAddressPage({
    networkId: urlChainId ?? networkId,
    address,
  })
  return (
    <ChromeAddress
      address={address}
      href={fullPage}
      display={truncateMiddle(address, 6, 4)}
    />
  )
}

export default ETHAddress
