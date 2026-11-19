import { gql } from 'graphql-request'
import { request } from 'utils/indexer-request'
import { readContract } from '@wagmi/core'
import {
  BaseError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  erc20Abi,
  type Abi,
} from 'viem'
import standardAbi from 'assets/abis/LightGeneralizedTCR.json'
import permanentAbi from 'assets/abis/PermanentGTCR.json'
import { NETWORKS, NETWORKS_INFO } from 'config/networks'
import { subgraphUrl, subgraphUrlPermanent } from 'config/tcr-addresses'
import { wagmiConfig } from 'config/wagmi'
import { readStakeArbitrationParams } from 'utils/stake-arbitration-params'
import { parseRichAddress } from 'utils/rich-address'
import {
  buildActivityHref,
  fetchDashboardData,
  fetchTestnetDashboardData,
  normalizeAddress,
  shortAddress,
  withTestnetLists,
  ZERO_ADDRESS,
} from 'pages/dashboard/data'
import {
  DashboardActivity,
  DashboardRegistry,
  RegistryKind,
} from 'pages/dashboard/types'
import {
  readVerifiedSets,
  withVerified,
} from 'components/curate/registry-shared-verified'
import { badgeLevel, type BadgeLevel } from './levels'

const PROFILE_QUERY_TIMEOUT_MS = 10_000
/** Rows per indexer page; both indexers serve up to 1,000. */
const PAGE_ROWS = 1000
/** Pages read at once after the first one came back full. */
const PAGE_BATCH = 4
/** Envio takes any offset; The Graph skips at most 5,000 rows. */
const ENVIO_MAX_PAGES = 20
const PERMANENT_MAX_PAGES = 6
/**
 * Standard requests read per chain at most (Stake Curate: 6,000).
 * The figures count every request read; a chain that reaches the ceiling is
 * reported in cappedChains and its figures are lower bounds.
 */
export const PROFILE_LIMIT = PAGE_ROWS * ENVIO_MAX_PAGES
export const PERMANENT_PROFILE_LIMIT = PAGE_ROWS * PERMANENT_MAX_PAGES
/** Most recent actions and disputes kept for the lists. */
export const ACTIVITY_LIMIT = 120
export const DISPUTE_LIMIT = 80
/**
 * Governor reads in flight at once. Every indexed list is read, in rounds of
 * this size, so "governs no list" is never said of a list nobody read.
 */
const GOVERNANCE_READ_BATCH = 200
export const SUPPORTED_CHAIN_IDS = [
  NETWORKS.ethereum,
  NETWORKS.gnosis,
  NETWORKS.sepolia,
]

const ENVIO_PROFILE_QUERY = gql`
  query EnvioProfile(
    $chainId: Int!
    $address: String!
    $limit: Int!
    $offset: Int!
  ) {
    standardRequests: LRequest(
      limit: $limit
      offset: $offset
      where: {
        chainId: { _eq: $chainId }
        _or: [
          { requester: { _eq: $address } }
          { challenger: { _eq: $address } }
        ]
      }
      order_by: [{ submissionTime: desc }, { id: asc }]
    ) {
      id
      chainId
      registry_id
      requestType
      requester
      challenger
      deposit
      disputeID
      disputed
      resolved
      disputeOutcome
      submissionTime
      challengeTime
      resolutionTime
      registry {
        title
      }
    }
  }
`

const PERMANENT_PROFILE_QUERY = gql`
  query PermanentProfile($address: String!, $first: Int!, $skip: Int!) {
    submissions(
      first: $first
      skip: $skip
      where: { submitter: $address }
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      createdAt
      submitter
      item {
        itemID
        registry {
          id
        }
      }
    }
    challenges(
      first: $first
      skip: $skip
      where: { challenger: $address }
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      createdAt
      challenger
      disputeID
      disputeOutcome
      resolutionTime
      challengerStake
      item {
        itemID
        registry {
          id
        }
      }
    }
  }
`

/*
 * The entries behind the listed actions, read once the actions are known:
 * their identifying fields name each row. Asked for 120 entries at most per
 * chain (one query each), never inside the paged queries above, which would
 * carry every field of up to 20,000 requests.
 */
const ENTRY_NAMES_QUERY = gql`
  query EntryNames($ids: [String!]!, $chainId: Int!) {
    LItem(where: { id: { _in: $ids }, chainId: { _eq: $chainId } }) {
      id
      props {
        label
        value
        isIdentifier
        itemType
      }
    }
  }
`

const STAKE_ENTRY_NAMES_QUERY = gql`
  query StakeEntryNames($ids: [ID!]!) {
    items(first: 1000, where: { id_in: $ids }) {
      id
      metadata {
        props {
          label
          value
          isIdentifier
          type
        }
      }
    }
  }
`

