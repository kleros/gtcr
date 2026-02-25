import { ethers } from 'ethers'
import { useQuery } from '@tanstack/react-query'
import { useWeb3Context } from 'hooks/use-web3-context'
import { useEthersProvider } from 'hooks/ethers-adapters'
import useUrlChainId from 'hooks/use-url-chain-id'

const ERC20_SYMBOL_ABI = ['function symbol() view returns (string)']

const useTokenSymbol = (
  tokenAddress: string | undefined,
): { symbol: string; loading: boolean } => {
  const { networkId } = useWeb3Context()
  const urlChainId = useUrlChainId()
  const library = useEthersProvider({ chainId: urlChainId ?? networkId })

  const { data, isLoading } = useQuery<string>({
    queryKey: ['tokenSymbol', tokenAddress?.toLowerCase()],
    queryFn: async () => {
      const token = new ethers.Contract(
        tokenAddress!,
        ERC20_SYMBOL_ABI,
        library!,
      )
      return token.symbol()
    },
    enabled: !!tokenAddress && !!library,
    staleTime: Infinity, // Token symbols are immutable
  })

  return { symbol: data ?? 'tokens', loading: isLoading }
}

export default useTokenSymbol
