/**
 * RPC fallback utilities for fetching TCR data when the Envio subgraph is down.
 * Uses viem for type-safe contract reads and event fetching.
 *
 * Classic TCR — uses GeneralizedTCRView.queryItems() (on-chain batch fetch).
 * Light   TCR — two-phase approach:
 *   Phase 1 (lightweight): NewItem events + TCR.items() mapping for status.
 *   Phase 2 (page only):   LightGeneralizedTCRView.getItem() via multicall,
 *                           called ONLY for the items on the visible page.
 *
 * Both functions return data shaped to match the subgraph response so the
 * existing component code can consume it without changes.
 *
 * NOTE: LightGeneralizedTCRView has no queryItems() equivalent, so light-item
 * enumeration is inherently O(all_items). We minimize the cost by:
 *   - Starting event scans from factory deployment blocks (not genesis).
 *   - Using lightweight TCR.items() multicall (~500/batch) for status counts.
 *   - Calling the heavy VIEW.getItem() only for the ~40 items on the page.
 *   - Capping at MAX_LIGHT_ITEMS to prevent runaway.
 */
import {
  createPublicClient,
  http,
  zeroAddress,
  type Abi,
  type Address,
  type PublicClient,
} from 'viem'
import { mainnet, gnosis, sepolia } from 'viem/chains'
import { getAlchemyRpcUrl } from 'config/rpc'
import { gtcrViewAddresses, lightGtcrViewAddresses } from 'config/tcr-addresses'
import _GeneralizedTCRViewAbi from '../assets/abis/GeneralizedTCRView.json'
import _GeneralizedTCRAbi from '../assets/abis/GeneralizedTCR.json'
import _LightGeneralizedTCRAbi from '../assets/abis/LightGeneralizedTCR.json'
import _LightGeneralizedTCRViewAbi from '../assets/abis/LightGeneralizedTCRView.json'

const classicViewAbi = _GeneralizedTCRViewAbi as unknown as Abi
const classicGtcrAbi = _GeneralizedTCRAbi as unknown as Abi
const lightGtcrAbi = _LightGeneralizedTCRAbi as unknown as Abi
const lightViewAbi = _LightGeneralizedTCRViewAbi as unknown as Abi

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const

const STATUS_NAMES = [
  'Absent',
  'Registered',
  'RegistrationRequested',
  'ClearingRequested',
] as const

const RULING_NAMES = ['None', 'Accept', 'Reject'] as const

/** Block range per getLogs RPC call. Keeps us within Alchemy's limits. */
const LOG_CHUNK_SIZE = 50_000n
/** Max concurrent getLogs chunk requests. Keeps us under Alchemy rate limits. */
const LOG_CHUNK_CONCURRENCY = 5
/** Items per multicall batch for heavy VIEW.getItem() calls. */
const MULTICALL_BATCH_SIZE = 200
/** Items per multicall batch for lightweight TCR.items() calls. */
const LIGHTWEIGHT_BATCH_SIZE = 500
/** Max light-TCR items to fetch in fallback mode (safety cap). */
const MAX_LIGHT_ITEMS = 5_000

/**
 * Earliest block to start event scanning per chain.
 * Based on Kleros TCR factory deployment dates (~2020 for Classic, ~2022 for
 * Light). Skipping pre-deployment blocks avoids hundreds of empty getLogs
 * round-trips — the single largest cost in the RPC fallback path.
 */
const EARLIEST_BLOCK: Record<number, bigint> = {
  1: 9_000_000n, // Mainnet — Classic factory deployed ~mid 2020
  100: 13_000_000n, // Gnosis  — Classic factory deployed ~late 2020
  11155111: 2_000_000n, // Sepolia — testnet, safe lower bound
}

// ---------------------------------------------------------------------------
// Viem client
// ---------------------------------------------------------------------------

const viemChains = { 1: mainnet, 100: gnosis, 11155111: sepolia } as const

const clientCache = new Map<number, PublicClient>()

function getClient(chainId: number): PublicClient | null {
  const cached = clientCache.get(chainId)
  if (cached) return cached

  const chain = viemChains[chainId as keyof typeof viemChains]
  const url = getAlchemyRpcUrl(chainId)
  if (!chain || !url) return null

  const client = createPublicClient({ chain, transport: http(url) })
  clientCache.set(chainId, client)
  return client
}

// ---------------------------------------------------------------------------
// Shared types (matching the subgraph response shape)
// ---------------------------------------------------------------------------