export interface AddressBadge extends BadgeLevel {
  id: 'librarian' | 'sheriff' | 'maintainer'
  label: string
  /** What the badge counts, plural ("submissions"). */
  unit: string
  /** Singular of `unit`. */
  one: string
  /** Level 1 or above. */
  earned: boolean
}

export interface AddressStats {
  submissions: number
  removals: number
  challenges: number
  /** Challenges the court ruled for the challenger (Reject). */
  successfulChallenges: number
  /** Challenges the court ruled for the requester (Accept). */
  challengesLost: number
  /** Challenges resolved without a ruling (the court refused to arbitrate). */
  challengesNoRuling: number
  /** Challenges whose dispute is still open (voting or appeal). */
  challengesInCourt: number
  disputes: number
  itemsChallenged: number
  governedLists: number
  activity: number
}

export interface GovernanceParams {
  governor?: string
  arbitrator?: string
  arbitratorExtraData?: string
  relayerContract?: string
  connectedTCR?: string
  metaEvidenceUpdates?: string
  metaEvidenceURI?: string
  submissionBaseDeposit?: string
  submissionChallengeBaseDeposit?: string
  removalBaseDeposit?: string
  removalChallengeBaseDeposit?: string
  challengePeriodDuration?: string
  submissionMinDeposit?: string
  submissionPeriod?: string
  reinclusionPeriod?: string
  withdrawingPeriod?: string
  challengeStakeMultiplier?: string
  winnerStakeMultiplier?: string
  loserStakeMultiplier?: string
  sharedStakeMultiplier?: string
  tokenSymbol?: string
}

export interface GovernedRegistry extends DashboardRegistry {
  governor?: string
  params?: GovernanceParams
}

/**
 * An action together with the request state the indexers carry for it. The
 * profile derives the status dot from these fields, never from the action
 * kind alone, so the dot only claims what the data knows.
 */
/**
 * What names an entry in a row: a text value ("Binance · Hot Wallet 34"), or
 * an address shown short, with the network a rich address lives on.
 */
export interface EntryName {
  text: string
  /** The name is an address: set in mono, the full value in `fields`. */
  address?: boolean
  /** The whole address `text` shortens, when the name is one. */
  value?: string
  /** The network of a rich address ("Polygon Mainnet"). */
  network?: string
  /**
   * The EVM chain a rich address names (eip155); null for a rich address on
   * any other network. Absent for a plain address, which lives on the
   * entry's own chain.
   */
  chainId?: number | null
  /**
   * The title of the list that address is, when the registry index knows
   * it: an entry of a list of lists (Verified Registries) is itself a list.
   */
  list?: string
}

export interface ProfileActivity extends DashboardActivity {
  /** Standard (including requests) or Stake: which indexer holds the entry. */
  registryKind?: RegistryKind
  /** The entry's name, once its fields are read; absent when they were not. */
  entry?: EntryName
  /** Every identifying field as "Label: value", for the row's tooltip. */
  entryFields?: string[]
  /** The request was challenged and sent to court. */
  disputed?: boolean
  /** The request executed or the court ruled; false while it is pending. */
  resolved?: boolean
  /** Ruling once resolved: Accept favors the requester, Reject the challenger, None is no ruling. */
  disputeOutcome?: string
  /** The registry's logo (IPFS path or URL), when the registry index has one. */
  registryLogo?: string
  /** The list is Kleros Verified (the shared rule, stamped on the index). */
  registryVerified?: boolean
}

export interface AddressProfileData {
  address: string
  generatedAt: number
  stats: AddressStats
  badges: AddressBadge[]
  activities: ProfileActivity[]
  disputes: ProfileActivity[]
  /** Per chain; governedLists stays 0 here (see fetchGovernedRegistries). */
  chainBreakdown: Record<number, AddressStats>
  /**
   * Chains where the read stopped before the end (the page ceiling, or a page
   * that failed after the first): older requests were cut, so the counts
   * there are lower bounds.
   */
  cappedChains: number[]
  /**
   * Chains where an indexer did not answer at all (its first page failed or
   * timed out): their actions are missing, so the counts are lower bounds
   * and an empty profile there is unknown, never "no activity". A chain
   * whose indexer is not configured is not listed: it has no rows to read.
   */
  failedChains: number[]
}

/** The lists the governance scan reads, with the chains it could not cover. */
export interface RegistryIndex {
  registries: DashboardRegistry[]
  /** Chains whose lists did not load: none of their lists was read. */
  missingChains: number[]
}

