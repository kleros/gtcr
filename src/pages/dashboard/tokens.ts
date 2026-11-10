import { ethers } from 'ethers'
import { NETWORKS } from 'config/networks'
import { getRpcUrls } from 'config/rpc'
import type { TokenInfo } from './types'

/*
 * The ERC-20s Stake bounties are paid in: symbol and decimals, so a bounty
 * reads "606.15 sDAI". The tokens Stake lists use today are known (each read
 * from its contract); any other is read from the chain once per session.
 * A token whose read fails is left out: its amount is never guessed.
 */

const REQUEST_TIMEOUT_MS = 4_000

/** Read from the contracts (symbol(), decimals()) on 2026-10-19. */
const KNOWN: Record<string, TokenInfo> = {
  [`${NETWORKS.gnosis}:0xaf204776c7245bf4147c2612bf6e5972ee483701`]: {
    symbol: 'sDAI',
    decimals: 18,
  },
  [`${NETWORKS.ethereum}:0xae7ab96520de3a18e5e111b5eaab095312d7fe84`]: {
    symbol: 'stETH',
    decimals: 18,
  },
}

const erc20 = new ethers.utils.Interface([
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
])

const read = new Map<string, Promise<TokenInfo | null>>()

const ethCall = async (
  url: string,
  to: string,
  data: string,
): Promise<string | null> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to, data }, 'latest'],
      }),
      signal: controller.signal,
    })
    if (!response.ok) return null
    const reply = (await response.json()) as { result?: string }
    return typeof reply.result === 'string' && reply.result.length > 2
      ? reply.result
      : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

const readToken = async (
  chainId: number,
  token: string,
): Promise<TokenInfo | null> => {
  for (const url of getRpcUrls(chainId)) {
    const [symbol, decimals] = await Promise.all([
      ethCall(url, token, erc20.encodeFunctionData('symbol')),
      ethCall(url, token, erc20.encodeFunctionData('decimals')),
    ])
    if (!symbol || !decimals) continue
    try {
      return {
        symbol: String(erc20.decodeFunctionResult('symbol', symbol)[0]),
        decimals: Number(erc20.decodeFunctionResult('decimals', decimals)[0]),
      }
    } catch {
      // Not an ERC-20 answer: try the next node.
    }
  }
  return null
}

/** Symbol and decimals per "<chainId>:<token>"; tokens that did not load are absent. */
export const readTokens = async (
  tokens: { chainId: number; token: string }[],
): Promise<Record<string, TokenInfo>> => {
  const result: Record<string, TokenInfo> = {}
  await Promise.all(
    tokens.map(async ({ chainId, token }) => {
      const key = `${chainId}:${token.toLowerCase()}`
      if (KNOWN[key]) {
        result[key] = KNOWN[key]
        return
      }
      if (!/^0x[0-9a-f]{40}$/.test(token.toLowerCase())) return
      const pending = read.get(key) ?? readToken(chainId, token)
      read.set(key, pending)
      const info = await pending
      if (info) result[key] = info
      else read.delete(key)
    }),
  )
  return result
}
