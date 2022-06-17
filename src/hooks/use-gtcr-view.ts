import { ethers } from 'ethers'
import { useMemo } from 'react'
import { isETHAddress } from 'utils/helpers/string'
import { useWeb3Context } from 'web3-react'
import { abi as _GTCRView } from '@kleros/tcr/build/contracts/GeneralizedTCRView.json'
import _lightTCRView from 'assets/abis/LightGeneralizedTCRView.json'

const useGTCRView = (
  address: string,
  isLightTcr: boolean
): ethers.Contract | null => {
  const { library } = useWeb3Context()
  const arbitrator = useMemo<ethers.Contract | null>(() => {
    if (isETHAddress(address) && library)
      return new ethers.Contract(
        address,
        isLightTcr ? _lightTCRView : _GTCRView,
        library
      )

    return null
  }, [address, library, isLightTcr])

  return arbitrator
}

export default useGTCRView