/** The lists whose governor() is an address, and where the scan fell short. */
export interface GovernanceScan {
  registries: GovernedRegistry[]
  /**
   * Chains where some list's governor() could not be read (or whose lists
   * did not load): the scan is partial there, so its count is a lower bound.
   */
  unreadChains: number[]
}

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export const emptyStats = (): AddressStats => ({
  submissions: 0,
  removals: 0,
  challenges: 0,
  successfulChallenges: 0,
  challengesLost: 0,
  challengesNoRuling: 0,
  challengesInCourt: 0,
  disputes: 0,
  itemsChallenged: 0,
  governedLists: 0,
  activity: 0,
})

const addStats = (target: AddressStats, source: Partial<AddressStats>) => {
  target.submissions += source.submissions ?? 0
  target.removals += source.removals ?? 0
  target.challenges += source.challenges ?? 0
  target.successfulChallenges += source.successfulChallenges ?? 0
  target.challengesLost += source.challengesLost ?? 0
  target.challengesNoRuling += source.challengesNoRuling ?? 0
  target.challengesInCourt += source.challengesInCourt ?? 0
  target.disputes += source.disputes ?? 0
  target.itemsChallenged += source.itemsChallenged ?? 0
  target.governedLists += source.governedLists ?? 0
  target.activity += source.activity ?? 0
}

const registryTitle = (
  address: string,
  title?: string | null,
  kind?: RegistryKind,
) => {
  if (title && title.trim() && title.trim() !== '-') return title.trim()
  if (kind === 'permanent') return `Stake list ${shortAddress(address)}`
  return `List ${shortAddress(address)}`
}

const safeRequest = async <T>(
  url: string | undefined,
  query: string,
  variables: Record<string, unknown>,
): Promise<T | null> => {
  if (!url) return null
  // A slow indexer is cut off, not left running: the request is aborted and
  // its timer cleared (as the dashboard's reads do).
  const controller = new AbortController()
  const timer = window.setTimeout(
    () => controller.abort(),
    PROFILE_QUERY_TIMEOUT_MS,
  )
  try {
    return await request<T>({
      url,
      document: query,
      variables,
      signal: controller.signal,
    })
  } catch (err) {
    console.warn('Address profile query failed', err)
    return null
  } finally {
    window.clearTimeout(timer)
  }
}

/**
 * Where one of the address's challenges stands: in court while its dispute is
 * open, then the ruling (Reject favors the challenger, Accept the requester,
 * None is no ruling). Exactly one field is set, so the parts add up to the
 * challenge count.
 */
const challengeOutcome = (
  resolved: boolean,
  outcome: unknown,
): Partial<AddressStats> => {
  if (!resolved) return { challengesInCourt: 1 }
  if (outcome === 'Reject') return { successfulChallenges: 1 }
  if (outcome === 'Accept') return { challengesLost: 1 }
  return { challengesNoRuling: 1 }
}

const requestToActivity = (
  requestEntity: any,
  kind: RegistryKind,
  address: string,
): { activity: ProfileActivity; stats: Partial<AddressStats> } | null => {
  const chainId = toNumber(requestEntity.chainId)
  const registryAddress = normalizeAddress(requestEntity.registry_id)
  const itemID = requestEntity.id?.split('@')?.[0]
  const requester = normalizeAddress(requestEntity.requester)
  const challenger = normalizeAddress(requestEntity.challenger)
  const isRequester = requester === address
  const isChallenger = challenger === address && challenger !== ZERO_ADDRESS
  // The query matches the challenger field too, and unchallenged requests
  // carry the zero address there: those are not this address's actions.
  if (!isRequester && !isChallenger) return null
  const isRemoval = requestEntity.requestType === 'ClearingRequested'
  const timestamp =
    (isChallenger && toNumber(requestEntity.challengeTime)) ||
    toNumber(requestEntity.submissionTime) ||
    toNumber(requestEntity.resolutionTime)
  const disputed = Boolean(requestEntity.disputed)

  const stats: Partial<AddressStats> = { activity: 1 }
  if (isRequester && isRemoval) stats.removals = 1
  if (isRequester && !isRemoval) stats.submissions = 1
  if (isChallenger) {
    stats.challenges = 1
    stats.itemsChallenged = 1
    Object.assign(
      stats,
      challengeOutcome(
        Boolean(requestEntity.resolved),
        requestEntity.disputeOutcome,
      ),
    )
  }
  if (disputed) stats.disputes = 1

  return {
    activity: {
      id: `profile-${kind}-${requestEntity.id}`,
      chainId,
      registryAddress,
      registryTitle: registryTitle(
        registryAddress,
        requestEntity.registry?.title,
        kind,
      ),
      registryKind: kind,
      itemID,
      actor: requester,
      secondaryActor: challenger,
      kind: isChallenger ? 'challenge' : isRemoval ? 'removal' : 'submission',
      // The words the entry pages use ("Removal requested", "Case 12").
      status: isChallenger
        ? requestEntity.disputeID
          ? `Challenged · case ${requestEntity.disputeID}`
          : 'Challenged'
        : isRemoval
          ? 'Removal requested'
          : 'Submitted',
      timestamp,
      href: buildActivityHref(chainId, registryAddress, itemID),
      disputed,
      resolved: Boolean(requestEntity.resolved),
      disputeOutcome: requestEntity.disputeOutcome ?? undefined,
    },
    stats,
  }
}

