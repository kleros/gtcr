import { useWeb3Context } from 'web3-react'
import { NETWORKS } from '../config/networks'

// TODO: Replace users with getNetworkEnv.
const useMainTCR2 = () => {
  const DEFAULT_NETWORK =
    process.env.REACT_APP_DEFAULT_NETWORK || NETWORKS.ethereum

  const web3Context = useWeb3Context()
  let tcr2Data = ''
  if (process.env.REACT_APP_DEFAULT_TCR_ADDRESSES)
    try {
      tcr2Data = JSON.parse(process.env.REACT_APP_DEFAULT_TCR_ADDRESSES)[
        web3Context.networkId || DEFAULT_NETWORK
      ]
    } catch (_) {
      console.error(
        'Failed to parse env variable REACT_APP_DEFAULT_TCR_ADDRESSES'
      )
    }
  return tcr2Data
}

export default useMainTCR2
