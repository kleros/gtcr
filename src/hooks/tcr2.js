import { useWeb3Context } from 'web3-react'

const useMainTCR2 = () => {
  const DEFAULT_NETWORK = process.env.REACT_APP_DEFAULT_NETWORK || 42

  const web3Context = useWeb3Context()
  let tcr2Data = ''
  if (process.env.REACT_APP_TCR2_ADDRESSES)
    try {
      tcr2Data = JSON.parse(process.env.REACT_APP_TCR2_ADDRESSES)[
        web3Context.networkId || DEFAULT_NETWORK
      ]
    } catch (_) {
      console.error('Failed to parse env variable REACT_APP_TCR2_ADDRESSES')
    }
  return tcr2Data
}

export default useMainTCR2
