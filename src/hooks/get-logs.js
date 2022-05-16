import { ethers } from 'ethers'

const useGetLogs = library => {
  const key = JSON.parse(process.env.REACT_APP_RPC_URLS)[1]
  const provider = new ethers.providers.JsonRpcProvider(key)

  const getLogs = async query => {
    if (library.network.chainId === 1) {
      const mainnetResult = await provider.getLogs(query)
      return mainnetResult
    } else {
      const defResult = await library.getLogs(query)
      return defResult
    }
  }
  return getLogs
}

export default useGetLogs
