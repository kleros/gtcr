import { useEffect, useState } from 'react'
import { useHistory, useParams } from 'react-router'
import { useWeb3Context } from 'web3-react'
import { NETWORKS_INFO, NETWORK_STATUS, DEFAULT_NETWORK } from 'config/networks'
import { hexlify } from 'utils/string'
import getNetworkEnv from 'utils/network-env'

const useTcrNetwork = () => {
  const history = useHistory()
  const { networkId, active, library } = useWeb3Context()
  const { chainId } = useParams()
  const [networkStatus, setNetworkStatus] = useState(NETWORK_STATUS.unknown)

  useEffect(() => {
    window.ethereum &&
      window.ethereum.on('chainChanged', chainId => {
        chainId = Number(chainId)
        const tcrAddress = getNetworkEnv(
          'REACT_APP_DEFAULT_TCR_ADDRESSES',
          chainId
        )

        setNetworkStatus(status => {
          if (status !== NETWORK_STATUS.swtiching && tcrAddress) {
            setTimeout(() => {
              history.push(`/tcr/${chainId}/${tcrAddress}`)
              window.location.reload()
            })
            return NETWORK_STATUS.supported
          } else return NETWORK_STATUS.unsupported
        })
      })
    // eslint-disable-next-line
  }, [])

  useEffect(() => {
    ;(async () => {
      // metamask is not provided
      if (!window.ethereum) return setNetworkStatus(NETWORK_STATUS.supported)

      // if the wallet is not connected yet
      if (!networkId) return setNetworkStatus(NETWORK_STATUS.unknown)

      let networkToSwitch = Number(chainId)

      if (!NETWORKS_INFO[chainId]) networkToSwitch = DEFAULT_NETWORK

      // if current network is already supported
      if (networkId === networkToSwitch)
        setNetworkStatus(NETWORK_STATUS.supported)
      // if it needs to change network or chainId
      // change network if the metamask network has not connected yet
      else {
        const hexlifiedChainId = hexlify(networkToSwitch)

        try {
          setNetworkStatus(NETWORK_STATUS.swtiching)
          await library.send('wallet_switchEthereumChain', [
            { chainId: hexlifiedChainId }
          ])
        } catch (err) {
          // the target network is not added to the metamask
          if (err.code === 4902)
            if (NETWORKS_INFO[chainId].rpc) {
              // add new network to metamask if the target network info is available
              setNetworkStatus(NETWORK_STATUS.adding)
              await library.send('wallet_addEthereumChain', [
                {
                  chainId: hexlifiedChainId,
                  nativeCurrency: NETWORKS_INFO[chainId].nativeCurrency,
                  chainName: NETWORKS_INFO[chainId].name,
                  rpcUrls: NETWORKS_INFO[chainId].rpc,
                  blockExplorerUrls: NETWORKS_INFO[chainId].explorers.url
                }
              ])
            }
            // wait until a user adds the new network manually
            else {
              setNetworkStatus(NETWORK_STATUS.unsupported)
            }
          else setNetworkStatus(NETWORK_STATUS.unknown)
        }
      }
    })()
    // eslint-disable-next-line
  }, [active, networkId, library, chainId])

  return { networkStatus, networkId, active, library }
}

export default useTcrNetwork