interface SubgraphRound {
  appealed: boolean
  appealPeriodStart: string
  appealPeriodEnd: string
  ruling: string
  hasPaidRequester: boolean
  hasPaidChallenger: boolean
  amountPaidRequester: string
  amountPaidChallenger: string
  txHashAppealPossible?: string
  txHashAppealDecision?: string
  appealedAt?: string
}

interface SubgraphRequest {
  requestType: string
  disputed: boolean
  disputeID: string
  submissionTime: string
  resolved: boolean
  requester: string
  challenger: string
  arbitrator: string
  arbitratorExtraData: string
  deposit: string
  resolutionTime: string
  disputeOutcome: string
  rounds: SubgraphRound[]
  creationTx?: string
  resolutionTx?: string
  evidenceGroup?: { evidences: unknown[] }
}

interface SubgraphItem {
  itemID: string
  status: string
  disputed: boolean
  data: string
  props?: unknown[]
  requests: SubgraphRequest[]
  [key: string]: unknown
}

interface RegistryCounts {
  numberOfAbsent: string
  numberOfRegistered: string
  numberOfRegistrationRequested: string
  numberOfClearingRequested: string
  numberOfChallengedRegistrations: string
  numberOfChallengedClearing: string
}

interface WhereClause {
  _or?: WhereClause[]
  [key: string]: { _eq?: string | boolean } | WhereClause[] | undefined
}

/** Fields shared by both Classic and Light QueryResult from the View contracts. */
interface QueryResultBase {
  ID: `0x${string}`
  status: number
  disputed: boolean
  resolved: boolean
  disputeID: bigint
  appealed: boolean
  appealStart: bigint
  appealEnd: bigint
  ruling: number
  requester: Address
  challenger: Address
  arbitrator: Address
  arbitratorExtraData: `0x${string}`
  hasPaid: readonly [boolean, boolean, boolean]
  submissionTime: bigint
  amountPaid: readonly [bigint, bigint, bigint]
}

