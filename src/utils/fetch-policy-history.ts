import { providers, utils } from 'ethers'
import { getAlchemyRpcUrl } from 'config/rpc'
import { parseIpfs } from 'utils/ipfs-parse'

export interface PolicyHistoryEntry {
  startDate: string
  endDate: string | null
  policyURI: string
  txHash: string
}

export type PolicyFetchMode = 'full' | 'latest'

const META_EVIDENCE_TOPIC = utils.id('MetaEvidence(uint256,string)')

/**
 * Per-chain public RPC endpoints prepended in front of Alchemy. Public
 * Gnosis RPCs allow much larger `getLogs` block ranges (100k) than Alchemy's
 * 10k-result cap, so they dominate the full-history scan. Chains without an
 * entry here just fall back to Alchemy.
 */
const RPC_URLS_BY_CHAIN: Record<number, string[]> = {
  100: [
    'https://rpc.gnosischain.com',
    'https://rpc.gnosis.gateway.fm',
    'https://gnosis-mainnet.public.blastapi.io',
  ],
}

/**
 * Chain-specific earliest block to scan from. Since gtcr supports
 * user-deployed TCRs, we don't know each registry's deployment block — we
 * use a chain-wide floor that predates the earliest real GTCR deployment
 * and let `getLogs` filter by address (cheap because the result set is
 * bounded by the number of policy updates, typically <20).
 */
const MIN_START_BLOCK: Record<number, number> = {
  1: 10_000_000,
  100: 14_600_000,
  11155111: 0,
}

const DEFAULT_START_BLOCK = 0

/**
 * Per-chain chunk size for the fallback path when a single-shot scan fails.
 * Alchemy mainnet/sepolia tolerate larger windows when filtered, public
 * Gnosis RPCs cap out around 100k per request — tuned per chain to avoid
 * under- or over-sizing. Unknown chains get the conservative default.
 */
const CHUNK_SIZE_BY_CHAIN: Record<number, number> = {
  1: 500_000,
  100: 100_000,
  11155111: 500_000,
}

const DEFAULT_CHUNK_SIZE = 100_000

// Concurrency budget for chunk fetches.
const MAX_CONCURRENT = 4

// Hard timeout per getLogs request.
const GET_LOGS_TIMEOUT_MS = 20_000

// Backward-scan window for 'latest' mode. Doubles each iteration until a hit
// is found or the starting floor is reached.
const BACKWARD_SCAN_INITIAL_WINDOW = 100_000
const BACKWARD_SCAN_MAX_ITERATIONS = 30

// Registration policies use odd _metaEvidenceID values (1, 3, 5, ...).
// Even values are clearing policies — filter those out.
const isRegistrationLog = (log: providers.Log): boolean =>
  BigInt(log.topics[1]) % 2n === 1n

const withTimeout = <T>(
  p: Promise<T>,
  ms: number,
  label: string,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const timeout = new Promise<never>((resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    )
  })
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer))
}

const buildProviders = (chainId: number): providers.JsonRpcProvider[] => {
  const urls = [
    ...(RPC_URLS_BY_CHAIN[chainId] ?? []),
    getAlchemyRpcUrl(chainId),
  ].filter((u): u is string => typeof u === 'string' && u.length > 0)

  if (urls.length === 0)
    throw new Error(`No RPC URL configured for chain ${chainId}`)

  return urls.map((url) => new providers.JsonRpcProvider(url, chainId))
}

/**
 * Try a getLogs request across the provider pool, returning the first
 * success. Each provider is raced against `GET_LOGS_TIMEOUT_MS` individually
 * so one slow endpoint doesn't hold up the whole scan.
 */
const getLogsWithFallback = async (
  pool: providers.JsonRpcProvider[],
  preferredIdx: number,
  address: string,
  fromBlock: number,
  toBlock: number | 'latest',
): Promise<providers.Log[]> => {
  const order = [
    preferredIdx,
    ...pool.map((_, i) => i).filter((i) => i !== preferredIdx),
  ]

  let lastError: unknown
  for (const idx of order)
    try {
      return await withTimeout(
        pool[idx].getLogs({
          address,
          topics: [META_EVIDENCE_TOPIC],
          fromBlock,
          toBlock,
        }),
        GET_LOGS_TIMEOUT_MS,
        `getLogs[${idx}] ${fromBlock}-${toBlock}`,
      )
    } catch (err) {
      lastError = err
    }

  throw lastError ?? new Error('All RPC providers failed')
}

/**
 * Try a single all-range request first. Most providers index logs by
 * address+topic and can return the entire history in one response when the
 * result set is small. Falls back to chunked scanning on failure (range
 * error, response-too-large, or timeout).
 */
const fetchAllRegistrationLogs = async (
  pool: providers.JsonRpcProvider[],
  chainId: number,
  address: string,
  fromBlock: number,
  toBlock: number,
): Promise<providers.Log[]> => {
  try {
    const logs = await getLogsWithFallback(pool, 0, address, fromBlock, toBlock)
    return logs.filter(isRegistrationLog)
  } catch (err) {
    console.warn('Single-shot policy scan failed, falling back to chunks:', err)
  }

  const chunkSize = CHUNK_SIZE_BY_CHAIN[chainId] ?? DEFAULT_CHUNK_SIZE
  const ranges: [number, number][] = []
  for (let start = fromBlock; start <= toBlock; start += chunkSize)
    ranges.push([start, Math.min(start + chunkSize - 1, toBlock)])

  const allLogs: providers.Log[] = []
  for (let i = 0; i < ranges.length; i += MAX_CONCURRENT) {
    const batch = ranges.slice(i, i + MAX_CONCURRENT)
    const batchResults = await Promise.all(
      batch.map(([start, end], batchIdx) =>
        getLogsWithFallback(
          pool,
          (i + batchIdx) % pool.length,
          address,
          start,
          end,
        ),
      ),
    )
    for (const logs of batchResults) allLogs.push(...logs)
  }

  return allLogs.filter(isRegistrationLog)
}