const permanentSubmissionToActivity = (
  submission: any,
  chainId: number,
): ProfileActivity => {
  const registryAddress = normalizeAddress(submission.item?.registry?.id)
  return {
    id: `profile-permanent-submission-${chainId}-${submission.id}`,
    chainId,
    registryAddress,
    registryTitle: registryTitle(registryAddress, null, 'permanent'),
    registryKind: 'permanent',
    itemID: submission.item?.itemID,
    actor: normalizeAddress(submission.submitter),
    kind: 'submission',
    status: 'Submitted Stake entry',
    timestamp: toNumber(submission.createdAt),
    href: buildActivityHref(chainId, registryAddress, submission.item?.itemID),
  }
}

const permanentChallengeToActivity = (
  challenge: any,
  chainId: number,
): ProfileActivity => {
  const registryAddress = normalizeAddress(challenge.item?.registry?.id)
  // The permanent subgraph sets disputeOutcome (and resolutionTime) only
  // once the court has ruled; before that the dispute is open.
  const resolved =
    Boolean(challenge.disputeOutcome) || toNumber(challenge.resolutionTime) > 0
  return {
    id: `profile-permanent-challenge-${chainId}-${challenge.id}`,
    chainId,
    registryAddress,
    registryTitle: registryTitle(registryAddress, null, 'permanent'),
    registryKind: 'permanent',
    itemID: challenge.item?.itemID,
    actor: normalizeAddress(challenge.challenger),
    kind: 'challenge',
    status: challenge.disputeID
      ? `Challenged · case ${challenge.disputeID}`
      : 'Challenged',
    timestamp: toNumber(challenge.createdAt),
    href: buildActivityHref(chainId, registryAddress, challenge.item?.itemID),
    disputed: true,
    resolved,
    disputeOutcome: challenge.disputeOutcome ?? undefined,
  }
}

export const abiForKind = (kind: RegistryKind): Abi => {
  if (kind === 'permanent') return permanentAbi as Abi
  return standardAbi as Abi
}

const callParam = async (
  registry: DashboardRegistry,
  functionName: string,
): Promise<string | undefined> => {
  const value = await readContract(wagmiConfig, {
    chainId: registry.chainId,
    address: registry.address as `0x${string}`,
    abi: abiForKind(registry.kind),
    functionName,
  } as any)
  if (typeof value === 'string') return value
  if (typeof value === 'bigint') return value.toString()
  if (value && typeof value === 'object' && 'toString' in value)
    return String(value)
  return value === undefined || value === null ? undefined : String(value)
}

const readParam = async (
  registry: DashboardRegistry,
  functionName: string,
): Promise<string | undefined> => {
  try {
    return await callParam(registry, functionName)
  } catch (err) {
    console.warn('Governance read failed', registry.address, functionName, err)
    return undefined
  }
}

/**
 * True when the chain answered the call: it reverted, or the address holds
 * no such function. Anything else (a node down, a timeout) is no answer.
 */
const chainAnswered = (err: unknown): boolean =>
  err instanceof BaseError &&
  !!err.walk(
    (cause) =>
      cause instanceof ContractFunctionRevertedError ||
      cause instanceof ContractFunctionZeroDataError,
  )

/**
 * A list's governor, lowercase: '' when the contract answered without one,
 * undefined when the read itself failed (so the list was not read).
 */
const readGovernor = async (
  registry: DashboardRegistry,
): Promise<string | undefined> => {
  try {
    return normalizeAddress(await callParam(registry, 'governor'))
  } catch (err) {
    if (chainAnswered(err)) return ''
    console.warn('Governor read failed', registry.address, err)
    return undefined
  }
}

const readTokenSymbol = async (
  registry: DashboardRegistry,
): Promise<string | undefined> => {
  if (!registry.token) return undefined
  try {
    const symbol = await readContract(wagmiConfig, {
      chainId: registry.chainId,
      address: registry.token as `0x${string}`,
      abi: erc20Abi,
      functionName: 'symbol',
    })
    return typeof symbol === 'string' && symbol ? symbol : undefined
  } catch (err) {
    console.warn('Token symbol read failed', registry.token, err)
    return undefined
  }
}

