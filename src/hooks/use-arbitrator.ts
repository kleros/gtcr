import { ethers } from 'ethers'
import { useMemo } from 'react'
import { isETHAddress } from 'utils/helpers/string'
import { useWeb3Context } from 'web3-react'
import { abi as _arbitrator } from '@kleros/erc-792/build/contracts/IArbitrator.json'

const useArbitrator = (address: string): ethers.Contract | null => {
  const { library } = useWeb3Context()

  return useMemo<ethers.Contract | null>(() => {
    if (isETHAddress(address) && library)
      return new ethers.Contract(address, _arbitrator, library)

    return null
  }, [address, library])
}

export default useArbitrator