/** Classic QueryResult adds the `data` bytes field. */
interface ClassicQueryResult extends QueryResultBase {
  data: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fetch contract events in chunks to respect Alchemy block-range limits.
 *  Chunks are fetched with bounded concurrency for speed while staying
 *  under Alchemy's rate limits.
 */
async function fetchEventsChunked<T>(
  client: PublicClient,
  fetchChunk: (fromBlock: bigint, toBlock: bigint) => Promise<T[]>,
  startBlock: bigint = 0n,
): Promise<T[]> {
  const latestBlock = await client.getBlockNumber()

  // Build the list of [from, to] ranges.
  const ranges: [bigint, bigint][] = []
  for (let from = startBlock; from <= latestBlock; from += LOG_CHUNK_SIZE) {
    const to =
      from + LOG_CHUNK_SIZE - 1n > latestBlock
        ? latestBlock
        : from + LOG_CHUNK_SIZE - 1n
    ranges.push([from, to])
  }

  // Fetch chunks with bounded concurrency, preserving order.
  const all: T[] = []
  for (let i = 0; i < ranges.length; i += LOG_CHUNK_CONCURRENCY) {
    const batch = ranges.slice(i, i + LOG_CHUNK_CONCURRENCY)
    const results = await Promise.all(
      batch.map(([from, to]) => fetchChunk(from, to)),
    )
    for (const events of results) all.push(...events)
  }
  return all
}

/** Match an item against a Hasura-style `where` clause (`_eq` and `_or`). */
function matchesWhere(
  item: Record<string, unknown>,
  where: WhereClause,
): boolean {
  if (where._or) return where._or.some((cond) => matchesWhere(item, cond))

  for (const [key, cond] of Object.entries(where)) {
    if (key === 'registry_id' || key === '_or') continue
    if (
      typeof cond === 'object' &&
      cond !== null &&
      !Array.isArray(cond) &&
      '_eq' in cond &&
      item[key] !== cond._eq
    )
      return false
  }
  return true
}

/** Map a single RPC QueryResult into the subgraph "latest request" shape. */
function rpcItemToRequest(rpc: QueryResultBase): SubgraphRequest {
  const ruling = RULING_NAMES[rpc.ruling] ?? 'None'
  const requestType =
    rpc.status === 3 ? 'ClearingRequested' : 'RegistrationRequested'
  return {
    requestType,
    disputed: rpc.disputed,
    disputeID: rpc.disputeID.toString(),
    submissionTime: rpc.submissionTime.toString(),
    resolved: rpc.resolved,
    requester: rpc.requester,
    challenger: rpc.challenger,
    arbitrator: rpc.arbitrator,
    arbitratorExtraData: rpc.arbitratorExtraData,
    deposit: '0',
    resolutionTime: '0',
    disputeOutcome: ruling,
    evidenceGroup: { evidences: [] },
    rounds: [
      {
        appealed: rpc.appealed,
        appealPeriodStart: rpc.appealStart.toString(),
        appealPeriodEnd: rpc.appealEnd.toString(),
        ruling,
        hasPaidRequester: rpc.hasPaid[1],
        hasPaidChallenger: rpc.hasPaid[2],
        amountPaidRequester: rpc.amountPaid[1].toString(),
        amountPaidChallenger: rpc.amountPaid[2].toString(),
      },
    ],
  }
}

/** Compute per-status item counts for the Light registry shape. */
function computeRegistryCounts(items: SubgraphItem[]): RegistryCounts {
  const c = {
    absent: 0,
    registered: 0,
    regReq: 0,
    clearReq: 0,
    chalReg: 0,
    chalClear: 0,
  }
  for (const item of items)
    switch (item.status) {
      case 'Absent':
        c.absent++
        break
      case 'Registered':
        c.registered++
        break
      case 'RegistrationRequested':
        item.disputed ? c.chalReg++ : c.regReq++
        break
      case 'ClearingRequested':
        item.disputed ? c.chalClear++ : c.clearReq++
        break
    }
  return {
    numberOfAbsent: String(c.absent),
    numberOfRegistered: String(c.registered),
    numberOfRegistrationRequested: String(c.regReq),
    numberOfClearingRequested: String(c.clearReq),
    numberOfChallengedRegistrations: String(c.chalReg),
    numberOfChallengedClearing: String(c.chalClear),
  }
}

// ---------------------------------------------------------------------------
// MetaEvidence fallback (used by tcr-view.ts and light-tcr-view.ts)
// ---------------------------------------------------------------------------

/**
 * Last-resort fallback: fetch MetaEvidence URI from on-chain event logs
 * when all subgraphs are unavailable. Uses chunked getLogs to respect
 * Alchemy block-range limits.
 */
export const fetchMetaEvidenceViaRPC = async (
  tcr: string,
  networkId: number,
): Promise<{ metaEvidenceURI: string } | null> => {
  const client = getClient(networkId)
  if (!client) return null

  const events = await fetchEventsChunked(
    client,
    (from, to) =>
      client.getContractEvents({
        address: tcr as Address,
        abi: classicGtcrAbi,
        eventName: 'MetaEvidence',
        fromBlock: from,
        toBlock: to,
      }),
    EARLIEST_BLOCK[networkId] ?? 0n,
  )

  if (events.length === 0) return null

  const args = events[events.length - 1].args as { _evidence?: string }
  if (!args._evidence) return null

  return { metaEvidenceURI: args._evidence }
}

// ---------------------------------------------------------------------------
// Registry type detection
// ---------------------------------------------------------------------------

/**
 * Detect whether a contract address is a Classic or Light TCR via RPC.
 * Uses unique function selectors as discriminators:
 *   - Classic has `itemCount()` (Light doesn't)
 *   - Light   has `relayerContract()` (Classic doesn't)
 */
export const detectRegistryTypeViaRPC = async (
  tcrAddress: string,
  chainId: number,
): Promise<'classic' | 'light' | null> => {
  const client = getClient(chainId)
  if (!client) return null

  // Classic TCR exposes itemCount(); Light does not.
  try {
    await client.readContract({
      address: tcrAddress as Address,
      abi: classicGtcrAbi,
      functionName: 'itemCount',
    })
    return 'classic'
  } catch {
    // Not classic — try light.
  }

  // Light TCR exposes relayerContract(); Classic does not.
  try {
    await client.readContract({
      address: tcrAddress as Address,
      abi: lightGtcrAbi,
      functionName: 'relayerContract',
    })
    return 'light'
  } catch {
    // Not light either.
  }

  return null
}

// ---------------------------------------------------------------------------
// Classic TCR
// ---------------------------------------------------------------------------

/**
 * Fallback: fetch Classic TCR items via RPC when the Envio subgraph is down.
 * Uses `GeneralizedTCRView.queryItems()`.
 */
export const fetchClassicItemsViaRPC = async (
  tcrAddress: string,
  chainId: number,
  where?: WhereClause,
): Promise<{ items: SubgraphItem[] } | null> => {
  const client = getClient(chainId)
  const viewAddr = gtcrViewAddresses[chainId]
  if (!client || !viewAddr) return null

  const filter = [true, true, true, true, true, true, false, false] as const
  const BATCH_SIZE = 100n
  let allItems: SubgraphItem[] = []
  let cursor = 0n
  let hasMore = true

  while (hasMore) {
    const result = (await client.readContract({
      address: viewAddr as Address,
      abi: classicViewAbi,
      functionName: 'queryItems',
      args: [
        tcrAddress as Address,
        cursor,
        BATCH_SIZE,
        filter,
        false,
        zeroAddress,
        BATCH_SIZE,
      ],
    })) as unknown as [ClassicQueryResult[], boolean]
    const [results, more] = result

    hasMore = more

    const valid = results.filter((r) => r.ID !== ZERO_BYTES32)
    for (const rpc of valid) {
      const status = STATUS_NAMES[rpc.status] ?? 'Absent'
      allItems.push({
        itemID: rpc.ID,
        status,
        disputed: rpc.disputed,
        data: rpc.data,
        requests: [rpcItemToRequest(rpc)],
      })
    }

    if (BigInt(valid.length) < BATCH_SIZE) break
    cursor += BATCH_SIZE
  }

  if (where) allItems = allItems.filter((item) => matchesWhere(item, where))

  return { items: allItems }
}

// ---------------------------------------------------------------------------
// Light TCR
// ---------------------------------------------------------------------------

/**
 * Fallback: fetch Light TCR items via RPC when the Envio subgraph is down.
 *
 * Two-phase strategy to minimize RPC cost:
 *   Phase 1 (ALL items, lightweight):
 *     - NewItem events (chunked, from deployment block) → item IDs + IPFS URIs.
 *     - TCR.items() multicall (~500/batch) → status + requestCount.
 *     - TCR.getRequestInfo() multicall for pending items only → disputed flag
 *       + accurate submissionTime. (Absent/Registered items are never disputed.)
 *   Phase 2 (PAGE items only, heavy):
 *     - VIEW.getItem() multicall (~200/batch) → full request/round data,
 *       called ONLY for the ~40 items the user actually sees.
 *
 * For a registry with 1 000 items (50 pending) this costs ~105 RPC calls
 * vs ~705 without deployment-block optimisation + all-items getItem().
 */
export const fetchLightItemsViaRPC = async (
  tcrAddress: string,
  chainId: number,
  queryVariables?: {
    where?: WhereClause
    offset?: number
    limit?: number
    order_by?: { latestRequestSubmissionTime?: string }[]
  },
): Promise<{ litems: SubgraphItem[]; lregistry: RegistryCounts } | null> => {
  const client = getClient(chainId)
  const viewAddr = lightGtcrViewAddresses[chainId]
  if (!client || !viewAddr) return null

  const startBlock = EARLIEST_BLOCK[chainId] ?? 0n

  // ---- Phase 1a: Discover all item IDs via NewItem events ---------------

  const events = await fetchEventsChunked(
    client,
    (from, to) =>
      client.getContractEvents({
        address: tcrAddress as Address,
        abi: lightGtcrAbi,
        eventName: 'NewItem',
        fromBlock: from,
        toBlock: to,
      }),
    startBlock,
  )

  // Deduplicate: keep the first (earliest) NewItem per itemID.
  // Also record block number as a sort-time proxy for non-pending items.
  const itemMap = new Map<`0x${string}`, { data: string; block: bigint }>()
  for (const event of events) {
    const args = event.args as { _itemID?: `0x${string}`; _data?: string }
    const id = args._itemID!
    if (!itemMap.has(id))
      itemMap.set(id, { data: args._data!, block: event.blockNumber })
  }

  // Safety cap — avoid runaway for very large registries.
  let entries = [...itemMap.entries()]
  if (entries.length > MAX_LIGHT_ITEMS) {
    console.warn(
      `RPC fallback: ${entries.length} items discovered, capping at ${MAX_LIGHT_ITEMS}`,
    )
    entries = entries.slice(0, MAX_LIGHT_ITEMS)
  }

  // ---- Phase 1b: Lightweight status for ALL items via TCR.items() -------
  //  items(bytes32) → { status: uint8, sumDeposit: uint128, requestCount: uint120 }
  //  Much cheaper than VIEW.getItem() (~1 SLOAD vs ~5 SLOADs per item).

  const statusMap = new Map<
    `0x${string}`,
    { status: number; requestCount: bigint }
  >()

  for (let i = 0; i < entries.length; i += LIGHTWEIGHT_BATCH_SIZE) {
    const batch = entries.slice(i, i + LIGHTWEIGHT_BATCH_SIZE)
    const results = await client.multicall({
      contracts: batch.map(([itemID]) => ({
        address: tcrAddress as Address,
        abi: lightGtcrAbi,
        functionName: 'items' as const,
        args: [itemID] as const,
      })),
    })
    for (const [j, res] of results.entries())
      if (res.status === 'success') {
        const [status, , requestCount] = res.result as [number, bigint, bigint]
        statusMap.set(batch[j][0], { status, requestCount })
      }
  }

  // ---- Phase 1c: Disputed flag + submissionTime for PENDING items only --
  //  Only status 2 (RegistrationRequested) and 3 (ClearingRequested) can
  //  be disputed. For Absent/Registered items, disputed is always false.

  const pendingEntries = entries.filter(([id]) => {
    const s = statusMap.get(id)
    return s && (s.status === 2 || s.status === 3) && s.requestCount > 0n
  })

  const requestInfoMap = new Map<
    `0x${string}`,
    { disputed: boolean; submissionTime: bigint }
  >()

  for (let i = 0; i < pendingEntries.length; i += MULTICALL_BATCH_SIZE) {
    const batch = pendingEntries.slice(i, i + MULTICALL_BATCH_SIZE)
    const results = await client.multicall({
      contracts: batch.map(([itemID]) => ({
        address: tcrAddress as Address,
        abi: lightGtcrAbi,
        functionName: 'getRequestInfo' as const,
        args: [itemID, statusMap.get(itemID)!.requestCount - 1n] as const,
      })),
    })
    for (const [j, res] of results.entries())
      if (res.status === 'success') {
        // getRequestInfo returns (disputed, disputeID, submissionTime, ...)
        const r = res.result as unknown as [
          boolean,
          bigint,
          bigint,
          ...unknown[],
        ]
        requestInfoMap.set(batch[j][0], {
          disputed: r[0],
          submissionTime: r[2],
        })
      }
  }

  // ---- Build lightweight items list for counting / filtering / sorting --

  interface LightItem {
    itemID: `0x${string}`
    data: string
    status: string
    disputed: boolean
    submissionTime: number
  }

  const lightItems: LightItem[] = []
  for (const [itemID, { data, block }] of entries) {
    const s = statusMap.get(itemID)
    if (!s) continue
    const status = STATUS_NAMES[s.status] ?? 'Absent'
    const reqInfo = requestInfoMap.get(itemID)
    lightItems.push({
      itemID,
      data,
      status,
      disputed: reqInfo?.disputed ?? false,
      // Pending items get the real submissionTime; others use the event
      // block number as a proxy (good enough for sorting in fallback mode).
      submissionTime: reqInfo ? Number(reqInfo.submissionTime) : Number(block),
    })
  }

  // ---- Registry counts (computed from ALL items, before filtering) ------

  const lregistry = computeRegistryCounts(
    lightItems.map((li) => ({
      itemID: li.itemID,
      status: li.status,
      disputed: li.disputed,
      data: li.data,
      requests: [],
    })),
  )

  // ---- Filter / sort / paginate -----------------------------------------

  let filtered: LightItem[] = lightItems
  if (queryVariables?.where)
    filtered = filtered.filter((item) =>
      matchesWhere(
        item as unknown as Record<string, unknown>,
        queryVariables.where!,
      ),
    )

  const sortDir = queryVariables?.order_by?.[0]?.latestRequestSubmissionTime
  if (sortDir)
    filtered.sort((a, b) =>
      sortDir === 'asc'
        ? a.submissionTime - b.submissionTime
        : b.submissionTime - a.submissionTime,
    )

  const offset = queryVariables?.offset ?? 0
  const limit = queryVariables?.limit ?? filtered.length
  const pageItems = filtered.slice(offset, offset + limit)

  // ---- Phase 2: Full item data for the VISIBLE PAGE only ----------------

  const litems: SubgraphItem[] = []

  for (let i = 0; i < pageItems.length; i += MULTICALL_BATCH_SIZE) {
    const batch = pageItems.slice(i, i + MULTICALL_BATCH_SIZE)
    const results = await client.multicall({
      contracts: batch.map((li) => ({
        address: viewAddr as Address,
        abi: lightViewAbi,
        functionName: 'getItem' as const,
        args: [tcrAddress as Address, li.itemID] as const,
      })),
    })

    for (const [j, res] of results.entries()) {
      const li = batch[j]
      if (res.status === 'failure') {
        // Graceful degradation — build a minimal item from Phase 1 data.
        litems.push({
          itemID: li.itemID,
          status: li.status,
          disputed: li.disputed,
          data: li.data,
          props: [],
          requests: [
            {
              requestType:
                li.status === 'ClearingRequested'
                  ? 'ClearingRequested'
                  : 'RegistrationRequested',
              disputed: li.disputed,
              disputeID: '0',
              submissionTime: li.submissionTime.toString(),
              resolved: li.status === 'Absent' || li.status === 'Registered',
              requester: zeroAddress,
              challenger: zeroAddress,
              arbitrator: zeroAddress,
              arbitratorExtraData: '0x',
              deposit: '0',
              resolutionTime: '0',
              disputeOutcome: 'None',
              rounds: [],
            },
          ],
        })
        continue
      }
      const rpc = res.result as unknown as QueryResultBase
      const status = STATUS_NAMES[rpc.status] ?? 'Absent'
      litems.push({
        itemID: li.itemID,
        status,
        disputed: rpc.disputed,
        data: li.data,
        props: [],
        requests: [rpcItemToRequest(rpc)],
      })
    }
  }

  return { litems, lregistry }
}

// ---------------------------------------------------------------------------
// Single-item detail fallbacks (for item detail pages)
// ---------------------------------------------------------------------------

/**
 * Fallback: fetch a single Classic TCR item via RPC.
 * Uses `GeneralizedTCRView.getItem()` which returns encoded `data`.
 */
export const fetchClassicItemDetailViaRPC = async (
  tcrAddress: string,
  itemID: string,
  chainId: number,
): Promise<{ item: SubgraphItem } | null> => {
  const client = getClient(chainId)
  const viewAddr = gtcrViewAddresses[chainId]
  if (!client || !viewAddr) return null

  const rpc = (await client.readContract({
    address: viewAddr as Address,
    abi: classicViewAbi,
    functionName: 'getItem',
    args: [tcrAddress as Address, itemID as `0x${string}`],
  })) as unknown as ClassicQueryResult
  if (rpc.ID === ZERO_BYTES32) return null

  const status = STATUS_NAMES[rpc.status] ?? 'Absent'
  return {
    item: {
      itemID: rpc.ID,
      data: rpc.data,
      status,
      disputed: rpc.disputed,
      requests: [rpcItemToRequest(rpc)],
    },
  }
}

/**
 * Fallback: fetch a single Light TCR item via RPC.
 * Uses `LightGeneralizedTCRView.getItem()` for status/metadata and
 * `NewItem` event log (chunked) for the IPFS URI.
 */
export const fetchLightItemDetailViaRPC = async (
  tcrAddress: string,
  itemID: string,
  chainId: number,
): Promise<{ litem: SubgraphItem } | null> => {
  const client = getClient(chainId)
  const viewAddr = lightGtcrViewAddresses[chainId]
  if (!client || !viewAddr) return null

  const rpc = (await client.readContract({
    address: viewAddr as Address,
    abi: lightViewAbi,
    functionName: 'getItem',
    args: [tcrAddress as Address, itemID as `0x${string}`],
  })) as unknown as QueryResultBase
  if (rpc.ID === ZERO_BYTES32) return null

  // Get IPFS URI from the NewItem event (indexed by itemID).
  const events = await fetchEventsChunked(
    client,
    (from, to) =>
      client.getContractEvents({
        address: tcrAddress as Address,
        abi: lightGtcrAbi,
        eventName: 'NewItem',
        args: { _itemID: itemID as `0x${string}` },
        fromBlock: from,
        toBlock: to,
      }),
    EARLIEST_BLOCK[chainId] ?? 0n,
  )
  const ipfsUri =
    events.length > 0
      ? ((events[0].args as { _data?: string })._data ?? '')
      : ''

  const status = STATUS_NAMES[rpc.status] ?? 'Absent'
  return {
    litem: {
      itemID,
      data: ipfsUri,
      status,
      disputed: rpc.disputed,
      requests: [rpcItemToRequest(rpc)],
    },
  }
}
