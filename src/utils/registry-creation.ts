import { registryFactories } from 'config/tcr-addresses'
import { getRpcUrls } from 'config/rpc'
import snapshotFile from 'config/registry-creation-snapshot.json'

/*
 * Real creation times for Light and Classic lists: the block timestamp of the
 * factory's NewGTCR(address) event. The indexers do not store it (the old
 * code used each list's first request, which is why "newest lists" sorted by
 * first activity). Results are immutable, so they ship with the app:
 * config/registry-creation-snapshot.json holds every factory's lists up to
 * its `scannedTo` block. Only the blocks after that (or after the cursor this
 * browser saved) are read from chain:
 *  - in sequential chunks of CHUNK_BLOCKS, a range every node accepts
 *    (Alchemy caps eth_getLogs at 10,000 blocks on Gnosis, so does dRPC),
 *    the cursor saved after each chunk;
 *  - at most MAX_CHUNKS_PER_LOAD chunks per chain to catch up in a page load
 *    (the cursor resumes on the next load); once caught up, a chain is read
 *    again at most every RESCAN_MS, a chunk at a time;
 *  - one scan per chain at a time, shared by every caller;
 *  - after a failure, nothing more until a backoff has passed, so the
 *    dashboard's refreshes cannot turn a refusing node into a retry storm.
 * Regenerate the snapshot from time to time (scripts/registry-creation-
 * snapshot.mjs) so a first visit has little to read.
 */

interface ChainCache {
  scannedTo: number
  created: Record<string, number>
}

/** keccak256("NewGTCR(address)"), the event both factories emit. */
const TOPIC =
  '0x704e94f24d7a41dd1af49e0bbd12aa4fb9ade0accd11001b9d1de7d756a5464f'
/** What this browser read past the snapshot (same shape as the snapshot). */
const CACHE_PREFIX = 'curatevision-registry-created:v1:'
const REQUEST_TIMEOUT_MS = 15_000
/** Blocks per eth_getLogs request (inclusive range). */
const CHUNK_BLOCKS = 10_000
/** Chunks one page load may read per chain to catch up. */
const MAX_CHUNKS_PER_LOAD = 30
/** Blocks left below the head, so a reorg cannot hide a creation. */
const CONFIRMATIONS = 64
/** Pause after a failed scan: one minute, doubling up to half an hour. */
const BACKOFF_BASE_MS = 60_000
const BACKOFF_MAX_MS = 30 * 60_000
/** A chain read up to its head is not asked again for this long. */
const RESCAN_MS = 10 * 60_000

const SNAPSHOT = snapshotFile as Record<string, ChainCache | undefined>

/** Chunks read in this page load since the chain was last caught up. */
const chunksRead = new Map<number, number>()
/** When each chain was last read up to its head. */
const caughtUpAt = new Map<number, number>()
/** The scan running for a chain, shared by every caller. */
const inFlight = new Map<number, Promise<Record<string, number>>>()
/** After failures: when a chain may be scanned again. */
const paused = new Map<number, { until: number; failures: number }>()

const readStored = (chainId: number): ChainCache | null => {
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

/** The shipped snapshot and what this browser read since, merged. */
const knownFor = (chainId: number): ChainCache => {
  const shipped = SNAPSHOT[String(chainId)]
  const stored = readStored(chainId)
  return {
    scannedTo: Math.max(shipped?.scannedTo ?? 0, stored?.scannedTo ?? 0),
    created: { ...shipped?.created, ...stored?.created },
  }
}

/** Saves the cursor and the lists the snapshot does not hold. */
const writeStored = (chainId: number, known: ChainCache) => {
  const shipped = SNAPSHOT[String(chainId)]?.created ?? {}
  const created = Object.fromEntries(
    Object.entries(known.created).filter(
      ([address, time]) => shipped[address] !== time,
    ),
  )
  try {
    localStorage.setItem(
      CACHE_PREFIX + chainId,
      JSON.stringify({ scannedTo: known.scannedTo, created }),
    )
  } catch {
    // Storage can be blocked or full; the next load reads from the snapshot.
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

const hex = (value: number) => `0x${value.toString(16)}`

const rpc = async <T>(
  url: string,
  method: string,
  params: unknown[],
): Promise<T> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`RPC ${response.status}`)
    const reply = (await response.json()) as {
      result?: T
      error?: { message?: string }
    }
    if (reply.error || reply.result === undefined)
      throw new Error(reply.error?.message ?? `${method} failed`)
    return reply.result
  } finally {
    clearTimeout(timer)
  }
}