const readGovernanceParams = async (
  registry: DashboardRegistry,
): Promise<GovernanceParams> => {
  const common = ['governor', 'arbitrator'] as const
  const standard = [
    'arbitratorExtraData',
    'challengePeriodDuration',
    'submissionBaseDeposit',
    'submissionChallengeBaseDeposit',
    'removalBaseDeposit',
    'removalChallengeBaseDeposit',
    'winnerStakeMultiplier',
    'loserStakeMultiplier',
    'sharedStakeMultiplier',
    'relayerContract',
    'metaEvidenceUpdates',
  ] as const
  const permanent = [
    'submissionMinDeposit',
    'submissionPeriod',
    'reinclusionPeriod',
    'withdrawingPeriod',
    'challengeStakeMultiplier',
    'winnerStakeMultiplier',
    'loserStakeMultiplier',
    'sharedStakeMultiplier',
  ] as const

  const names =
    registry.kind === 'permanent'
      ? [...common, ...permanent]
      : [...common, ...standard]
  const entries = await Promise.all(
    names.map(async (name) => [name, await readParam(registry, name)] as const),
  )
  const params = Object.fromEntries(
    entries.filter(([, value]) => value !== undefined),
  ) as GovernanceParams

  if (registry.kind === 'permanent') {
    // The court new challenges use is the latest settings entry on chain (a
    // Stake list has no getter for it). The index's copy can be a day old,
    // so it is only shown when the chain can't be read.
    const live = await readStakeArbitrationParams(
      registry.chainId,
      registry.address,
    ).catch((err: unknown) => {
      console.warn('Governance read failed', registry.address, err)
      return undefined
    })
    const extraData = live?.arbitratorExtraData ?? registry.arbitratorExtraData
    if (extraData) params.arbitratorExtraData = extraData
    if (registry.metaEvidenceURI)
      params.metaEvidenceURI = registry.metaEvidenceURI
    params.tokenSymbol = await readTokenSymbol(registry)
  }

  return params
}

/**
 * The registry index (every indexed list with its title and logo), its
 * Kleros Verified standing stamped by the shared rule
 * (components/curate/verified-rule.ts). The page passes one that reads the shared
 * query caches, so the profile, the governance scan and the dashboard and
 * browse pages share one load.
 */
export type RegistryIndexReader = () => Promise<RegistryIndex>

const readRegistryIndex: RegistryIndexReader = async () => {
  const [mainnets, testnet, sets] = await Promise.all([
    fetchDashboardData(),
    fetchTestnetDashboardData(),
    readVerifiedSets(SUPPORTED_CHAIN_IDS),
  ])
  const dashboard = withTestnetLists(mainnets, testnet)
  return {
    registries: withVerified(dashboard.registries, sets),
    missingChains: dashboard.listFailedChains ?? [],
  }
}

/**
 * The lists whose governor() is this address, with their parameters. Read
 * apart from the profile: one governor() call per indexed list takes a few
 * seconds, and the figures, chart and list should not wait for it. A list
 * whose governor() could not be read is not counted as "not governed": its
 * chain is reported in `unreadChains`, like a chain whose lists did not load.
 */
export const fetchGovernedRegistries = async (
  rawAddress: string,
  readIndex: RegistryIndexReader = readRegistryIndex,
): Promise<GovernanceScan> => {
  const address = normalizeAddress(rawAddress)
  const { registries, missingChains } = await readIndex()
  const governed: GovernedRegistry[] = []
  const unreadChains = new Set(missingChains)
  for (
    let start = 0;
    start < registries.length;
    start += GOVERNANCE_READ_BATCH
  ) {
    const round = await Promise.all(
      registries
        .slice(start, start + GOVERNANCE_READ_BATCH)
        .map(async (registry) => {
          const governor = await readGovernor(registry)
          if (governor === undefined) {
            unreadChains.add(registry.chainId)
            return null
          }
          if (!governor || governor !== address) return null
          const params = await readGovernanceParams(registry)
          return { ...registry, governor, params } satisfies GovernedRegistry
        }),
    )
    for (const registry of round) if (registry) governed.push(registry)
  }
  return { registries: governed, unreadChains: [...unreadChains] }
}

/**
 * One list's governance, read for its own page: its governor and every
 * parameter the update dialog edits, from the chain, exactly as the scan
 * above reads each list it finds. It throws when the governor itself could
 * not be read, so a dialog never opens on a list it knows nothing about.
 */
export const readListGovernance = async (
  registry: DashboardRegistry,
): Promise<GovernedRegistry> => {
  const params = await readGovernanceParams(registry)
  if (params.governor === undefined)
    throw new Error(`The governor of ${registry.address} could not be read`)
  return {
    ...registry,
    governor: normalizeAddress(params.governor),
    params,
  }
}

