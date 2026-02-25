import { useMemo } from 'react'
import { ethers, BigNumber } from 'ethers'
import { useDebounce } from 'use-debounce'
import { useQuery } from '@tanstack/react-query'
import { abi as _arbitrator } from '@kleros/erc-792/build/contracts/IArbitrator.json'

const useArbitrationCost = ({
  address: inputAddress,
  arbitratorExtraData: inputArbitratorExtraData,
  library,
}: {
  address: string
  arbitratorExtraData: string
  library: EthersLibrary | null
}) => {
  const [address] = useDebounce(inputAddress, 1000)
  const [arbitratorExtraData] = useDebounce(inputArbitratorExtraData, 1000)

  const { data: arbitrationCost, error } = useQuery<BigNumber>({
    queryKey: ['arbitrationCost', address, arbitratorExtraData],
    queryFn: async () => {
      const arbitrator = new ethers.Contract(address!, _arbitrator, library!)
      return arbitrator.arbitrationCost(arbitratorExtraData!)
    },
    enabled: !!address && !!library && !!arbitratorExtraData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  return useMemo(() => ({ arbitrationCost, error }), [arbitrationCost, error])
}

export default useArbitrationCost