/** One call, on the app's endpoints in order (the next when one fails). */
const onChain = async <T>(
  chainId: number,
  method: string,
  params: unknown[],
): Promise<T> => {
  let lastError: unknown = new Error(`No RPC endpoint for chain ${chainId}`)
  for (const url of getRpcUrls(chainId))
    try {
      return await rpc<T>(url, method, params)
    } catch (err) {
      lastError = err
    }
  throw lastError
}

interface RawLog {
  topics?: string[]
  blockNumber: string
}

/** Reads the chain's new blocks, a chunk at a time, within the load's budget. */
const scanChain = async (chainId: number): Promise<Record<string, number>> => {
  const known = knownFor(chainId)
  const factories = registryFactories[chainId] ?? []
  const budget = MAX_CHUNKS_PER_LOAD - (chunksRead.get(chainId) ?? 0)
  const pause = paused.get(chainId)
  const now = Date.now()
  if (
    factories.length === 0 ||
    budget <= 0 ||
    (pause && now < pause.until) ||
    now - (caughtUpAt.get(chainId) ?? 0) < RESCAN_MS
  )
    return known.created

  const addresses = factories.map((factory) => factory.address)
  const firstBlock = Math.min(...factories.map((factory) => factory.startBlock))
  try {
    const head = Number(await onChain<string>(chainId, 'eth_blockNumber', []))
    const target = head - CONFIRMATIONS
    let cursor = Math.max(known.scannedTo, firstBlock - 1)
    for (let chunk = 0; chunk < budget && cursor < target; chunk += 1) {
      const from = cursor + 1
      const to = Math.min(cursor + CHUNK_BLOCKS, target)
      chunksRead.set(chainId, (chunksRead.get(chainId) ?? 0) + 1)
      const logs = await onChain<RawLog[]>(chainId, 'eth_getLogs', [
        {
          address: addresses,
          topics: [TOPIC],
          fromBlock: hex(from),
          toBlock: hex(to),
        },
      ])
      // New lists are a few a month: each one's block time is a small read.
      const times = new Map<string, number>()
      for (const log of logs) {
        const topic = log.topics?.[1]
        if (!topic) continue
        if (!times.has(log.blockNumber)) {
          const block = await onChain<{ timestamp?: string } | null>(
            chainId,
            'eth_getBlockByNumber',
            [log.blockNumber, false],
          )
          if (!block?.timestamp) throw new Error(`No block ${log.blockNumber}`)
          times.set(log.blockNumber, Number(block.timestamp))
        }
        known.created[`0x${topic.slice(26)}`.toLowerCase()] =
          times.get(log.blockNumber) ?? 0
      }
      // The chunk is complete: move the cursor past it and keep it.
      cursor = to
      known.scannedTo = to
      writeStored(chainId, known)
    }
    paused.delete(chainId)
    if (cursor >= target) {
      // Caught up: from here a read is a chunk every RESCAN_MS at most, so
      // the budget, which bounds catching up, starts over.
      caughtUpAt.set(chainId, Date.now())
      chunksRead.delete(chainId)
    }
  } catch (err) {
    const failures = (pause?.failures ?? 0) + 1
    paused.set(chainId, {
      failures,
      until:
        Date.now() +
        Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** (failures - 1)),
    })
    console.warn(`Registry creation scan failed on ${chainId}`, err)
  }
  return known.created
}

const scanOnce = (chainId: number): Promise<Record<string, number>> => {
  const running = inFlight.get(chainId)
  if (running) return running
  const scan = scanChain(chainId).finally(() => inFlight.delete(chainId))
  inFlight.set(chainId, scan)
  return scan
}

const toMap = (
  entries: (readonly [number, Record<string, number>])[],
): Map<string, number> => {
  const map = new Map<string, number>()
  for (const [chainId, created] of entries)
    for (const [address, time] of Object.entries(created))
      map.set(`${chainId}:${address}`, time)
  return map
}

/** What is known now, synchronously: the snapshot plus this browser's reads. */
export const readCachedCreationTimes = (
  chainIds: number[],
): Map<string, number> =>
  toMap(
    chainIds.map((chainId) => [chainId, knownFor(chainId).created] as const),
  )

/**
 * Map of `${chainId}:${lowercase address}` → creation time (unix seconds),
 * after reading the blocks since the snapshot (within the load's budget).
 * Never rejects: a chain whose scan failed answers with what is known.
 */
export const fetchRegistryCreationTimes = async (
  chainIds: number[],
): Promise<Map<string, number>> =>
  toMap(
    await Promise.all(
      chainIds.map(
        async (chainId) => [chainId, await scanOnce(chainId)] as const,
      ),
    ),
  )
