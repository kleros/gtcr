/**
 * RPC fallback for fetching TCR items when the Envio subgraph is down.
 *
 * Classic TCR — uses GeneralizedTCRView.queryItems() (batch fetch).
 * Light   TCR — uses NewItem event logs (for IPFS URIs) +
 *               LightGeneralizedTCRView.getItem() (for status/metadata).
 *
 * Both functions return data shaped to match the subgraph response so the
 * existing component code can consume it without changes.
 */
import { ethers } from 'ethers'
import { getAlchemyRpcUrl } from 'config/rpc'
import _GTCRView from 'assets/abis/GeneralizedTCRView.json'
import _LightGTCRView from 'assets/abis/LightGeneralizedTCRView.json'
import _LightGTCR from 'assets/abis/LightGeneralizedTCR.json'
import { gtcrViewAddresses, lightGtcrViewAddresses } from 'config/tcr-addresses'

const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const STATUS_NAMES = [
  'Absent',
  'Registered',
  'RegistrationRequested',
  'ClearingRequested',
]
const RULING_NAMES = ['None', 'Accept', 'Reject']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Match an item against a Hasura-style `where` clause (supports `_eq` and `_or`). */
function matchesWhere(
  item: Record<string, unknown>,
  where: Record<string, any>,
): boolean {
  if (where._or)
    return (where._or as Record<string, any>[]).some((cond) =>
      matchesWhere(item, cond),
    )

  for (const [key, cond] of Object.entries(where)) {
    if (key === 'registry_id' || key === '_or') continue
    if (
      typeof cond === 'object' &&
      cond !== null &&
      '_eq' in cond &&
      item[key] !== (cond as any)._eq
    )
      return false
  }
  return true
}

