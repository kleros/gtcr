import { ethers } from 'ethers'
import { useQuery } from '@tanstack/react-query'
import { useWeb3Context } from 'hooks/use-web3-context'
import { useEthersProvider } from 'hooks/ethers-adapters'
import useUrlChainId from 'hooks/use-url-chain-id'

const ERC20_METADATA_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
]

// Older tokens (MKR, SAI) return their symbol as bytes32.
const BYTES32_SYMBOL_ABI = ['function symbol() view returns (bytes32)']

/** ethers' error for a call that reverted or whose result did not decode. */
const isCallException = (err: unknown) =>
  (err as { code?: unknown } | null)?.code === ethers.errors.CALL_EXCEPTION

/**
 * The token's symbol, as a string or as bytes32, or undefined when it reads
 * as neither (or as an empty one).
 */
const readSymbol = async (
  tokenAddress: string,
  provider: ethers.providers.Provider,
): Promise<string | undefined> => {
  let symbol: string
  try {
    symbol = await new ethers.Contract(
      tokenAddress,
      ERC20_METADATA_ABI,
      provider,
    ).symbol()
  } catch (err) {
    // Any other error is the node failing: the query fails and is retried,
    // as before, instead of reading as "no symbol".
    if (!isCallException(err)) throw err
    try {
      symbol = ethers.utils.parseBytes32String(
        await new ethers.Contract(
          tokenAddress,
          BYTES32_SYMBOL_ABI,
          provider,
        ).symbol(),
      )
    } catch {
      return undefined
    }
  }
  return symbol.trim() || undefined
}

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
        readSymbol(tokenAddress!, library!),
        token.decimals().catch(() => null),
      ])
      // Nothing answered: no token here, or the node failed (retried).
      if (symbol === undefined && decimals === null)
        throw new Error(`No ERC-20 token read at ${tokenAddress}`)
      return {
        // A token that answers decimals() but has no readable symbol is
        // named by its address: not a made-up symbol, and not "tokens",
        // which the Stake factory reads as "no token at this address".
        symbol:
          symbol ?? `${tokenAddress!.slice(0, 6)}…${tokenAddress!.slice(-4)}`,
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
