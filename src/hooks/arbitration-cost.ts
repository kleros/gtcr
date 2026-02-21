import { useEffect, useState, useMemo } from 'react'
import { ethers } from 'ethers'
import { useDebounce } from 'use-debounce'
import { abi as _arbitrator } from '@kleros/erc-792/build/contracts/IArbitrator.json'

const useArbitrationCost = ({
  address: inputAddress,
  arbitratorExtraData: inputArbitratorExtraData,
  library
}: {
  address: string
  arbitratorExtraData: string
  library: any
}) => {
  const [error, setError] = useState<any>()
  const [arbitrationCost, setArbitrationCost] = useState<any>()
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

  return useMemo(() => ({ arbitrationCost, error }), [arbitrationCost, error])
}

export default useArbitrationCost
