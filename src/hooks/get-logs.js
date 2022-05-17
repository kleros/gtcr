import { ethers } from 'ethers'
import { useMemo } from 'react'

const useGetLogs = library => {
  const key = JSON.parse(process.env.REACT_APP_RPC_URLS)[1]
  const provider = new ethers.providers.JsonRpcProvider(key)
  const getLogs = useMemo(
    () => async query => {
      if (library.network.chainId === 1) {
        const mainnetResult = await provider.getLogs(query)
        return mainnetResult
      } else {
        const defResult = await library.getLogs(query)
        return defResult
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [library, library.network]
  )
  if (!library || !library.network) return null
  return getLogs
}

export default useGetLogs
