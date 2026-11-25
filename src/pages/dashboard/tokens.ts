import { ethers } from 'ethers'
import { NETWORKS } from 'config/networks'
import { getRpcUrls } from 'config/rpc'
import type { TokenInfo } from './types'

/*
 * The ERC-20s Stake bounties are paid in: symbol and decimals, so a bounty
 * reads "606.15 sDAI". Nothing here is mandatory — a Stake list pays in
 * whichever token it was deployed with — so two of them are known only
 * because they were read from their contracts; any other is read from the
 * chain once per session.
 *
 * A token's symbol and its decimals are read apart, because they fail apart
 * (round 3): decimals() is what an amount needs, symbol() only names it. So
 * a token that answers decimals() but has no readable symbol is named by its
 * address, exactly as the app's own reader does (hooks/token-symbol.ts), and
 * an older token that returns its symbol as bytes32 is decoded rather than
 * dropped. A token whose decimals() never answers is left out entirely: its
 * amount is never guessed, and the tile shows the count alone.
 *
 * Each token read gets the caller's budget to itself, so one slow node
 * costs that one tile its amount instead of blanking all of them.
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

// Older tokens (MKR, SAI) return their symbol as bytes32.
const erc20Bytes32 = new ethers.utils.Interface([
  'function symbol() view returns (bytes32)',
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

/** The symbol, as a string or as bytes32; undefined when it reads as neither. */
const decodeSymbol = (result: string): string | undefined => {
  try {
    return String(erc20.decodeFunctionResult('symbol', result)[0]).trim()
  } catch {
    // Not a string: an older token returning bytes32.
  }
  try {
    return ethers.utils
      .parseBytes32String(
        String(erc20Bytes32.decodeFunctionResult('symbol', result)[0]),
      )
      .trim()
  } catch {
    return undefined
  }
}

/**
 * Symbol and decimals from the first node that answers decimals(). A token
 * whose decimals() answers but whose symbol() does not is named by its
 * address; one whose decimals() never answers is not a token the amount can
 * be read from, and reads as null.
 */
const readToken = async (
  chainId: number,
  token: string,
): Promise<TokenInfo | null> => {
  for (const url of getRpcUrls(chainId)) {
    const [symbol, decimals] = await Promise.all([
      ethCall(url, token, erc20.encodeFunctionData('symbol')),
      ethCall(url, token, erc20.encodeFunctionData('decimals')),
    ])
    if (!decimals) continue
    try {
      // decimals() == 0 is a token, not a failure: the raw result answered.
      const places = Number(erc20.decodeFunctionResult('decimals', decimals)[0])
      if (!Number.isInteger(places) || places < 0 || places > 36) continue
      return {
        symbol:
          (symbol ? decodeSymbol(symbol) : undefined) ||
          `${token.slice(0, 6)}…${token.slice(-4)}`,
        decimals: places,
      }
    } catch {
      // Not an ERC-20 answer: try the next node.
    }
  }
  return null
}

/**
 * One read per token per session. A read that found nothing is dropped from
 * the cache, so the next load tries again.
 */
const cachedRead = (
  key: string,
  chainId: number,
  token: string,
): Promise<TokenInfo | null> => {
  const pending = read.get(key)
  if (pending) return pending
  const started = (async () => {
    const info = await readToken(chainId, token)
    if (!info) read.delete(key)
    return info
  })()
  read.set(key, started)
  return started
}

/**
 * Symbol and decimals per "<chainId>:<token>". A token that did not answer
 * inside `budgetMs` is absent, and so is one still reading when the budget
 * ran out — its read carries on and fills in on the next load.
 */
export const readTokens = async (
  tokens: { chainId: number; token: string }[],
  budgetMs: number,
): Promise<Record<string, TokenInfo>> => {
  const result: Record<string, TokenInfo> = {}
  let timer: number | undefined
  const deadline = new Promise<null>((resolve) => {
    timer = window.setTimeout(() => resolve(null), budgetMs)
  })
  await Promise.all(
    tokens.map(async ({ chainId, token }) => {
      const key = `${chainId}:${token.toLowerCase()}`
      if (KNOWN[key]) {
        result[key] = KNOWN[key]
        return
      }
      if (!/^0x[0-9a-f]{40}$/.test(token.toLowerCase())) return
      const info = await Promise.race([
        cachedRead(key, chainId, token),
        deadline,
      ])
      if (info) result[key] = info
    }),
  )
  window.clearTimeout(timer)
  return result
}
