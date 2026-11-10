import { ethers } from 'ethers'
import { useQuery } from '@tanstack/react-query'
import { useWeb3Context } from 'hooks/use-web3-context'
import { useEthersProvider } from 'hooks/ethers-adapters'
import useUrlChainId from 'hooks/use-url-chain-id'

const ERC20_METADATA_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
]

const useTokenSymbol = (
  tokenAddress: string | undefined,
): {
  symbol: string
  decimals: number
  /** False while loading, or when decimals() failed and 18 stands in. */
  decimalsRead: boolean
  loading: boolean
} => {
  const { networkId } = useWeb3Context()
  const urlChainId = useUrlChainId()
  const library = useEthersProvider({ chainId: urlChainId ?? networkId })

  const { data, isLoading } = useQuery<{
    symbol: string
    decimals: number
    decimalsRead: boolean
  }>({
    queryKey: [
      'tokenSymbol',
      urlChainId ?? networkId,
      tokenAddress?.toLowerCase(),
    ],
    queryFn: async () => {
      const token = new ethers.Contract(
        tokenAddress!,
        ERC20_METADATA_ABI,
        library!,
      )
      const [symbol, decimals] = await Promise.all([
        token.symbol(),
        token.decimals().catch(() => null),
      ])
      return {
        symbol,
        decimals: decimals === null ? 18 : Number(decimals),
        decimalsRead: decimals !== null,
      }
    },
    enabled: !!tokenAddress && !!library,
    staleTime: Infinity, // Token symbols are immutable
  })

  return {
    symbol: data?.symbol ?? 'tokens',
    decimals: data?.decimals ?? 18,
    decimalsRead: data?.decimalsRead ?? false,
    loading: isLoading,
  }
}

export default useTokenSymbol
