import { useMemo } from 'react'
import { ethers } from 'ethers'

const useGetLogs = (
  library: EthersLibrary | null,
):
  | ((query: ethers.providers.Filter) => Promise<ethers.providers.Log[]>)
  | null => {
  const getLogs = useMemo(
    () => async (query: ethers.providers.Filter) => {
      const defResult = await library.getLogs(query)
      return defResult
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [library, library.network],
  )
  if (!library || !library.network) return null
  return getLogs
}

export default useGetLogs