/**
 * Reads an indexer page by page until a page comes back short. The first page
 * is read alone; after that, pages are read PAGE_BATCH at a time. Rows are
 * kept once per id, so a row that shifts across a page boundary while the
 * pages are read is not counted twice. `cut` is true when the read stopped
 * before the end (the page ceiling, or a page that failed after the first):
 * the rows are then the most recent ones and every count is a lower bound.
 * `failed` is true when the first page itself did not load: no row was read,
 * which says nothing about the address.
 */
const readPages = async (
  fetchPage: (
    page: number,
  ) => Promise<Record<string, any[] | undefined> | null>,
  keys: string[],
  maxPages: number,
): Promise<{ rows: Record<string, any[]>; cut: boolean; failed: boolean }> => {
  const rows: Record<string, any[]> = Object.fromEntries(
    keys.map((key) => [key, []]),
  )
  const seen = new Set<string>()
  const append = (payload: Record<string, any[] | undefined>) => {
    for (const key of keys)
      for (const row of payload[key] ?? []) {
        const id = `${key}:${row?.id}`
        if (row?.id !== undefined && seen.has(id)) continue
        seen.add(id)
        rows[key].push(row)
      }
  }
  const full = (payload: Record<string, any[] | undefined>) =>
    keys.some((key) => (payload[key]?.length ?? 0) >= PAGE_ROWS)

  const first = await fetchPage(0)
  if (!first) return { rows, cut: false, failed: true }
  append(first)
  if (!full(first)) return { rows, cut: false, failed: false }
  let page = 1
  while (page < maxPages) {
    const batch = Array.from(
      { length: Math.min(PAGE_BATCH, maxPages - page) },
      (_, index) => page + index,
    )
    const payloads = await Promise.all(batch.map(fetchPage))
    for (const payload of payloads) {
      if (!payload) return { rows, cut: true, failed: false }
      append(payload)
      if (!full(payload)) return { rows, cut: false, failed: false }
    }
    page += batch.length
  }
  return { rows, cut: true, failed: false }
}

/** An indexer with no URL has nothing to read: no rows, and not a failure. */
const unconfigured = (keys: string[]) => ({
  rows: Object.fromEntries(keys.map((key) => [key, [] as any[]])),
  cut: false,
  failed: false,
})

/* ---------- Entry names ---------- */

interface EntryProp {
  label: string
  value: string
  type: string
  identifier: boolean
}

/** Field types that cannot name an entry in a line of text. */
const PICTURE_TYPES = new Set(['image', 'file'])
const TEXT_TYPES = new Set(['text', 'long text'])

const oneLine = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''

const isIpfs = (value: string) =>
  value.startsWith('/ipfs/') || value.startsWith('ipfs://')

const shortValue = (value: string) =>
  value.length > 11 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value

const byLabel = (a: EntryProp, b: EntryProp) =>
  a.label.localeCompare(b.label, 'en')

/**
 * The entry's name, a name before an address as on the list page (which
 * leads with its first text column): up to two of its text identifiers, in
 * label order ("Nakamoto Games · BalanceVault"), since the indexer returns
 * an entry's fields in no column order, so the pair can lead with another
 * identifier than the list page does; else its first identifier,
 * an address shown short with its network; else the first value that is not
 * a picture. Never an image or a file: on some lists the only picture is a
 * proof screenshot, which names nothing.
 */
const nameEntry = (
  props: EntryProp[],
): { entry?: EntryName; fields?: string[] } => {
  const usable = props.filter(
    (prop) =>
      prop.value && !PICTURE_TYPES.has(prop.type) && !isIpfs(prop.value),
  )
  const identifiers = usable.filter((prop) => prop.identifier)
  const fields =
    identifiers.length > 0
      ? identifiers.map((prop) => `${prop.label}: ${prop.value}`)
      : undefined
  const texts = identifiers
    .filter((prop) => TEXT_TYPES.has(prop.type))
    .sort(byLabel)
  if (texts.length > 0)
    return {
      entry: {
        text: texts
          .slice(0, 2)
          .map((prop) => prop.value)
          .join(' · '),
      },
      fields,
    }
  const [first] = identifiers.length > 0 ? identifiers : usable
  if (!first) return {}
  if (first.type === 'rich address') {
    const rich = parseRichAddress(first.value)
    // A network this app does not know still names the address itself.
    const address = rich?.address ?? first.value.split(':').pop() ?? ''
    if (address)
      return {
        entry: {
          text: shortValue(address),
          address: true,
          value: address,
          network: rich?.reference.name,
          chainId:
            rich?.reference.namespaceId === 'eip155'
              ? Number(rich.reference.id)
              : null,
        },
        fields,
      }
  }
  if (first.type === 'address' || /^0x[0-9a-fA-F]{40}$/.test(first.value))
    return {
      entry: {
        text: shortValue(first.value),
        address: true,
        value: first.value,
      },
      fields,
    }
  return { entry: { text: first.value }, fields }
}

