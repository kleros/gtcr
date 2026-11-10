import { ethers } from 'ethers'
import { getRpcUrls } from 'config/rpc'

/*
 * Each Light and Classic list's challenge period, read from the chain: the
 * indexers do not store it. A request can be challenged while
 * now - submissionTime <= challengePeriodDuration (the contracts' own check,
 * against the list's current period); past that it only awaits execution.
 * One Multicall3 call per chain reads every list that has an open request.
 */

/** Multicall3, deployed at the same address on Ethereum, Gnosis and Sepolia. */
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11'
const REQUEST_TIMEOUT_MS = 4_000
/** Lists read per call. */
const CHUNK = 150
/** A period changes only by governance: reuse a read for a few minutes. */
const CACHE_MS = 5 * 60_000

const multicall = new ethers.utils.Interface([
  'function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[] returnData)',
])
const registryInterface = new ethers.utils.Interface([
  'function challengePeriodDuration() view returns (uint256)',
])
const PERIOD_CALL = registryInterface.encodeFunctionData(
  'challengePeriodDuration',
)

const cache = new Map<string, { period: number; readAt: number }>()

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

const readChunk = async (
  chainId: number,
  addresses: string[],
): Promise<Map<string, number>> => {
  const periods = new Map<string, number>()
  const data = multicall.encodeFunctionData('aggregate3', [
    addresses.map((target) => ({
      target,
      allowFailure: true,
      callData: PERIOD_CALL,
    })),
  ])
  // The app's endpoint order: the next node answers when one fails.
  for (const url of getRpcUrls(chainId)) {
    const result = await ethCall(url, MULTICALL3, data)
    if (!result) continue
    try {
      const [rows] = multicall.decodeFunctionResult('aggregate3', result) as [
        { success: boolean; returnData: string }[],
      ]
      rows.forEach((row, index) => {
        if (!row.success || row.returnData.length < 66) return
        const [period] = registryInterface.decodeFunctionResult(
          'challengePeriodDuration',
          row.returnData,
        )
        periods.set(addresses[index], Number(period.toString()))
      })
      return periods
    } catch {
      // A malformed answer: try the next node.
    }
  }
  return periods
}

/**
 * Challenge periods in seconds per list address (lowercase). A list whose
 * period could not be read is missing from the map.
 */
export const readChallengePeriods = async (
  chainId: number,
  registryAddresses: string[],
): Promise<Map<string, number>> => {
  const periods = new Map<string, number>()
  const now = Date.now()
  const toRead: string[] = []
  const valid = registryAddresses
    .map((address) => address.toLowerCase())
    .filter((address) => /^0x[0-9a-f]{40}$/.test(address))
  for (const address of new Set(valid)) {
    const hit = cache.get(`${chainId}:${address}`)
    if (hit && now - hit.readAt < CACHE_MS) periods.set(address, hit.period)
    else toRead.push(address)
  }
  const chunks: string[][] = []
  for (let index = 0; index < toRead.length; index += CHUNK)
    chunks.push(toRead.slice(index, index + CHUNK))
  const results = await Promise.all(
    chunks.map((chunk) => readChunk(chainId, chunk)),
  )
  for (const result of results)
    for (const [address, period] of result) {
      periods.set(address, period)
      cache.set(`${chainId}:${address}`, { period, readAt: now })
    }
  return periods
}
