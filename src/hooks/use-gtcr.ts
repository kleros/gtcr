import { ethers } from 'ethers'
import { useMemo } from 'react'
import { isETHAddress } from 'utils/helpers/string'
import { useWeb3Context } from 'web3-react'
import { abi as _GTCR } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import _lightTCR from 'assets/abis/LightGeneralizedTCR.json'

const useGTCR = (
  address: string,
  isLightTcr: boolean
): ethers.Contract | null => {
  const { library } = useWeb3Context()
  const arbitrator = useMemo<ethers.Contract | null>(() => {
    if (isETHAddress(address) && library)
      return new ethers.Contract(
        address,
        isLightTcr ? _lightTCR : _GTCR,
        library
      )

    return null
  }, [address, library, isLightTcr])

  return arbitrator
}

export default useGTCR