const entryKey = (chainId: number, itemID: string, registry: string) =>
  `${chainId}:${itemID.toLowerCase()}@${registry}`

/**
 * Names the listed actions' entries in place: one query per chain and list
 * kind, at most 120 entries in all. A read that fails leaves those rows
 * nameless (they show the entry ID, as before) and never fails the profile.
 */
const readEntryNames = async (activities: ProfileActivity[]) => {
  const groups = new Map<string, ProfileActivity[]>()
  for (const activity of activities) {
    if (!activity.itemID) continue
    const key = `${activity.registryKind ?? 'standard'}:${activity.chainId}`
    groups.set(key, [...(groups.get(key) ?? []), activity])
  }
  const names = new Map<string, EntryProp[]>()
  await Promise.all(
    [...groups.entries()].map(async ([key, group]) => {
      const [kind, chain] = key.split(':')
      const chainId = Number(chain)
      const ids = [
        ...new Set(
          group.map(
            (activity) =>
              `${activity.itemID!.toLowerCase()}@${activity.registryAddress}`,
          ),
        ),
      ]
      if (kind === 'permanent') {
        const result = await safeRequest<{
          items?: {
            id: string
            metadata?: { props?: any[] | null } | null
          }[]
        }>(subgraphUrlPermanent[chainId], STAKE_ENTRY_NAMES_QUERY, { ids })
        for (const item of result?.items ?? [])
          names.set(
            `${chainId}:${item.id.toLowerCase()}`,
            (item.metadata?.props ?? []).map((prop) => ({
              label: oneLine(prop?.label),
              value: oneLine(prop?.value),
              type: String(prop?.type ?? ''),
              identifier: Boolean(prop?.isIdentifier),
            })),
          )
        return
      }
      const result = await safeRequest<{
        LItem?: { id: string; props?: any[] | null }[]
      }>(subgraphUrl[chainId], ENTRY_NAMES_QUERY, { ids, chainId })
      for (const item of result?.LItem ?? [])
        names.set(
          `${chainId}:${item.id.toLowerCase()}`,
          (item.props ?? []).map((prop) => ({
            label: oneLine(prop?.label),
            value: oneLine(prop?.value),
            type: String(prop?.itemType ?? ''),
            identifier: Boolean(prop?.isIdentifier),
          })),
        )
    }),
  )
  for (const activity of activities) {
    if (!activity.itemID) continue
    const props = names.get(
      entryKey(activity.chainId, activity.itemID, activity.registryAddress),
    )
    if (!props) continue
    const { entry, fields } = nameEntry(props)
    if (entry) activity.entry = entry
    if (fields) activity.entryFields = fields
  }
}

/** The goal badges and their levels (levels.ts) for a scope's figures. */
export const buildBadges = (stats: AddressStats): AddressBadge[] =>
  (
    [
      [
        'librarian',
        'Librarian',
        stats.submissions,
        'submissions',
        'submission',
      ],
      ['sheriff', 'Sheriff', stats.challenges, 'challenges', 'challenge'],
      ['maintainer', 'Maintainer', stats.removals, 'removals', 'removal'],
    ] as const
  ).map(([id, label, count, unit, one]) => {
    const level = badgeLevel(id, count)
    return { id, label, unit, one, earned: level.level > 0, ...level }
  })