/** Map a single RPC QueryResult into the subgraph "latest request" shape. */
function rpcItemToRequest(rpc: any) {
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
    arbitratorExtraData: rpc.arbitratorExtraData
      ? ethers.utils.hexlify(rpc.arbitratorExtraData)
      : '0x',
    deposit: '0',
    resolutionTime: '0',
    disputeOutcome: ruling,
    rounds: [
      {
        appealed: rpc.appealed ?? false,
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

// ---------------------------------------------------------------------------
// Registry type detection
// ---------------------------------------------------------------------------

/**
 * Detect whether a contract address is a Classic or Light TCR via RPC.
 * Uses unique function selectors as discriminators:
 *   - Classic has `itemCount()` (Light doesn't)
 *   - Light   has `relayerContract()` (Classic doesn't)
 *
 * Returns `'classic'`, `'light'`, or `null` if neither.
 */
export const detectRegistryTypeViaRPC = async (
  tcrAddress: string,
  chainId: number,
): Promise<'classic' | 'light' | null> => {
  const rpcUrl = getAlchemyRpcUrl(chainId)
  if (!rpcUrl) return null

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl)

  // Classic TCR exposes itemCount(); Light does not.
  try {
    const contract = new ethers.Contract(
      tcrAddress,
      ['function itemCount() view returns (uint256)'],
      provider,
    )
    await contract.itemCount()
    return 'classic'
  } catch {
    // Not classic — try light.
  }

  // Light TCR exposes relayerContract(); Classic does not.
  try {
    const contract = new ethers.Contract(
      tcrAddress,
      ['function relayerContract() view returns (address)'],
      provider,
    )
    await contract.relayerContract()
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
 *
 * @returns Data shaped like the `CLASSIC_REGISTRY_ITEMS_QUERY` response, or
 *          `null` if the chain is unsupported.
 */
export const fetchClassicItemsViaRPC = async (
  tcrAddress: string,
  chainId: number,
  where?: Record<string, any>,
): Promise<{ items: any[] } | null> => {
  const rpcUrl = getAlchemyRpcUrl(chainId)
  const viewAddr =
    gtcrViewAddresses[String(chainId) as keyof typeof gtcrViewAddresses]
  if (!rpcUrl || !viewAddr) return null

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
  const gtcrView = new ethers.Contract(viewAddr, _GTCRView, provider)

  // Include every status; component handles client-side filtering.
  const filter = [true, true, true, true, true, true, false, false]
  const BATCH_SIZE = 100
  let allItems: any[] = []
  let cursor = 0
  let hasMore = true

  while (hasMore) {
    const result = await gtcrView.queryItems(
      tcrAddress,
      cursor,
      BATCH_SIZE,
      filter,
      false,
      ZERO_ADDRESS,
      BATCH_SIZE,
    )

    const results: any[] = result[0]
    hasMore = result[1]

    const valid = results.filter((r: any) => r.ID !== ZERO_BYTES32)
    for (const rpc of valid) {
      const status = STATUS_NAMES[rpc.status] ?? 'Absent'
      allItems.push({
        itemID: rpc.ID,
        status,
        disputed: rpc.disputed,
        data: ethers.utils.hexlify(rpc.data),
        requests: [rpcItemToRequest(rpc)],
      })
    }

    if (valid.length < BATCH_SIZE) break
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
 * Uses `NewItem` event logs for IPFS URIs and
 * `LightGeneralizedTCRView.getItem()` for status/metadata.
 *
 * Returns data shaped like the `LIGHT_ITEMS_QUERY` response, including
 * pagination and registry counts, or `null` if the chain is unsupported.
 */
export const fetchLightItemsViaRPC = async (
  tcrAddress: string,
  chainId: number,
  queryVariables?: {
    where?: Record<string, any>
    offset?: number
    limit?: number
    order_by?: { latestRequestSubmissionTime?: string }[]
  },
): Promise<{ litems: any[]; lregistry: any } | null> => {
  const rpcUrl = getAlchemyRpcUrl(chainId)
  const viewAddr =
    lightGtcrViewAddresses[
      String(chainId) as keyof typeof lightGtcrViewAddresses
    ]
  if (!rpcUrl || !viewAddr) return null

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
  const lightTcr = new ethers.Contract(tcrAddress, _LightGTCR, provider)
  const lightView = new ethers.Contract(viewAddr, _LightGTCRView, provider)

  // Step 1 — Get all NewItem events to collect (itemID → ipfsURI).
  const logs = await provider.getLogs({
    ...lightTcr.filters.NewItem(),
    fromBlock: 0,
  })
  const parsedEvents = logs.map((log) => lightTcr.interface.parseLog(log))

  // Deduplicate: keep the first (earliest) NewItem per itemID.
  const itemMap = new Map<string, string>()
  for (const event of parsedEvents) {
    const id: string = event.args._itemID
    if (!itemMap.has(id)) itemMap.set(id, event.args._data)
  }

  // Step 2 — Fetch status for each item via the View contract.
  const entries = [...itemMap.entries()]
  const CONCURRENCY = 10
  let allItems: any[] = []

  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      batch.map(async ([itemID, ipfsUri]) => {
        try {
          const rpc = await lightView.getItem(tcrAddress, itemID)
          const status = STATUS_NAMES[rpc.status] ?? 'Absent'
          return {
            itemID,
            status,
            disputed: rpc.disputed,
            data: ipfsUri,
            props: [], // Existing IPFS fallback in the component resolves these.
            requests: [rpcItemToRequest(rpc)],
          }
        } catch (err) {
          console.warn(`RPC fallback: failed to fetch item ${itemID}`, err)
          return null
        }
      }),
    )
    allItems.push(...results.filter(Boolean))
  }

  // Step 3 — Compute registry counts from ALL items (before filtering).
  const lregistry = {
    numberOfAbsent: '0',
    numberOfRegistered: '0',
    numberOfRegistrationRequested: '0',
    numberOfClearingRequested: '0',
    numberOfChallengedRegistrations: '0',
    numberOfChallengedClearing: '0',
  }
  for (const item of allItems)
    switch (item.status) {
      case 'Absent':
        lregistry.numberOfAbsent = String(Number(lregistry.numberOfAbsent) + 1)
        break
      case 'Registered':
        lregistry.numberOfRegistered = String(
          Number(lregistry.numberOfRegistered) + 1,
        )
        break
      case 'RegistrationRequested':
        if (item.disputed)
          lregistry.numberOfChallengedRegistrations = String(
            Number(lregistry.numberOfChallengedRegistrations) + 1,
          )
        else
          lregistry.numberOfRegistrationRequested = String(
            Number(lregistry.numberOfRegistrationRequested) + 1,
          )
        break
      case 'ClearingRequested':
        if (item.disputed)
          lregistry.numberOfChallengedClearing = String(
            Number(lregistry.numberOfChallengedClearing) + 1,
          )
        else
          lregistry.numberOfClearingRequested = String(
            Number(lregistry.numberOfClearingRequested) + 1,
          )
        break
    }

  // Step 4 — Apply where filter.
  if (queryVariables?.where)
    allItems = allItems.filter((item) =>
      matchesWhere(item, queryVariables.where!),
    )

  // Step 5 — Sort (match subgraph `latestRequestSubmissionTime` ordering).
  const sortDir = queryVariables?.order_by?.[0]?.latestRequestSubmissionTime
  if (sortDir)
    allItems.sort((a, b) => {
      const ta = Number(a.requests[0]?.submissionTime || 0)
      const tb = Number(b.requests[0]?.submissionTime || 0)
      return sortDir === 'asc' ? ta - tb : tb - ta
    })

  // Step 6 — Paginate.
  const offset = queryVariables?.offset ?? 0
  const limit = queryVariables?.limit ?? allItems.length
  const paginated = allItems.slice(offset, offset + limit)

  return { litems: paginated, lregistry }
}

// ---------------------------------------------------------------------------
// Single-item detail fallbacks (for item detail pages)
// ---------------------------------------------------------------------------

/**
 * Fallback: fetch a single Classic TCR item via RPC.
 * Uses `GeneralizedTCRView.getItem()` which returns encoded `data`.
 *
 * @returns Data shaped like the `CLASSIC_ITEM_DETAILS_QUERY` response.
 */
export const fetchClassicItemDetailViaRPC = async (
  tcrAddress: string,
  itemID: string,
  chainId: number,
): Promise<{ item: any } | null> => {
  const rpcUrl = getAlchemyRpcUrl(chainId)
  const viewAddr =
    gtcrViewAddresses[String(chainId) as keyof typeof gtcrViewAddresses]
  if (!rpcUrl || !viewAddr) return null

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
  const gtcrView = new ethers.Contract(viewAddr, _GTCRView, provider)

  const rpc = await gtcrView.getItem(tcrAddress, itemID)
  if (!rpc || rpc.ID === ZERO_BYTES32) return null

  const status = STATUS_NAMES[rpc.status] ?? 'Absent'
  return {
    item: {
      itemID: rpc.ID,
      data: ethers.utils.hexlify(rpc.data),
      status,
      disputed: rpc.disputed,
      requests: [rpcItemToRequest(rpc)],
    },
  }
}

/**
 * Fallback: fetch a single Light TCR item via RPC.
 * Uses `LightGeneralizedTCRView.getItem()` for status/metadata and
 * `NewItem` event log for the IPFS URI.
 *
 * @returns Data shaped like the `LIGHT_ITEM_DETAILS_QUERY` response.
 */
export const fetchLightItemDetailViaRPC = async (
  tcrAddress: string,
  itemID: string,
  chainId: number,
): Promise<{ litem: any } | null> => {
  const rpcUrl = getAlchemyRpcUrl(chainId)
  const viewAddr =
    lightGtcrViewAddresses[
      String(chainId) as keyof typeof lightGtcrViewAddresses
    ]
  if (!rpcUrl || !viewAddr) return null

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
  const lightTcr = new ethers.Contract(tcrAddress, _LightGTCR, provider)
  const lightView = new ethers.Contract(viewAddr, _LightGTCRView, provider)

  const rpc = await lightView.getItem(tcrAddress, itemID)
  if (!rpc || rpc.ID === ZERO_BYTES32) return null

  // Get IPFS URI from the NewItem event (indexed by itemID).
  const logs = await provider.getLogs({
    ...lightTcr.filters.NewItem(itemID),
    fromBlock: 0,
  })
  const ipfsUri =
    logs.length > 0 ? lightTcr.interface.parseLog(logs[0]).args._data : ''

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
