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

/**
 * A node's words for a call it ran and that failed: a revert ("execution
 * reverted", Nethermind's "VM execution error"), or code that cannot run
 * (an old token's invalid opcode). A node that did not run it says
 * something else: a timeout, a rate limit, an error page.
 */
const RAN_AND_FAILED =
  /revert|vm execution error|invalid opcode|invalid jump|out of gas|stack underflow/i

/** Whether an RPC error, or the node's answer inside it, says the call ran and failed. */
const saysCallFailed = (value: unknown, depth = 0): boolean => {
  if (typeof value === 'string') return RAN_AND_FAILED.test(value)
  if (!value || typeof value !== 'object' || depth > 3) return false
  const { body, data, error, message } = value as Record<string, unknown>
  return [body, data, error, message].some((part) =>
    saysCallFailed(part, depth + 1),
  )
}

/**
 * Whether the token itself answered a failed read: the call ran and failed
 * (a revert), or returned nothing that decodes (no such function). ethers
 * reports a node that never answered (offline, timed out, rate-limited,
 * blocked) as the same CALL_EXCEPTION, with the request's own error inside
 * it: that one says nothing about the token, so it is not taken as an
 * answer.
 */
const tokenAnswered = (err: unknown): boolean => {
  if ((err as { code?: unknown } | null)?.code !== ethers.errors.CALL_EXCEPTION)
    return false
  const request = (err as { error?: unknown }).error
  return request === undefined || saysCallFailed(request)
}

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
    // A node that did not answer fails the query, which is retried, instead
    // of reading as "no symbol".
    if (!tokenAnswered(err)) throw err
    let raw: string
    try {
      raw = await new ethers.Contract(
        tokenAddress,
        BYTES32_SYMBOL_ABI,
        provider,
      ).symbol()
    } catch (bytes32Err) {
      if (!tokenAnswered(bytes32Err)) throw bytes32Err
      return undefined
    }
    try {
      symbol = ethers.utils.parseBytes32String(raw)
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
  /**
   * False while loading, while no node answers (18 stands in until a read
   * succeeds), or when the token has no decimals() (18 stands in).
   */
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
        // Only the token's own answer reads as "no decimals" (18 stands in,
        // flagged unread), and is kept: a node that failed fails the query,
        // which is retried and read again, never kept as this token's 18.
        token.decimals().catch((err: unknown) => {
          if (tokenAnswered(err)) return null
          throw err
        }),
      ])
      // Neither read answered as a token would: no ERC-20 here.
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
