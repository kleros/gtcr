import { gql, request } from 'graphql-request'
import { readContract } from '@wagmi/core'
import { erc20Abi, type Abi } from 'viem'
import classicAbi from 'assets/abis/GeneralizedTCR.json'
import lightAbi from 'assets/abis/LightGeneralizedTCR.json'
import permanentAbi from 'assets/abis/PermanentGTCR.json'
import { NETWORKS, NETWORKS_INFO } from 'config/networks'
import { subgraphUrl, subgraphUrlPermanent } from 'config/tcr-addresses'
import { wagmiConfig } from 'config/wagmi'
import {
  buildActivityHref,
  fetchDashboardData,
  normalizeAddress,
  shortAddress,
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

const PROFILE_QUERY_TIMEOUT_MS = 10_000
/** Rows per indexer page; both indexers serve up to 1,000. */
const PAGE_ROWS = 1000
/** Pages read at once after the first one came back full. */
const PAGE_BATCH = 4
/** Envio takes any offset; The Graph skips at most 5,000 rows. */
const ENVIO_MAX_PAGES = 20
const PERMANENT_MAX_PAGES = 6
/**
 * Light and Classic requests read per chain at most (Stake Curate: 6,000).
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
    lightRequests: LRequest(
      limit: $limit
      offset: $offset
      where: {
        chainId: { _eq: $chainId }
        _or: [
          { requester: { _eq: $address } }
          { challenger: { _eq: $address } }
        ]
      }
      order_by: [{ submissionTime: desc }]
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
    classicRequests: Request(
      limit: $limit
      offset: $offset
      where: {
        chainId: { _eq: $chainId }
        _or: [
          { requester: { _eq: $address } }
          { challenger: { _eq: $address } }
        ]
      }
      order_by: [{ submissionTime: desc }]
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
      resolutionTime
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

export interface AddressBadge {
  id: 'librarian' | 'sheriff' | 'maintainer'
  label: string
  description: string
  earned: boolean
  progress: number
  goal: number
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
export interface ProfileActivity extends DashboardActivity {
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
  if (kind === 'permanent') return `Permanent registry ${shortAddress(address)}`
  return `Registry ${shortAddress(address)}`
}

const safeRequest = async <T>(
  url: string | undefined,
  query: string,
  variables: Record<string, unknown>,
): Promise<T | null> => {
  if (!url) return null
  try {
    return await Promise.race([
      request<T>(url, query, variables),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), PROFILE_QUERY_TIMEOUT_MS),
      ),
    ])
  } catch (err) {
    console.warn('Address profile query failed', err)
    return null
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
      itemID,
      actor: requester,
      secondaryActor: challenger,
      kind: isChallenger ? 'challenge' : isRemoval ? 'removal' : 'submission',
      status: isChallenger
        ? `Challenged dispute #${requestEntity.disputeID || 'pending'}`
        : isRemoval
          ? 'Requested removal'
          : 'Submitted entry',
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
    itemID: submission.item?.itemID,
    actor: normalizeAddress(submission.submitter),
    kind: 'submission',
    status: 'Submitted permanent entry',
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
    itemID: challenge.item?.itemID,
    actor: normalizeAddress(challenge.challenger),
    kind: 'challenge',
    status: `Challenged dispute #${challenge.disputeID || 'pending'}`,
    timestamp: toNumber(challenge.createdAt),
    href: buildActivityHref(chainId, registryAddress, challenge.item?.itemID),
    disputed: true,
    resolved,
    disputeOutcome: challenge.disputeOutcome ?? undefined,
  }
}

export const abiForKind = (kind: RegistryKind): Abi => {
  if (kind === 'light') return lightAbi as Abi
  if (kind === 'permanent') return permanentAbi as Abi
  return classicAbi as Abi
}

const readParam = async (
  registry: DashboardRegistry,
  functionName: string,
): Promise<string | undefined> => {
  try {
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
  } catch (err) {
    console.warn('Governance read failed', registry.address, functionName, err)
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
  const common = ['governor', 'arbitrator', 'arbitratorExtraData'] as const
  const classicAndLight = [
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
      : [...common, ...classicAndLight]
  const entries = await Promise.all(
    names.map(async (name) => [name, await readParam(registry, name)] as const),
  )
  const params = Object.fromEntries(
    entries.filter(([, value]) => value !== undefined),
  ) as GovernanceParams

  if (
    registry.kind === 'permanent' &&
    !params.arbitratorExtraData &&
    registry.arbitratorExtraData
  )
    params.arbitratorExtraData = registry.arbitratorExtraData

  if (registry.kind === 'permanent') {
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
export type RegistryIndexReader = () => Promise<DashboardRegistry[]>

const readRegistryIndex: RegistryIndexReader = async () => {
  const [dashboard, sets] = await Promise.all([
    fetchDashboardData(),
    readVerifiedSets(SUPPORTED_CHAIN_IDS),
  ])
  return withVerified(dashboard.registries, sets)
}

/**
 * The lists whose governor() is this address, with their parameters. Read
 * apart from the profile: one governor() call per indexed list takes a few
 * seconds, and the figures, chart and list should not wait for it.
 */
export const fetchGovernedRegistries = async (
  rawAddress: string,
  readIndex: RegistryIndexReader = readRegistryIndex,
): Promise<GovernedRegistry[]> => {
  const address = normalizeAddress(rawAddress)
  const registries = await readIndex()
  const governed: GovernedRegistry[] = []
  for (
    let start = 0;
    start < registries.length;
    start += GOVERNANCE_READ_BATCH
  ) {
    const round = await Promise.all(
      registries
        .slice(start, start + GOVERNANCE_READ_BATCH)
        .map(async (registry) => {
          const governor = normalizeAddress(
            await readParam(registry, 'governor'),
          )
          if (!governor || governor !== address) return null
          const params = await readGovernanceParams(registry)
          return { ...registry, governor, params } satisfies GovernedRegistry
        }),
    )
    for (const registry of round) if (registry) governed.push(registry)
  }
  return governed
}

/**
 * Reads an indexer page by page until a page comes back short. The first page
 * is read alone; after that, pages are read PAGE_BATCH at a time. Rows are
 * kept once per id, so a row that shifts across a page boundary while the
 * pages are read is not counted twice. `cut` is true when the read stopped
 * before the end (the page ceiling, or a page that failed after the first):
 * the rows are then the most recent ones and every count is a lower bound.
 */
const readPages = async (
  fetchPage: (
    page: number,
  ) => Promise<Record<string, any[] | undefined> | null>,
  keys: string[],
  maxPages: number,
): Promise<{ rows: Record<string, any[]>; cut: boolean }> => {
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
  if (!first) return { rows, cut: false }
  append(first)
  if (!full(first)) return { rows, cut: false }
  let page = 1
  while (page < maxPages) {
    const batch = Array.from(
      { length: Math.min(PAGE_BATCH, maxPages - page) },
      (_, index) => page + index,
    )
    const payloads = await Promise.all(batch.map(fetchPage))
    for (const payload of payloads) {
      if (!payload) return { rows, cut: true }
      append(payload)
      if (!full(payload)) return { rows, cut: false }
    }
    page += batch.length
  }
  return { rows, cut: true }
}

export const buildBadges = (stats: AddressStats): AddressBadge[] => [
  {
    id: 'librarian',
    label: 'Librarian',
    description: '100+ submissions',
    earned: stats.submissions >= 100,
    progress: Math.min(stats.submissions, 100),
    goal: 100,
  },
  {
    id: 'sheriff',
    label: 'Sheriff',
    description: '100+ challenges',
    earned: stats.challenges >= 100,
    progress: Math.min(stats.challenges, 100),
    goal: 100,
  },
  {
    id: 'maintainer',
    label: 'Maintainer',
    description: '20+ removals',
    earned: stats.removals >= 20,
    progress: Math.min(stats.removals, 20),
    goal: 20,
  },
]

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

  const [envioResults, permanentResults] = await Promise.all([
    Promise.all(
      SUPPORTED_CHAIN_IDS.map(async (chainId) => {
        const read = await readPages(
          (page) =>
            safeRequest<any>(subgraphUrl[chainId], ENVIO_PROFILE_QUERY, {
              chainId,
              address,
              limit: PAGE_ROWS,
              offset: page * PAGE_ROWS,
            }),
          ['lightRequests', 'classicRequests'],
          isZero ? 1 : ENVIO_MAX_PAGES,
        )
        return { chainId, ...read }
      }),
    ),
    Promise.all(
      SUPPORTED_CHAIN_IDS.map(async (chainId) => {
        const read = await readPages(
          (page) =>
            safeRequest<any>(
              subgraphUrlPermanent[chainId],
              PERMANENT_PROFILE_QUERY,
              { address, first: PAGE_ROWS, skip: page * PAGE_ROWS },
            ),
          ['submissions', 'challenges'],
          isZero ? 1 : PERMANENT_MAX_PAGES,
        )
        return { chainId, ...read }
      }),
    ),
  ])

  for (const { chainId, rows, cut } of envioResults) {
    if (!chainBreakdown[chainId]) chainBreakdown[chainId] = emptyStats()
    if (cut && !isZero) capped.add(chainId)
    for (const [requestEntity, kind] of [
      ...rows.lightRequests.map((item: any) => [item, 'light'] as const),
      ...rows.classicRequests.map((item: any) => [item, 'classic'] as const),
    ]) {
      const parsed = requestToActivity(requestEntity, kind, address)
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

  const registries = await indexPromise
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
    if (
      registry.title &&
      /^(Permanent registry|Registry) 0x/.test(activity.registryTitle)
    )
      activity.registryTitle = registry.title
  }

  activities.sort((a, b) => b.timestamp - a.timestamp)
  disputes.sort((a, b) => b.timestamp - a.timestamp)

  return {
    address,
    generatedAt: Date.now(),
    stats: totals,
    badges: buildBadges(totals),
    activities: activities.slice(0, ACTIVITY_LIMIT),
    disputes: disputes.slice(0, DISPUTE_LIMIT),
    chainBreakdown,
    cappedChains: [...capped],
  }
}

export const chainName = (chainId: number): string =>
  NETWORKS_INFO[chainId as keyof typeof NETWORKS_INFO]?.name ||
  `Chain ${chainId}`
