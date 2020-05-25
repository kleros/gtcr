import { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import { useDebounce } from 'use-debounce'
import { abi as _arbitrator } from '@kleros/tcr/build/contracts/IArbitrator.json'

const useArbitrationCost = ({
  address: inputAddress,
  arbitratorExtraData: inputArbitratorExtraData,
  library
}) => {
  const [error, setError] = useState()
  const [arbitrationCost, setArbitrationCost] = useState()
  const [address] = useDebounce(inputAddress, 1000)
  const [arbitratorExtraData] = useDebounce(inputArbitratorExtraData, 1000)

  useEffect(() => {
    if (!address || !library || !arbitratorExtraData) return
    ;(async () => {
      try {
        const arbitrator = new ethers.Contract(address, _arbitrator, library)
        setArbitrationCost(
          await arbitrator.arbitrationCost(arbitratorExtraData)
        )
      } catch (err) {
        console.error('Error fetching arbitration cost', err)
        setError(err)
      }
    })()
  }, [address, arbitratorExtraData, library])

  return { arbitrationCost, error }
}

export default useArbitrationCost
