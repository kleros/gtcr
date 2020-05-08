import { useMemo } from 'react'
import { useWeb3Context } from 'web3-react'
import { abi as _GTCRFactory } from '@kleros/tcr/build/contracts/GTCRFactory.json'
import useNetworkEnvVariable from './network-env'
import { ethers } from 'ethers'
import { getAddress } from 'ethers/utils'

const useFactory = () => {
  const { networkId, library, active } = useWeb3Context()
  const factoryAddress = useNetworkEnvVariable(
    'REACT_APP_FACTORY_ADDRESSES',
    networkId
  )
  const factory = useMemo(() => {
    if (!factoryAddress || !active) return
    return new ethers.Contract(factoryAddress, _GTCRFactory, library)
  }, [active, factoryAddress, library])

  const deployedWithFactory = async tcrAddress => {
    if (!tcrAddress) return false
    try {
      tcrAddress = getAddress(tcrAddress)
    } catch (_) {
      return false
    }
    const deployments = await library.getLogs({
      ...factory.filters.NewGTCR(tcrAddress),
      fromBlock: 0
    })
    if (deployments.length > 0) return true
  }

  return {
    deployedWithFactory
  }
}

export default useFactory
