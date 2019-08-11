import { useWeb3Context } from 'web3-react'

const useArbitrableTCRView = () => {
  const DEFAULT_NETWORK = process.env.REACT_APP_DEFAULT_NETWORK || 42

  const web3Context = useWeb3Context()
  let arbitrableTCR2ViewData = ''
  if (process.env.REACT_APP_TCRVIEW_ADDRESSES)
    try {
      arbitrableTCR2ViewData = JSON.parse(
        process.env.REACT_APP_TCRVIEW_ADDRESSES
      )[web3Context.networkId || DEFAULT_NETWORK]
    } catch (_) {
      console.error('Failed to parse env variable REACT_APP_TCRVIEW_ADDRESSES')
    }
  return arbitrableTCR2ViewData
}

export default useArbitrableTCRView
