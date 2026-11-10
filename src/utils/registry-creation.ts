import { ethers } from 'ethers'
import { registryFactories } from 'config/tcr-addresses'
import { getRpcUrls } from 'config/rpc'

/*
 * Real creation times for Light and Classic lists: the block timestamp of the
 * factory's NewGTCR(address) event. The indexers do not store it (the old
 * code used each list's first request, which is why "newest lists" sorted by
 * first activity). Results are immutable, so they are cached in
 * localStorage per chain together with the last block scanned.
 */

const TOPIC = ethers.utils.id('NewGTCR(address)')
const CACHE_PREFIX = 'curatevision-registry-created:v1:'
const REQUEST_TIMEOUT_MS = 20_000

interface ChainCache {
  scannedTo: number
  created: Record<string, number>
}

const readCache = (chainId: number): ChainCache | null => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + chainId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ChainCache
    return typeof parsed?.scannedTo === 'number' && parsed.created
      ? parsed
      : null
  } catch {
    return null
  }
}

export const applyCreationTimes = <
  T extends {
    kind: string
    chainId: number
    address: string
    createdAt?: number
    createdAtExact?: boolean
  },
>(
  registries: T[],
  created: Map<string, number>,
): T[] =>
  registries.map((registry) => {
    if (registry.kind === 'permanent')
      return { ...registry, createdAtExact: Boolean(registry.createdAt) }
    const exact = created.get(`${registry.chainId}:${registry.address}`)
    return exact
      ? { ...registry, createdAt: exact, createdAtExact: true }
      : { ...registry, createdAtExact: false }
  })

const writeCache = (chainId: number, cache: ChainCache) => {
  try {
    localStorage.setItem(CACHE_PREFIX + chainId, JSON.stringify(cache))
  } catch {
    // Storage can be blocked or full; the next load rescans.
  }
}

// The app's own endpoint order: on Gnosis the public node comes first, since
// Alchemy refuses log ranges over 10,000 blocks there.
const rpcUrls = getRpcUrls

const rpc = async <T>(url: string, body: object | object[]): Promise<T> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`RPC ${response.status}`)
    return (await response.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

interface RpcResult<T> {
  id?: number
  result?: T
  error?: { message?: string }
}

interface RawLog {
  address: string
  topics: string[]
  blockNumber: string
}

/** getLogs over [from, to]; splits the range in halves when a node refuses it. */
const getLogs = async (
  url: string,
  address: string,
  from: number,
  to: number,
  depth = 0,
): Promise<RawLog[]> => {
  const reply = await rpc<RpcResult<RawLog[]>>(url, {
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_getLogs',
    params: [
      {
        address,
        topics: [TOPIC],
        fromBlock: ethers.utils.hexValue(from),
        toBlock: ethers.utils.hexValue(to),
      },
    ],
  })
  if (reply.result) return reply.result
  // Six halvings (at most 64 requests per factory): enough for a node with a
  // range cap and a cached cursor, without flooding a fallback node that
  // refuses every wide range on a cold cache.
  if (depth >= 6 || to - from < 2000)
    throw new Error(reply.error?.message ?? 'eth_getLogs failed')
  const mid = Math.floor((from + to) / 2)
  const [left, right] = await Promise.all([
    getLogs(url, address, from, mid, depth + 1),
    getLogs(url, address, mid + 1, to, depth + 1),
  ])
  return [...left, ...right]
}

const blockNumber = async (url: string): Promise<number> => {
  const reply = await rpc<RpcResult<string>>(url, {
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_blockNumber',
    params: [],
  })
  if (!reply.result) throw new Error('eth_blockNumber failed')
  return Number(reply.result)
}

/** Block timestamps, batched 40 at a time. */
const blockTimes = async (
  url: string,
  blocks: number[],
): Promise<Map<number, number>> => {
  const times = new Map<number, number>()
  for (let i = 0; i < blocks.length; i += 40) {
    const slice = blocks.slice(i, i + 40)
    const replies = await rpc<RpcResult<{ timestamp: string }>[]>(
      url,
      slice.map((block, index) => ({
        jsonrpc: '2.0',
        id: index,
        method: 'eth_getBlockByNumber',
        params: [ethers.utils.hexValue(block), false],
      })),
    )
    for (const reply of Array.isArray(replies) ? replies : []) {
      const block = slice[Number(reply.id)]
      if (block !== undefined && reply.result?.timestamp)
        times.set(block, Number(reply.result.timestamp))
    }
  }
  return times
}

const scanChain = async (chainId: number): Promise<Record<string, number>> => {
  const factories = registryFactories[chainId] ?? []
  const cache = readCache(chainId)
  const created: Record<string, number> = { ...(cache?.created ?? {}) }
  let lastError: unknown
  for (const url of rpcUrls(chainId))
    try {
      const head = await blockNumber(url)
      const logs = (
        await Promise.all(
          factories.map((factory) =>
            getLogs(
              url,
              factory.address,
              Math.max(factory.startBlock, (cache?.scannedTo ?? 0) + 1),
              head,
            ),
          ),
        )
      ).flat()
      const fresh = logs.filter((log) => log.topics?.[1])
      const blocks = [...new Set(fresh.map((log) => Number(log.blockNumber)))]
      const times = await blockTimes(url, blocks)
      for (const log of fresh) {
        const address = ethers.utils
          .hexDataSlice(log.topics[1], 12)
          .toLowerCase()
        const time = times.get(Number(log.blockNumber))
        if (time) created[address] = time
      }
      // Only advance the cursor when every block got its timestamp.
      const complete = blocks.every((block) => times.has(block))
      writeCache(chainId, {
        scannedTo: complete ? head : (cache?.scannedTo ?? 0),
        created,
      })
      return created
    } catch (err) {
      lastError = err
    }
  if (lastError)
    console.warn(`Registry creation scan failed on ${chainId}`, lastError)
  return created
}

/** What is already cached, synchronously (empty on a first visit). */
export const readCachedCreationTimes = (
  chainIds: number[],
): Map<string, number> => {
  const map = new Map<string, number>()
  for (const chainId of chainIds)
    for (const [address, time] of Object.entries(
      readCache(chainId)?.created ?? {},
    ))
      map.set(`${chainId}:${address}`, time)
  return map
}

/** Map of `${chainId}:${lowercase address}` → creation time (unix seconds). */
export const fetchRegistryCreationTimes = async (
  chainIds: number[],
): Promise<Map<string, number>> => {
  const results = await Promise.all(
    chainIds.map(
      async (chainId) => [chainId, await scanChain(chainId)] as const,
    ),
  )
  const map = new Map<string, number>()
  for (const [chainId, created] of results)
    for (const [address, time] of Object.entries(created))
      map.set(`${chainId}:${address}`, time)
  return map
}
