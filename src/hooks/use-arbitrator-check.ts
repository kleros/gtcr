import { useQuery } from '@tanstack/react-query'
import { getPublicClient } from '@wagmi/core'
import {
  BaseError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  isAddress,
  parseAbi,
} from 'viem'
import { wagmiConfig } from 'config/wagmi'

/*
 * Whether an address can arbitrate a new list: it holds a contract, and that
 * contract answers arbitrationCost for the list's extra data. Every
 * submission and challenge reads that cost first, so a list deployed with an
 * address that can't answer takes no request at all until its governor
 * changes the arbitrator, and a Stake list can never change it. The check
 * runs before the uploads and the wallet. A check that could not reach the
 * chain blocks nothing: the deploy's own simulation still runs.
 */

const ARBITRATOR_ABI = parseAbi([
  'function arbitrationCost(bytes _extraData) view returns (uint256)',
])

/** The contract answered (a revert, or no such function), not the node. */
const chainAnswered = (err: unknown): boolean =>
  err instanceof BaseError &&
  !!err.walk(
    (cause) =>
      cause instanceof ContractFunctionRevertedError ||
      cause instanceof ContractFunctionZeroDataError,
  )

export interface ArbitratorCheck {
  checking: boolean
  /** Why the address can't arbitrate this list, in plain words. */
  problem?: string
}

const useArbitratorCheck = (
  chainId: number | undefined,
  arbitrator: string | undefined,
  extraData: string | undefined,
  chainName: string,
): ArbitratorCheck => {
  const ready =
    chainId !== undefined &&
    !!arbitrator &&
    isAddress(arbitrator) &&
    !!extraData &&
    /^0x(?:[0-9a-fA-F]{2})*$/.test(extraData)
  const { data, isLoading } = useQuery({
    queryKey: [
      'arbitratorCheck',
      chainId,
      arbitrator?.toLowerCase(),
      extraData?.toLowerCase(),
    ],
    enabled: ready,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async (): Promise<string | null> => {
      const client = getPublicClient(wagmiConfig, { chainId })
      if (!client) return null
      const address = arbitrator as `0x${string}`
      const code = await client.getCode({ address })
      if (!code || code === '0x')
        return `There is no contract at the arbitrator address on ${chainName}, so it could not arbitrate the list.`
      try {
        await client.readContract({
          address,
          abi: ARBITRATOR_ABI,
          functionName: 'arbitrationCost',
          args: [extraData as `0x${string}`],
        })
      } catch (err) {
        if (chainAnswered(err))
          return 'The arbitrator does not answer arbitrationCost for this court and jurors, so the list could take no request.'
        throw err
      }
      return null
    },
  })
  // An address or extra data the form rejects is the form's to report.
  if (!ready) return { checking: false }
  if (isLoading) return { checking: true }
  return { checking: false, problem: data ?? undefined }
}

export default useArbitratorCheck