/**
 * Backward scan from chain head in exponentially growing windows. Stops as
 * soon as a registration event is found. Used by 'latest' mode to avoid
 * scanning the full history when only the newest entry is needed.
 */
const fetchLatestRegistrationLog = async (
  pool: providers.JsonRpcProvider[],
  address: string,
  startFloor: number,
  latestBlock: number,
): Promise<providers.Log[]> => {
  let toBlock = latestBlock
  let windowSize = BACKWARD_SCAN_INITIAL_WINDOW

  for (let i = 0; i < BACKWARD_SCAN_MAX_ITERATIONS; i++) {
    const fromBlock = Math.max(startFloor, toBlock - windowSize + 1)

    const logs = await getLogsWithFallback(pool, 0, address, fromBlock, toBlock)
    const registrationLogs = logs.filter(isRegistrationLog)

    if (registrationLogs.length > 0) {
      const latest = registrationLogs.reduce((a, b) =>
        a.blockNumber > b.blockNumber ? a : b,
      )
      return [latest]
    }

    if (fromBlock <= startFloor) return []

    toBlock = fromBlock - 1
    windowSize *= 2
  }

  return []
}

/**
 * Hydrates a set of MetaEvidence registration logs with block timestamps and
 * IPFS policy URIs, then links them into `PolicyHistoryEntry` records where
 * each entry's `endDate` is the `startDate` of the next valid entry.
 *
 * Expects `logs` to be in block-ascending order.
 */
const buildEntries = async (
  provider: providers.JsonRpcProvider,
  logs: providers.Log[],
): Promise<PolicyHistoryEntry[]> => {
  if (logs.length === 0) return []

  const blockTimestamps = new Map<number, number>()
  const uniqueBlocks = [...new Set(logs.map((l) => l.blockNumber))]
  await Promise.all(
    uniqueBlocks.map(async (blockNum) => {
      const block = await provider.getBlock(blockNum)
      if (block) blockTimestamps.set(blockNum, block.timestamp)
    }),
  )

  const ipfsResults = await Promise.all(
    logs.map(async (log) => {
      try {
        const [metaEvidenceURI] = utils.defaultAbiCoder.decode(
          ['string'],
          log.data,
        ) as [string]
        const response = await fetch(parseIpfs(metaEvidenceURI))
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const json = await response.json()
        const fileURI =
          typeof json.fileURI === 'string' && json.fileURI.startsWith('/ipfs/')
            ? json.fileURI
            : undefined
        return {
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          fileURI,
        }
      } catch {
        return {
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          fileURI: undefined,
        }
      }
    }),
  )

  const entries: PolicyHistoryEntry[] = []
  for (let i = 0; i < ipfsResults.length; i++) {
    const result = ipfsResults[i]
    const timestamp = blockTimestamps.get(result.blockNumber)
    if (!timestamp) continue
    if (!result.fileURI) continue

    const startDate = new Date(timestamp * 1000).toISOString()

    let endDate: string | null = null
    for (let j = i + 1; j < ipfsResults.length; j++) {
      const nextTimestamp = blockTimestamps.get(ipfsResults[j].blockNumber)
      if (nextTimestamp && ipfsResults[j].fileURI) {
        endDate = new Date(nextTimestamp * 1000).toISOString()
        break
      }
    }

    entries.push({
      startDate,
      endDate,
      policyURI: result.fileURI,
      txHash: result.txHash,
    })
  }

  return entries
}

/**
 * Fetches the registration-policy history for a TCR / LightTCR / PermanentTCR
 * registry by reading MetaEvidence events from the chain.
 *
 * @param registryAddress - The registry contract address.
 * @param chainId - Chain ID used to pick RPC providers.
 * @param mode
 *   - `'full'` (default): scans the entire history, returns every
 *     registration policy the registry has ever had, linked by date ranges.
 *     Necessary for the "Previous Policies" timeline.
 *   - `'latest'`: scans backward from the chain head and stops at the first
 *     registration event. Returns a single-entry array with the current
 *     active policy.
 */
export const fetchPolicyHistory = async (
  registryAddress: string,
  chainId: number,
  mode: PolicyFetchMode = 'full',
): Promise<PolicyHistoryEntry[]> => {
  const pool = buildProviders(chainId)
  const startFloor = MIN_START_BLOCK[chainId] ?? DEFAULT_START_BLOCK
  const latestBlock = await pool[0].getBlockNumber()

  const logs =
    mode === 'latest'
      ? await fetchLatestRegistrationLog(
          pool,
          registryAddress,
          startFloor,
          latestBlock,
        )
      : await fetchAllRegistrationLogs(
          pool,
          chainId,
          registryAddress,
          startFloor,
          latestBlock,
        )

  return buildEntries(pool[0], logs)
}