export const fetchAddressProfileData = async (
  rawAddress: string,
  readIndex: RegistryIndexReader = readRegistryIndex,
): Promise<AddressProfileData> => {
  const address = normalizeAddress(rawAddress)
  const totals = emptyStats()
  const chainBreakdown: Record<number, AddressStats> = {}
  const activities: ProfileActivity[] = []
  const disputes: ProfileActivity[] = []
  const capped = new Set<number>()
  const failed = new Set<number>()
  // The zero address matches every unchallenged request through the
  // challenger field; none of those rows are its own, so one page is read
  // and no cut applies.
  const isZero = address === ZERO_ADDRESS

  // The registry index (titles, logos) is read in parallel with the profile
  // queries.
  const indexPromise = readIndex()
  // Rejections surface at the await below; this only keeps an early one from
  // being reported as unhandled while the profile queries are still running.
  indexPromise.catch(() => undefined)

  const envioKeys = ['standardRequests']
  const permanentKeys = ['submissions', 'challenges']
  const [envioResults, permanentResults] = await Promise.all([
    Promise.all(
      SUPPORTED_CHAIN_IDS.map(async (chainId) => {
        const url = subgraphUrl[chainId]
        const read = url
          ? await readPages(
              (page) =>
                safeRequest<any>(url, ENVIO_PROFILE_QUERY, {
                  chainId,
                  address,
                  limit: PAGE_ROWS,
                  offset: page * PAGE_ROWS,
                }),
              envioKeys,
              isZero ? 1 : ENVIO_MAX_PAGES,
            )
          : unconfigured(envioKeys)
        return { chainId, ...read }
      }),
    ),
    Promise.all(
      SUPPORTED_CHAIN_IDS.map(async (chainId) => {
        const url = subgraphUrlPermanent[chainId]
        const read = url
          ? await readPages(
              (page) =>
                safeRequest<any>(url, PERMANENT_PROFILE_QUERY, {
                  address,
                  first: PAGE_ROWS,
                  skip: page * PAGE_ROWS,
                }),
              permanentKeys,
              isZero ? 1 : PERMANENT_MAX_PAGES,
            )
          : unconfigured(permanentKeys)
        return { chainId, ...read }
      }),
    ),
  ])

  for (const { chainId, failed: noAnswer } of [
    ...envioResults,
    ...permanentResults,
  ])
    if (noAnswer) failed.add(chainId)

  for (const { chainId, rows, cut } of envioResults) {
    if (!chainBreakdown[chainId]) chainBreakdown[chainId] = emptyStats()
    if (cut && !isZero) capped.add(chainId)
    for (const requestEntity of rows.standardRequests) {
      const parsed = requestToActivity(requestEntity, 'standard', address)
      if (!parsed) continue
      const { activity, stats } = parsed
      activities.push(activity)
      if (requestEntity.disputed) disputes.push(activity)
      addStats(totals, stats)
      addStats(chainBreakdown[chainId], stats)
    }
  }

  for (const { chainId, rows, cut } of permanentResults) {
    if (!chainBreakdown[chainId]) chainBreakdown[chainId] = emptyStats()
    if (cut && !isZero) capped.add(chainId)
    for (const submission of rows.submissions) {
      const activity = permanentSubmissionToActivity(submission, chainId)
      activities.push(activity)
      addStats(totals, { submissions: 1, activity: 1 })
      addStats(chainBreakdown[chainId], { submissions: 1, activity: 1 })
    }
    for (const challenge of rows.challenges) {
      const activity = permanentChallengeToActivity(challenge, chainId)
      activities.push(activity)
      disputes.push(activity)
      const stats: Partial<AddressStats> = {
        challenges: 1,
        disputes: 1,
        itemsChallenged: 1,
        activity: 1,
        ...challengeOutcome(
          Boolean(activity.resolved),
          challenge.disputeOutcome,
        ),
      }
      addStats(totals, stats)
      addStats(chainBreakdown[chainId], stats)
    }
  }

  const { registries } = await indexPromise
  const index = new Map(
    registries.map((registry) => [
      `${registry.chainId}:${normalizeAddress(registry.address)}`,
      registry,
    ]),
  )
  for (const activity of activities) {
    const registry = index.get(
      `${activity.chainId}:${activity.registryAddress}`,
    )
    if (!registry) continue
    if (registry.logoURI) activity.registryLogo = registry.logoURI
    if (registry.trustStatus === 'verified') activity.registryVerified = true
    // Stake Curate requests carry no title; the index has the list's own.
    if (registry.title && /^(Stake list|List) 0x/.test(activity.registryTitle))
      activity.registryTitle = registry.title
  }

  activities.sort((a, b) => b.timestamp - a.timestamp)
  disputes.sort((a, b) => b.timestamp - a.timestamp)
  const listed = activities.slice(0, ACTIVITY_LIMIT)
  // The rows lead with the entry, so its name arrives with them: no row
  // changes its first line after it has painted.
  await readEntryNames(listed)
  // An entry named by an address that is a list the index knows (a list of
  // lists' entry) leads with that list's title, from the same index: no
  // read of its own. A plain address is looked up on the entry's own chain,
  // a rich one on the chain it names, never on another: the same address
  // can be a different contract (or nothing) elsewhere.
  for (const activity of listed) {
    const { entry } = activity
    if (!entry?.address || !entry.value) continue
    const key = normalizeAddress(entry.value)
    const chainId =
      entry.chainId === undefined ? activity.chainId : entry.chainId
    if (chainId === null) continue
    const list = index.get(`${chainId}:${key}`)
    if (list?.title && !/^(Stake list|List) 0x/.test(list.title))
      entry.list = list.title
  }

  return {
    address,
    generatedAt: Date.now(),
    stats: totals,
    badges: buildBadges(totals),
    activities: listed,
    disputes: disputes.slice(0, DISPUTE_LIMIT),
    chainBreakdown,
    cappedChains: [...capped],
    failedChains: [...failed],
  }
}

export const chainName = (chainId: number): string =>
  NETWORKS_INFO[chainId as keyof typeof NETWORKS_INFO]?.name ||
  `Chain ${chainId}`
