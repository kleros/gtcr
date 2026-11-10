import { gql, request } from 'graphql-request'
import { NETWORKS } from 'config/networks'
import { subgraphUrl, subgraphUrlPermanent } from 'config/tcr-addresses'
import { getListOfListsAddresses, isListOfLists } from 'config/list-of-lists'
import {
  extractRegistryAddress,
  verifiedSetFrom,
} from 'components/curate/verified-rule'
import { readRegistryMetadata } from 'utils/registry-metadata'
import {
  applyCreationTimes,
  fetchRegistryCreationTimes,
  readCachedCreationTimes,
} from 'utils/registry-creation'
import { getNativeCurrency } from 'config/chains'
import {
  DashboardActivity,
  DashboardData,
  DashboardDay,
  DashboardMetrics,
  DashboardRegistry,
  DashboardUser,
  RegistryKind,
  RulingRow,
  TrustStatus,
  UnchallengedRow,
} from './types'
import { entryCount, openWindows, rowsPlaced, windowsPending } from './view'
import { readChallengePeriods } from './challenge-windows'
import { readTokens } from './tokens'

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const DAY = 24 * 60 * 60
const DASHBOARD_QUERY_TIMEOUT_MS = 10_000
/**
 * How long a load waits for list metadata (titles, logos) from IPFS. Each
 * read keeps its own timeout and is cached for the session, so a read still
 * running when the budget ends fills in on the next refresh.
 */
const METADATA_BUDGET_MS = 6_000
/** How long a load waits for the symbols of Stake bounty tokens. */
const TOKEN_BUDGET_MS = 5_000
/** How long the challenge-period reads may take before they count as unknown. */
const CHALLENGE_WINDOWS_BUDGET_MS = 7_000
const LEADERBOARD_PAGE_SIZE = 1000
const LEADERBOARD_MAX_PAGES = 5
/** Registries read per page; a full page means there may be more. */
const REGISTRY_PAGE_SIZE = 160
const REGISTRY_MAX_PAGES = 10
/** Entries of the lists of lists read per page (a few dozen in all today). */
const VERIFIED_PAGE_SIZE = 500
/** Open requests read per chain to count them; a full read caps the count. */
const OPEN_REQUEST_LIMIT = 1000
/** Unchallenged requests read per chain for the cards (the count is separate). */
const UNCHALLENGED_CARD_LIMIT = 40
/** Cards read per chain for the requests whose window closes soonest. */
const CLOSING_SOON_LIMIT = 24
/** Ruling cards (with the entry's identifiers) read per chain with the load. */
const DECIDED_CARD_LIMIT = 8
/** Resolved disputes read per page for the all-time ledger. */
const RULINGS_PAGE_SIZE = 1000
/** Pages read per chain and kind before the ledger counts as capped. */
const RULINGS_MAX_PAGES = 50
/** Disputes open right now read per chain and kind. */
const OPEN_DISPUTE_LIMIT = 400
/** Latest requests read per chain and kind for the activity feeds. */
const LATEST_LIMIT = 20
const SUPPORTED_CHAIN_IDS = [
  NETWORKS.ethereum,
  NETWORKS.gnosis,
  NETWORKS.sepolia,
]

/**
 * Start of the 30-day window every "30 days" figure shares: the chart's
 * first UTC day, so the series and the curators cover the same 29 full days
 * plus today so far. Rulings and bounties are all time, not windowed.
 */
export const windowStart = (nowSeconds: number): number =>
  Math.floor(nowSeconds / DAY) * DAY - 29 * DAY

const LREGISTRY_FIELDS = `
  id
  chainId
  title
  description
  numberOfAbsent
  numberOfRegistered
  numberOfRegistrationRequested
  numberOfClearingRequested
  numberOfChallengedRegistrations
  numberOfChallengedClearing
  registrationMetaEvidence {
    uri
  }
  requests(limit: 1, order_by: [{ submissionTime: asc }]) {
    submissionTime
  }
`

const REGISTRY_FIELDS = `
  id
  chainId
  numberOfItems
  registrationMetaEvidence {
    uri
  }
  requests(limit: 1, order_by: [{ submissionTime: asc }]) {
    submissionTime
  }
`

const REQUEST_FIELDS = `
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
`

/** Light entries carry their fields; the first identifier names the card. */
const LIGHT_ITEM_PREVIEW = `
  item {
    itemID
    props(order_by: { label: asc }) {
      label
      value
      isIdentifier
    }
  }
`

const CLASSIC_ITEM = `
  item {
    itemID
  }
`

/*
 * When an entry of a list of lists was registered: its latest accepted
 * registration request (a Registered entry has no later one). For the
 * Kleros Verified lists, the earliest of these is when the list earned
 * the badge.
 */
const REGISTERED_SINCE = `
  requests(
    where: {
      requestType: { _eq: "RegistrationRequested" }
      resolved: { _eq: true }
    }
    order_by: [{ resolutionTime: desc }]
    limit: 1
  ) {
    resolutionTime
  }
`

/** The cards of chosen requests, by request id (Light and Classic). */
const ENVIO_REQUEST_CARDS_QUERY = gql`
  query EnvioRequestCards($lightIds: [String!]!, $classicIds: [String!]!) {
    light: LRequest(where: { id: { _in: $lightIds } }) {
      ${REQUEST_FIELDS}
      registry {
        title
      }
      ${LIGHT_ITEM_PREVIEW}
    }
    classic: Request(where: { id: { _in: $classicIds } }) {
      ${REQUEST_FIELDS}
      ${CLASSIC_ITEM}
    }
  }
`

/*
 * The Registered entries of the chain's Kleros lists of lists, Light and
 * Classic (config/list-of-lists.ts): the lists they point to are Kleros
 * Verified (components/curate/verified-rule.ts). The first page comes with
 * the dashboard query; a full page reads on (ENVIO_VERIFIED_PAGE_QUERY).
 */
const VERIFIED_ENTRIES = (offset: 0 | '$offset') => `
    verifiedClassic: Item(
      limit: ${VERIFIED_PAGE_SIZE}
      offset: ${offset}
      order_by: [{ id: asc }]
      where: {
        chainId: { _eq: $chainId }
        registry_id: { _in: $listsOfLists }
        status: { _eq: "Registered" }
      }
    ) {
      id
      data
      registry_id
      ${REGISTERED_SINCE}
    }
    verifiedLight: LItem(
      limit: ${VERIFIED_PAGE_SIZE}
      offset: ${offset}
      order_by: [{ id: asc }]
      where: {
        chainId: { _eq: $chainId }
        registry_id: { _in: $listsOfLists }
        status: { _eq: "Registered" }
      }
    ) {
      id
      data
      registry_id
      ${REGISTERED_SINCE}
      props(order_by: { label: asc }) {
        value
      }
    }
`

const ENVIO_VERIFIED_PAGE_QUERY = gql`
  query EnvioVerifiedPage(
    $chainId: Int!
    $listsOfLists: [String!]!
    $offset: Int!
  ) {
    ${VERIFIED_ENTRIES('$offset')}
  }
`

const ENVIO_DASHBOARD_QUERY = gql`
  query EnvioDashboard(
    $chainId: Int!
    $since: numeric!
    $listsOfLists: [String!]!
  ) {
    lregistries: LRegistry(
      limit: ${REGISTRY_PAGE_SIZE}
      where: { chainId: { _eq: $chainId } }
      order_by: [{ numberOfRegistered: desc }, { id: asc }]
    ) {
      ${LREGISTRY_FIELDS}
    }
    registries: Registry(
      limit: ${REGISTRY_PAGE_SIZE}
      where: { chainId: { _eq: $chainId } }
      order_by: [{ numberOfItems: desc }, { id: asc }]
    ) {
      ${REGISTRY_FIELDS}
    }
    lightRequests: LRequest(
      limit: 360
      where: { chainId: { _eq: $chainId }, submissionTime: { _gte: $since } }
      order_by: [{ submissionTime: desc }]
    ) {
      id
      registry_id
      disputed
      submissionTime
    }
    classicRequests: Request(
      limit: 360
      where: { chainId: { _eq: $chainId }, submissionTime: { _gte: $since } }
      order_by: [{ submissionTime: desc }]
    ) {
      id
      registry_id
      disputed
      submissionTime
    }
    latestLight: LRequest(
      limit: ${LATEST_LIMIT}
      where: { chainId: { _eq: $chainId } }
      order_by: [{ submissionTime: desc }]
    ) {
      ${REQUEST_FIELDS}
      challengeTime
      registry {
        title
      }
      ${LIGHT_ITEM_PREVIEW}
    }
    latestClassic: Request(
      limit: ${LATEST_LIMIT}
      where: { chainId: { _eq: $chainId } }
      order_by: [{ submissionTime: desc }]
    ) {
      ${REQUEST_FIELDS}
      ${CLASSIC_ITEM}
    }
    unchallengedLight: LRequest(
      limit: ${UNCHALLENGED_CARD_LIMIT}
      where: {
        chainId: { _eq: $chainId }
        resolved: { _eq: false }
        disputed: { _eq: false }
      }
      order_by: [{ submissionTime: desc }]
    ) {
      ${REQUEST_FIELDS}
      registry {
        title
      }
      ${LIGHT_ITEM_PREVIEW}
    }
    unchallengedClassic: Request(
      limit: ${UNCHALLENGED_CARD_LIMIT}
      where: {
        chainId: { _eq: $chainId }
        resolved: { _eq: false }
        disputed: { _eq: false }
      }
      order_by: [{ submissionTime: desc }]
    ) {
      ${REQUEST_FIELDS}
      ${CLASSIC_ITEM}
    }
    decidedLight: LRequest(
      limit: ${DECIDED_CARD_LIMIT}
      where: {
        chainId: { _eq: $chainId }
        disputed: { _eq: true }
        resolved: { _eq: true }
      }
      order_by: [{ resolutionTime: desc }, { id: asc }]
    ) {
      ${REQUEST_FIELDS}
      challengeTime
      registry {
        title
      }
      ${LIGHT_ITEM_PREVIEW}
    }
    decidedClassic: Request(
      limit: ${DECIDED_CARD_LIMIT}
      where: {
        chainId: { _eq: $chainId }
        disputed: { _eq: true }
        resolved: { _eq: true }
      }
      order_by: [{ resolutionTime: desc }, { id: asc }]
    ) {
      ${REQUEST_FIELDS}
      ${CLASSIC_ITEM}
    }
    openLightRequests: LRequest(
      limit: ${OPEN_REQUEST_LIMIT}
      where: { chainId: { _eq: $chainId }, resolved: { _eq: false } }
    ) {
      id
      registry_id
      disputed
      submissionTime
      deposit
    }
    openClassicRequests: Request(
      limit: ${OPEN_REQUEST_LIMIT}
      where: { chainId: { _eq: $chainId }, resolved: { _eq: false } }
    ) {
      id
      registry_id
      disputed
      submissionTime
      deposit
    }
    openLightDisputes: LRequest(
      limit: ${OPEN_DISPUTE_LIMIT}
      where: {
        chainId: { _eq: $chainId }
        disputed: { _eq: true }
        resolved: { _eq: false }
      }
      order_by: [{ challengeTime: desc }]
    ) {
      ${REQUEST_FIELDS}
      challengeTime
      registry {
        title
      }
      ${LIGHT_ITEM_PREVIEW}
    }
    openClassicDisputes: Request(
      limit: ${OPEN_DISPUTE_LIMIT}
      where: {
        chainId: { _eq: $chainId }
        disputed: { _eq: true }
        resolved: { _eq: false }
      }
      order_by: [{ submissionTime: desc }]
    ) {
      ${REQUEST_FIELDS}
      ${CLASSIC_ITEM}
    }
    ${VERIFIED_ENTRIES(0)}
  }
`

/** Further pages of registries, read only when the first page was full. */
const ENVIO_LREGISTRY_PAGE_QUERY = gql`
  query EnvioLRegistryPage($chainId: Int!, $offset: Int!) {
    lregistries: LRegistry(
      limit: ${REGISTRY_PAGE_SIZE}
      offset: $offset
      where: { chainId: { _eq: $chainId } }
      order_by: [{ numberOfRegistered: desc }, { id: asc }]
    ) {
      ${LREGISTRY_FIELDS}
    }
  }
`

const ENVIO_REGISTRY_PAGE_QUERY = gql`
  query EnvioRegistryPage($chainId: Int!, $offset: Int!) {
    registries: Registry(
      limit: ${REGISTRY_PAGE_SIZE}
      offset: $offset
      where: { chainId: { _eq: $chainId } }
      order_by: [{ numberOfItems: desc }, { id: asc }]
    ) {
      ${REGISTRY_FIELDS}
    }
  }
`

/*
 * The all-time ledger of rulings: every resolved dispute, a page at a time
 * until a short page. Only the fields the counts and the bounties need; the
 * cards with the entries' identifiers load separately (loadRulingCards).
 */
const ENVIO_RULINGS_PAGE_QUERY = gql`
  query EnvioRulingsPage($chainId: Int!, $offset: Int!) {
    light: LRequest(
      limit: ${RULINGS_PAGE_SIZE}
      offset: $offset
      where: {
        chainId: { _eq: $chainId }
        disputed: { _eq: true }
        resolved: { _eq: true }
      }
      order_by: [{ resolutionTime: desc }, { id: asc }]
    ) {
      id
      registry_id
      requestType
      deposit
      challenger
      disputeOutcome
      resolutionTime
    }
    classic: Request(
      limit: ${RULINGS_PAGE_SIZE}
      offset: $offset
      where: {
        chainId: { _eq: $chainId }
        disputed: { _eq: true }
        resolved: { _eq: true }
      }
      order_by: [{ resolutionTime: desc }, { id: asc }]
    ) {
      id
      registry_id
      requestType
      deposit
      challenger
      disputeOutcome
      resolutionTime
    }
  }
`

/** Stake challenges the court has closed, by id (no page limit on cursors). */
const PERMANENT_RULINGS_PAGE_QUERY = gql`
  query PermanentRulingsPage($after: String!) {
    challenges(
      first: ${RULINGS_PAGE_SIZE}
      where: { resolutionTime_not: null, id_gt: $after }
      orderBy: id
      orderDirection: asc
    ) {
      id
      itemStake
      challenger
      disputeOutcome
      resolutionTime
      item {
        itemID
      }
      registry {
        id
        token
      }
    }
  }
`

/** Stake challenge cards by id, for rulings shown past the loaded ones. */
const PERMANENT_CHALLENGE_CARDS_QUERY = gql`
  query PermanentChallengeCards($ids: [ID!]!) {
    challenges(first: 1000, where: { id_in: $ids }) {
      id
      createdAt
      resolutionTime
      challenger
      disputeID
      disputeOutcome
      item {
        itemID
        metadata {
          props {
            label
            value
            isIdentifier
          }
        }
        registry {
          id
        }
      }
    }
  }
`

const PERMANENT_DASHBOARD_QUERY = gql`
  query PermanentDashboard {
    registries(first: 1000, orderBy: createdAt, orderDirection: desc) {
      id
      token
      createdAt
      numberOfSubmitted
      numberOfAbsent
      numberOfDisputed
      submissionMinDeposit
      submissionPeriod
      arbitrationSettings(first: 1, orderBy: timestamp, orderDirection: desc) {
        arbitratorExtraData
        metaEvidenceURI
        metadata {
          title
          description
          logoURI
        }
      }
    }
    submissions(first: 90, orderBy: createdAt, orderDirection: desc) {
      id
      createdAt
      submitter
      item {
        itemID
        metadata {
          props {
            label
            value
            isIdentifier
          }
        }
        registry {
          id
        }
      }
    }
    challenges(first: 90, orderBy: createdAt, orderDirection: desc) {
      id
      createdAt
      resolutionTime
      challenger
      disputeID
      disputeOutcome
      item {
        itemID
        metadata {
          props {
            label
            value
            isIdentifier
          }
        }
        registry {
          id
        }
      }
    }
    decidedChallenges: challenges(
      first: ${DECIDED_CARD_LIMIT}
      where: { resolutionTime_not: null }
      orderBy: resolutionTime
      orderDirection: desc
    ) {
      id
      createdAt
      resolutionTime
      challenger
      disputeID
      disputeOutcome
      item {
        itemID
        metadata {
          props {
            label
            value
            isIdentifier
          }
        }
        registry {
          id
        }
      }
    }
    openChallenges: challenges(
      first: ${OPEN_DISPUTE_LIMIT}
      where: { resolutionTime: null }
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      createdAt
      challenger
      disputeID
      disputeOutcome
      item {
        itemID
        metadata {
          props {
            label
            value
            isIdentifier
          }
        }
        registry {
          id
        }
      }
    }
  }
`

/*
 * A page of the 30-day activity: the requests made in the window (by
 * submission time) and the challenges made in it (by challenge time,
 * whenever the request was made). A Light request carries its
 * challengeTime. A Classic one does not: its second round is created by the
 * challenge (round 0 at submission, later rounds on appeal), so that
 * round's creationTime is the challenge's. The landing page counts the
 * same rows (src/landing/boot.ts reads this load).
 */
const ENVIO_CURATOR_PAGE_QUERY = gql`
  query EnvioCuratorPage(
    $chainId: Int!
    $since: numeric!
    $limit: Int!
    $offset: Int!
  ) {
    lightRequests: LRequest(
      limit: $limit
      offset: $offset
      where: { chainId: { _eq: $chainId }, submissionTime: { _gte: $since } }
      order_by: [{ submissionTime: desc }, { id: asc }]
    ) {
      id
      requestType
      requester
      submissionTime
    }
    classicRequests: Request(
      limit: $limit
      offset: $offset
      where: { chainId: { _eq: $chainId }, submissionTime: { _gte: $since } }
      order_by: [{ submissionTime: desc }, { id: asc }]
    ) {
      id
      requestType
      requester
      submissionTime
    }
    lightChallenges: LRequest(
      limit: $limit
      offset: $offset
      where: {
        chainId: { _eq: $chainId }
        disputed: { _eq: true }
        challengeTime: { _gte: $since }
      }
      order_by: [{ challengeTime: desc }, { id: asc }]
    ) {
      id
      challenger
      resolved
      disputeOutcome
      challengeTime
    }
    classicChallenges: Request(
      limit: $limit
      offset: $offset
      where: {
        chainId: { _eq: $chainId }
        disputed: { _eq: true }
        rounds: { creationTime: { _gte: $since } }
      }
      order_by: [{ id: asc }]
    ) {
      id
      challenger
      resolved
      disputeOutcome
      rounds(order_by: [{ creationTime: asc }], limit: 2) {
        creationTime
      }
    }
  }
`

/**
 * When a Light or Classic request was challenged (see
 * ENVIO_CURATOR_PAGE_QUERY), or 0 when it was not.
 */
const challengeTimeOf = (row: {
  challengeTime?: string | number | null
  rounds?: { creationTime?: string | number | null }[] | null
}): number =>
  row.challengeTime !== undefined
    ? toNumber(row.challengeTime)
    : toNumber(row.rounds?.[1]?.creationTime)

const PERMANENT_CURATOR_PAGE_QUERY = gql`
  query PermanentCuratorPage($first: Int!, $skip: Int!) {
    submissions(
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      createdAt
      submitter
    }
    challenges(
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      createdAt
      challenger
      disputeOutcome
      resolutionTime
    }
  }
`

/** A classic/light request row as the dashboard queries select it. */
interface DashboardRequestRow {
  id?: string
  registry_id?: string
  submissionTime?: string | number
  requestType?: string
  requester?: string
  challenger?: string
  challengeTime?: string | number
  disputed?: boolean
  item?: { itemID?: string; props?: unknown[] }
  [key: string]: unknown
}

/** A permanent registry row, which the dashboard reads deposits off. */
interface PermanentRegistryRow extends SubgraphRegistry {
  submissionMinDeposit?: string
  createdAt?: string | number
}

/** A permanent submission row. */
interface PermanentSubmissionRow {
  createdAt?: string | number
  submitter?: string
  item?: { registry?: { id?: string } }
  [key: string]: unknown
}

/** A permanent challenge row. */
interface PermanentChallengeRow {
  createdAt?: string | number
  resolutionTime?: string | number | null
  challenger?: string
  disputeOutcome?: string
  item?: { registry?: { id?: string } }
  [key: string]: unknown
}

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export const normalizeAddress = (address: string | undefined | null): string =>
  (address || '').toLowerCase()

export const shortAddress = (address: string): string =>
  address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Unknown'

export const formatCompact = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value)

export const formatAgo = (timestamp?: number): string => {
  if (!timestamp) return 'No recent activity'
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - timestamp)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export const formatWei = (value?: string | null, chainId?: number): string => {
  if (!value || value === '0') return '0'
  const symbol = chainId ? getNativeCurrency(chainId).symbol : 'ETH'
  const wei = BigInt(value)
  const whole = wei / 10n ** 18n
  const fractional = (wei % 10n ** 18n) / 10n ** 15n
  const numeric = Number(whole) + Number(fractional) / 1000
  const formatted =
    numeric >= 1000
      ? formatCompact(numeric)
      : new Intl.NumberFormat('en-US', {
          maximumFractionDigits: numeric >= 10 ? 1 : 3,
        }).format(numeric)
  return `${formatted} ${symbol}`
}

const registryTitle = (
  address: string,
  title?: string | null,
  kind?: RegistryKind,
): string => {
  if (title && title.trim() && title.trim() !== '-') return title.trim()
  if (kind === 'permanent') return `Permanent registry ${shortAddress(address)}`
  return `Registry ${shortAddress(address)}`
}

const isFallbackRegistryTitle = (registry: DashboardRegistry): boolean =>
  registry.title === registryTitle(registry.address, null, registry.kind)

/** "-" is what some forms saved for an empty description or title. */
const isBlank = (value?: string | null): boolean =>
  !value || !value.trim() || value.trim() === '-'

/** Resolves to null once `deadline` (ms since epoch) has passed. */
const byDeadline = <T>(
  promise: Promise<T>,
  deadline: number,
): Promise<T | null> => {
  let timer: number | undefined
  return Promise.race<T | null>([
    promise,
    new Promise<null>((resolve) => {
      timer = window.setTimeout(
        () => resolve(null),
        Math.max(0, deadline - Date.now()),
      )
    }),
  ]).finally(() => window.clearTimeout(timer))
}

/**
 * Title, description and logo from a list's MetaEvidence (any URI shape:
 * "/ipfs/…", "ipfs/…" with no slash, "ipfs://…"), read once per session by
 * utils/registry-metadata. Null when there is none or the gateway failed.
 */
const readMetaEvidence = (uri?: string) =>
  readRegistryMetadata(uri).catch(() => null)

/**
 * Fills in what the indexer lacks (a title known only by address, a blank
 * or "-" description, the logo) from every list's MetaEvidence. Verified
 * lists are asked first, then the most active. The load waits at most
 * METADATA_BUDGET_MS: reads still running then finish in the background and
 * land in the session cache, so the next refresh has them.
 */
const enrichRegistryMetadata = async (
  registries: DashboardRegistry[],
): Promise<DashboardRegistry[]> => {
  const deadline = Date.now() + METADATA_BUDGET_MS
  const candidates = registries
    .filter(
      (registry) =>
        registry.metadataURI &&
        (isFallbackRegistryTitle(registry) ||
          isBlank(registry.description) ||
          !registry.logoURI),
    )
    .sort(
      (a, b) =>
        Number(b.trustStatus === 'verified') -
          Number(a.trustStatus === 'verified') ||
        (b.lastActivityAt || 0) - (a.lastActivityAt || 0) ||
        b.itemCount - a.itemCount,
    )
  const reads = new Map(
    candidates.map((registry) => [
      registry.id,
      byDeadline(readMetaEvidence(registry.metadataURI), deadline),
    ]),
  )

  return Promise.all(
    registries.map(async (registry) => {
      const read = reads.get(registry.id)
      const metadata = read ? await read : null
      const description = isBlank(registry.description)
        ? undefined
        : registry.description
      if (!metadata) return { ...registry, description }
      return {
        ...registry,
        title:
          isFallbackRegistryTitle(registry) && metadata.title
            ? metadata.title
            : registry.title,
        description: description ?? metadata.description,
        logoURI: registry.logoURI || metadata.logoURI,
      }
    }),
  )
}
export const buildActivityHref = (
  chainId: number,
  registryAddress: string,
  itemID?: string,
) =>
  itemID
    ? `/tcr/${chainId}/${registryAddress}/${itemID}`
    : `/tcr/${chainId}/${registryAddress}`

const cleanPreviewValue = (value: unknown): string => {
  const text = String(value ?? '').trim()
  if (!text) return ''
  if (text.startsWith('/ipfs/') || text.startsWith('ipfs://'))
    return 'IPFS file'
  if (text.length > 92) return `${text.slice(0, 89)}...`
  return text
}

const previewProps = (props?: any[]): { label: string; value: string }[] =>
  (props ?? [])
    .filter((prop) => prop?.isIdentifier || prop?.label || prop?.value)
    .map((prop) => ({
      label: String(prop?.label || 'Field'),
      value: cleanPreviewValue(prop?.value),
    }))
    .filter((prop) => prop.value)
    .slice(0, 2)

/**
 * Court outcome of a resolved dispute. Ruling Accept favors the requester,
 * Reject the challenger, None means the court refused to rule (the request
 * fails: a submission stays off the list, a removal keeps the item).
 */
const disputeOutcomeOf = (
  requestEntity: any,
): DashboardActivity['outcome'] | undefined => {
  if (!requestEntity?.disputed || !requestEntity?.resolved) return undefined
  const isRemoval = requestEntity.requestType === 'ClearingRequested'
  const ruling = String(requestEntity.disputeOutcome ?? 'None')
  if (ruling === 'Accept') return isRemoval ? 'removed' : 'registered'
  if (ruling === 'Reject') return isRemoval ? 'kept' : 'rejected'
  return 'no-ruling'
}

const outcomeLabel = (outcome: NonNullable<DashboardActivity['outcome']>) =>
  outcome === 'registered'
    ? 'Registered by ruling'
    : outcome === 'rejected'
      ? 'Rejected by ruling'
      : outcome === 'removed'
        ? 'Removed by ruling'
        : outcome === 'kept'
          ? 'Kept by ruling'
          : 'Court refused to rule'

const requestToActivity = (
  requestEntity: any,
  kindHint: RegistryKind,
): DashboardActivity => {
  const chainId = toNumber(requestEntity.chainId)
  const registryAddress = normalizeAddress(requestEntity.registry_id)
  const itemID: string | undefined =
    requestEntity.item?.itemID ?? requestEntity.id?.split('@')?.[0]
  const isRemoval = requestEntity.requestType === 'ClearingRequested'
  const isChallenge =
    requestEntity.disputed &&
    normalizeAddress(requestEntity.challenger) !== ZERO_ADDRESS
  const outcome = isChallenge ? disputeOutcomeOf(requestEntity) : undefined
  const timestamp = outcome
    ? toNumber(requestEntity.resolutionTime) ||
      toNumber(requestEntity.challengeTime)
    : toNumber(requestEntity.challengeTime) ||
      toNumber(requestEntity.submissionTime) ||
      toNumber(requestEntity.resolutionTime)

  return {
    id: `${kindHint}-${requestEntity.id}`,
    chainId,
    registryAddress,
    registryTitle: registryTitle(
      registryAddress,
      requestEntity.registry?.title,
      kindHint,
    ),
    itemID,
    previewProps: previewProps(requestEntity.item?.props),
    actor: normalizeAddress(requestEntity.requester),
    secondaryActor: normalizeAddress(requestEntity.challenger),
    kind: outcome
      ? 'resolution'
      : isChallenge
        ? 'challenge'
        : isRemoval
          ? 'removal'
          : 'submission',
    requestType: isRemoval ? 'removal' : 'submission',
    outcome,
    disputeID: requestEntity.disputeID
      ? String(requestEntity.disputeID)
      : undefined,
    deposit:
      requestEntity.deposit !== undefined && requestEntity.deposit !== null
        ? String(requestEntity.deposit)
        : undefined,
    status: outcome
      ? outcomeLabel(outcome)
      : isChallenge
        ? `Dispute #${requestEntity.disputeID || 'pending'}`
        : isRemoval
          ? 'Removal requested'
          : 'Registration requested',
    timestamp,
    href: buildActivityHref(chainId, registryAddress, itemID),
  }
}

const permanentSubmissionToActivity = (
  submission: any,
  chainId: number,
  registryMap: Map<string, DashboardRegistry>,
): DashboardActivity => {
  const registryAddress = normalizeAddress(submission.item?.registry?.id)
  const registry = registryMap.get(registryAddress)
  return {
    id: `permanent-submission-${chainId}-${submission.id}`,
    chainId,
    registryAddress,
    registryTitle:
      registry?.title || registryTitle(registryAddress, null, 'permanent'),
    itemID: submission.item?.itemID,
    previewProps: previewProps(submission.item?.metadata?.props),
    actor: normalizeAddress(submission.submitter),
    kind: 'submission',
    status: 'Stake submission',
    timestamp: toNumber(submission.createdAt),
    href: buildActivityHref(chainId, registryAddress, submission.item?.itemID),
  }
}

/**
 * A Stake Curate challenge. Once resolved it is a ruling on a listed entry:
 * Accept keeps it, Reject removes it, None (no ruling) withdraws it.
 */
const permanentChallengeToActivity = (
  challenge: any,
  chainId: number,
  registryMap: Map<string, DashboardRegistry>,
): DashboardActivity => {
  const registryAddress = normalizeAddress(challenge.item?.registry?.id)
  const registry = registryMap.get(registryAddress)
  const resolvedAt = toNumber(challenge.resolutionTime)
  const outcome: DashboardActivity['outcome'] = !resolvedAt
    ? undefined
    : challenge.disputeOutcome === 'Accept'
      ? 'kept'
      : challenge.disputeOutcome === 'Reject'
        ? 'removed'
        : 'no-ruling'
  return {
    id: `permanent-challenge-${chainId}-${challenge.id}`,
    chainId,
    registryAddress,
    registryTitle:
      registry?.title || registryTitle(registryAddress, null, 'permanent'),
    itemID: challenge.item?.itemID,
    previewProps: previewProps(challenge.item?.metadata?.props),
    actor: normalizeAddress(challenge.challenger),
    kind: outcome ? 'resolution' : 'challenge',
    outcome,
    disputeID: challenge.disputeID ? String(challenge.disputeID) : undefined,
    status: outcome
      ? outcomeLabel(outcome)
      : `Dispute #${challenge.disputeID || 'pending'}`,
    timestamp: resolvedAt || toNumber(challenge.createdAt),
    href: buildActivityHref(chainId, registryAddress, challenge.item?.itemID),
  }
}

type UserField =
  | 'submissions'
  | 'removals'
  | 'challenges'
  | 'decidedChallenges'
  | 'successfulChallenges'

const emptyChainStats = (): DashboardUser['chains'][number] => ({
  activity: 0,
  submissions: 0,
  removals: 0,
  challenges: 0,
  decidedChallenges: 0,
  successfulChallenges: 0,
  lastActiveAt: 0,
})

/**
 * Counts one action for a curator. `activity` is requests plus challenges:
 * a challenge counts once, whether it is later decided or won.
 */
const accumulateUser = (
  users: Map<string, DashboardUser>,
  chainId: number,
  address: string | undefined | null,
  field: UserField,
  timestamp: number,
) => {
  const normalized = normalizeAddress(address)
  if (!normalized || normalized === ZERO_ADDRESS) return

  const existing =
    users.get(normalized) ??
    ({
      address: normalized,
      chainId,
      chains: {},
      submissions: 0,
      removals: 0,
      challenges: 0,
      decidedChallenges: 0,
      successfulChallenges: 0,
      activity: 0,
      lastActiveAt: 0,
    } satisfies DashboardUser)

  const counts =
    field === 'submissions' || field === 'removals' || field === 'challenges'
  existing[field] += 1
  if (counts) existing.activity += 1
  existing.lastActiveAt = Math.max(existing.lastActiveAt, timestamp)

  const chainStats = existing.chains[chainId] ?? emptyChainStats()
  chainStats[field] += 1
  if (counts) chainStats.activity += 1
  chainStats.lastActiveAt = Math.max(chainStats.lastActiveAt, timestamp)
  existing.chains[chainId] = chainStats

  if (
    chainStats.activity > (existing.chains[existing.chainId]?.activity ?? 0) ||
    timestamp > existing.lastActiveAt
  )
    existing.chainId = chainId

  users.set(normalized, existing)
}

interface NormalizedChain {
  registries: DashboardRegistry[]
  /** Latest requests (and Stake submissions), whatever their state. */
  activities: DashboardActivity[]
  unchallenged: DashboardActivity[]
  /** Unresolved requests with no challenge on this chain. */
  unchallengedCount: number
  unchallengedCapped: boolean
  /** The same requests' ids, lists, submission times and deposits. */
  unchallengedRows: UnchallengedRow[]
  decided: DashboardActivity[]
  openDisputes: DashboardActivity[]
  openDisputesCapped: boolean
  verifiedRegistryAddresses: string[]
  /**
   * Envio only: by lowercase list address, when each Kleros Verified list
   * earned the badge (its earliest registration on a list of lists).
   */
  verifiedSince?: Record<string, number>
}

const normalizeEnvio = (payload: any, chainId: number): NormalizedChain => {
  // The shared Kleros Verified rule (components/curate/verified-rule.ts):
  // the chain's Kleros lists of lists, Light and Classic, and the lists
  // registered on any of them. A list holds the badge since its earliest
  // registration on one; the lists of lists grant it, so have no date.
  const verifiedEntries = [
    ...(payload.verifiedClassic ?? []),
    ...(payload.verifiedLight ?? []),
  ]
  const verifiedAddresses = verifiedSetFrom(chainId, verifiedEntries)

  const verifiedSince: Record<string, number> = {}
  for (const item of verifiedEntries) {
    const address = extractRegistryAddress(item.data, item.props)
    if (!address || isListOfLists(chainId, address)) continue
    const registeredAt = toNumber(item.requests?.[0]?.resolutionTime)
    if (registeredAt > 0)
      verifiedSince[address] = Math.min(
        verifiedSince[address] ?? registeredAt,
        registeredAt,
      )
  }

  const registries: DashboardRegistry[] = []
  for (const registry of payload.lregistries ?? []) {
    const address = normalizeAddress(registry.id)
    const pending =
      toNumber(registry.numberOfRegistrationRequested) +
      toNumber(registry.numberOfClearingRequested) +
      toNumber(registry.numberOfChallengedRegistrations) +
      toNumber(registry.numberOfChallengedClearing)

    registries.push({
      id: `light-${chainId}-${address}`,
      address,
      chainId,
      kind: 'light',
      title: registryTitle(address, registry.title, 'light'),
      description: registry.description,
      metadataURI: registry.registrationMetaEvidence?.uri,
      // Entries settled on or off the list; the ones with an open request
      // are pendingCount, and entryCount (view.ts) adds the two.
      itemCount:
        toNumber(registry.numberOfRegistered) +
        toNumber(registry.numberOfAbsent),
      activeCount: pending,
      pendingCount: pending,
      disputeCount:
        toNumber(registry.numberOfChallengedRegistrations) +
        toNumber(registry.numberOfChallengedClearing),
      // Envio does not expose registry deployment time. The first request is
      // the closest indexed creation signal available for legacy registries.
      createdAt: toNumber(registry.requests?.[0]?.submissionTime),
      lastActivityAt: 0,
      trustStatus: verifiedAddresses.has(address) ? 'verified' : 'unverified',
    })
  }

  for (const registry of payload.registries ?? []) {
    const address = normalizeAddress(registry.id)
    registries.push({
      id: `classic-${chainId}-${address}`,
      address,
      chainId,
      kind: 'classic',
      title: registryTitle(address, null, 'classic'),
      metadataURI: registry.registrationMetaEvidence?.uri,
      itemCount: toNumber(registry.numberOfItems),
      activeCount: 0,
      pendingCount: 0,
      disputeCount: 0,
      // Envio does not expose registry deployment time. The first request is
      // the closest indexed creation signal available for legacy registries.
      createdAt: toNumber(registry.requests?.[0]?.submissionTime),
      lastActivityAt: 0,
      trustStatus: verifiedAddresses.has(address) ? 'verified' : 'unverified',
    })
  }

  const registryByAddress = new Map(registries.map((r) => [r.address, r]))
  for (const requestEntity of [
    ...(payload.lightRequests ?? []),
    ...(payload.classicRequests ?? []),
  ] as DashboardRequestRow[]) {
    const registry = registryByAddress.get(
      normalizeAddress(requestEntity.registry_id),
    )
    if (!registry) continue
    registry.activeCount += 1
    registry.lastActivityAt = Math.max(
      registry.lastActivityAt || 0,
      toNumber(requestEntity.submissionTime),
    )
    if (requestEntity.disputed) registry.disputeCount += 1
  }

  const toActivities = (light: string, classic: string) => [
    ...(payload[light] ?? []).map((row: DashboardRequestRow) =>
      requestToActivity(row, 'light'),
    ),
    ...(payload[classic] ?? []).map((row: DashboardRequestRow) =>
      requestToActivity(row, 'classic'),
    ),
  ]

  const openRequestRows = [
    ...(payload.openLightRequests ?? []).map((row: DashboardRequestRow) => ({
      ...row,
      kind: 'light',
    })),
    ...(payload.openClassicRequests ?? []).map((row: DashboardRequestRow) => ({
      ...row,
      kind: 'classic',
    })),
  ] as (DashboardRequestRow & { kind: 'light' | 'classic' })[]
  const openRequestsByRegistry = new Map<string, number>()
  for (const row of openRequestRows) {
    const address = normalizeAddress(row.registry_id)
    openRequestsByRegistry.set(
      address,
      (openRequestsByRegistry.get(address) ?? 0) + 1,
    )
  }
  const openRequestsCapped =
    (payload.openLightRequests ?? []).length >= OPEN_REQUEST_LIMIT ||
    (payload.openClassicRequests ?? []).length >= OPEN_REQUEST_LIMIT

  // Requests open per list = its unresolved requests right now (the
  // per-list status counters drift on some deployments).
  if (!openRequestsCapped)
    for (const registry of registries) {
      const open = openRequestsByRegistry.get(registry.address) ?? 0
      registry.pendingCount = open
      registry.activeCount = open
    }

  const decided = toActivities('decidedLight', 'decidedClassic')
  return {
    registries,
    activities: toActivities('latestLight', 'latestClassic'),
    unchallenged: toActivities('unchallengedLight', 'unchallengedClassic'),
    unchallengedCount: openRequestRows.filter((row) => !row.disputed).length,
    unchallengedCapped: openRequestsCapped,
    unchallengedRows: openRequestRows
      .filter((row) => !row.disputed && row.id)
      .map((row) => ({
        id: String(row.id),
        registry: normalizeAddress(row.registry_id),
        submittedAt: toNumber(row.submissionTime),
        deposit: String(row.deposit ?? '0'),
        kind: row.kind,
      })),
    decided,
    openDisputes: toActivities('openLightDisputes', 'openClassicDisputes'),
    openDisputesCapped:
      (payload.openLightDisputes ?? []).length >= OPEN_DISPUTE_LIMIT ||
      (payload.openClassicDisputes ?? []).length >= OPEN_DISPUTE_LIMIT,
    verifiedRegistryAddresses: [...verifiedAddresses],
    verifiedSince,
  }
}

const normalizePermanent = (
  payload: any,
  chainId: number,
  since: number,
  verifiedRegistryAddresses: Set<string>,
): NormalizedChain => {
  const registries: DashboardRegistry[] = (payload.registries ?? []).map(
    (registry: PermanentRegistryRow) => {
      const address = normalizeAddress(registry.id)
      const metadata = registry.arbitrationSettings?.[0]?.metadata
      return {
        id: `permanent-${chainId}-${address}`,
        address,
        chainId,
        kind: 'permanent' as RegistryKind,
        title: registryTitle(address, metadata?.title, 'permanent'),
        description: metadata?.description,
        logoURI: metadata?.logoURI,
        // The Stake Curate subgraph's per-status counters drift (some go
        // negative), but each status change moves one entry between them,
        // so their raw sum is the true total, and submitted + disputed the
        // entries still listed (checked against lists counted entry by
        // entry). "In court" comes from the open challenges further down.
        itemCount: Math.max(
          0,
          toNumber(registry.numberOfSubmitted) +
            toNumber(registry.numberOfAbsent) +
            toNumber(registry.numberOfDisputed),
        ),
        activeCount: 0,
        pendingCount: Math.max(
          0,
          toNumber(registry.numberOfSubmitted) +
            toNumber(registry.numberOfDisputed),
        ),
        disputeCount: Math.max(0, toNumber(registry.numberOfDisputed)),
        bountyWei: registry.submissionMinDeposit,
        token: registry.token,
        arbitratorExtraData:
          registry.arbitrationSettings?.[0]?.arbitratorExtraData,
        metaEvidenceURI: registry.arbitrationSettings?.[0]?.metaEvidenceURI,
        createdAt: toNumber(registry.createdAt),
        lastActivityAt: toNumber(registry.createdAt),
        trustStatus: verifiedRegistryAddresses.has(address)
          ? ('verified' as TrustStatus)
          : ('unverified' as TrustStatus),
      }
    },
  )

  const registryMap = new Map(registries.map((r) => [r.address, r]))
  const touch = (registryId: string | undefined, timestamp: number) => {
    const registry = registryMap.get(normalizeAddress(registryId))
    if (!registry) return undefined
    registry.lastActivityAt = Math.max(registry.lastActivityAt || 0, timestamp)
    if (timestamp >= since) registry.activeCount += 1
    return registry
  }

  for (const submission of (payload.submissions ??
    []) as PermanentSubmissionRow[])
    touch(submission.item?.registry?.id, toNumber(submission.createdAt))

  for (const challenge of (payload.challenges ??
    []) as PermanentChallengeRow[]) {
    const registry = touch(
      challenge.item?.registry?.id,
      toNumber(challenge.createdAt),
    )
    if (registry) registry.disputeCount += 1
  }

  const toActivity = (challenge: PermanentChallengeRow) =>
    permanentChallengeToActivity(challenge, chainId, registryMap)

  return {
    registries,
    activities: (payload.submissions ?? [])
      .slice(0, LATEST_LIMIT)
      .map((submission: PermanentSubmissionRow) =>
        permanentSubmissionToActivity(submission, chainId, registryMap),
      ),
    unchallenged: [],
    unchallengedCount: 0,
    unchallengedCapped: false,
    unchallengedRows: [],
    decided: (payload.decidedChallenges ?? []).map(toActivity),
    openDisputes: (payload.openChallenges ?? []).map(toActivity),
    openDisputesCapped:
      (payload.openChallenges ?? []).length >= OPEN_DISPUTE_LIMIT,
    verifiedRegistryAddresses: [...verifiedRegistryAddresses],
  }
}

const mergeUsers = (maps: Map<string, DashboardUser>[]): DashboardUser[] => {
  const merged = new Map<string, DashboardUser>()

  for (const map of maps)
    for (const [address, user] of map) {
      const existing = merged.get(address)
      if (!existing) {
        merged.set(address, {
          ...user,
          chains: Object.fromEntries(
            Object.entries(user.chains).map(([id, stats]) => [
              id,
              { ...stats },
            ]),
          ),
        })
        continue
      }
      existing.submissions += user.submissions
      existing.removals += user.removals
      existing.challenges += user.challenges
      existing.decidedChallenges += user.decidedChallenges
      existing.successfulChallenges += user.successfulChallenges
      existing.activity += user.activity
      existing.lastActiveAt = Math.max(existing.lastActiveAt, user.lastActiveAt)
      for (const [chainIdKey, chainStats] of Object.entries(user.chains)) {
        const chainId = Number(chainIdKey)
        const existingChain = existing.chains[chainId] ?? emptyChainStats()
        existingChain.submissions += chainStats.submissions
        existingChain.removals += chainStats.removals
        existingChain.challenges += chainStats.challenges
        existingChain.decidedChallenges += chainStats.decidedChallenges
        existingChain.successfulChallenges += chainStats.successfulChallenges
        existingChain.activity += chainStats.activity
        existingChain.lastActiveAt = Math.max(
          existingChain.lastActiveAt,
          chainStats.lastActiveAt,
        )
        existing.chains[chainId] = existingChain
      }
      existing.chainId = Number(
        Object.entries(existing.chains).sort(
          ([, a], [, b]) =>
            b.activity - a.activity || b.lastActiveAt - a.lastActiveAt,
        )[0]?.[0] ?? existing.chainId,
      )
    }

  return [...merged.values()].sort(
    (a, b) => b.activity - a.activity || b.lastActiveAt - a.lastActiveAt,
  )
}

const normalizeEnvioLeaderboardPage = (
  payload: any,
  chainId: number,
  since: number,
): Map<string, DashboardUser> => {
  const users = new Map<string, DashboardUser>()

  for (const requestEntity of [
    ...(payload.lightRequests ?? []),
    ...(payload.classicRequests ?? []),
  ]) {
    const timestamp = toNumber(requestEntity.submissionTime)
    const field =
      requestEntity.requestType === 'ClearingRequested'
        ? 'removals'
        : 'submissions'
    accumulateUser(users, chainId, requestEntity.requester, field, timestamp)
  }

  // Challenges on the day each was made (an appeal round in the window does
  // not make an older Classic challenge new).
  for (const challenge of [
    ...(payload.lightChallenges ?? []),
    ...(payload.classicChallenges ?? []),
  ]) {
    const challengedAt = challengeTimeOf(challenge)
    if (challengedAt < since) continue
    accumulateUser(
      users,
      chainId,
      challenge.challenger,
      'challenges',
      challengedAt,
    )
    if (!challenge.resolved) continue
    // Decided: the court ruled (or refused to). Reject is a ruling for the
    // challenger, whichever request (submission or removal) was challenged.
    accumulateUser(
      users,
      chainId,
      challenge.challenger,
      'decidedChallenges',
      challengedAt,
    )
    if (challenge.disputeOutcome === 'Reject')
      accumulateUser(
        users,
        chainId,
        challenge.challenger,
        'successfulChallenges',
        challengedAt,
      )
  }

  return users
}

const normalizePermanentLeaderboardPage = (
  payload: any,
  chainId: number,
  since: number,
): Map<string, DashboardUser> => {
  const users = new Map<string, DashboardUser>()

  for (const submission of payload.submissions ?? []) {
    const timestamp = toNumber(submission.createdAt)
    if (timestamp < since) continue
    accumulateUser(
      users,
      chainId,
      submission.submitter,
      'submissions',
      timestamp,
    )
  }

  for (const challenge of payload.challenges ?? []) {
    const timestamp = toNumber(challenge.createdAt)
    if (timestamp < since) continue
    accumulateUser(
      users,
      chainId,
      challenge.challenger,
      'challenges',
      timestamp,
    )
    if (!toNumber(challenge.resolutionTime)) continue
    accumulateUser(
      users,
      chainId,
      challenge.challenger,
      'decidedChallenges',
      timestamp,
    )
    if (challenge.disputeOutcome === 'Reject')
      accumulateUser(
        users,
        chainId,
        challenge.challenger,
        'successfulChallenges',
        timestamp,
      )
  }

  return users
}

interface ActivityEvent {
  at: number
  chainId: number
  kind: 'submissions' | 'removals' | 'challenges'
}

const envioPageEvents = (
  payload: any,
  chainId: number,
  since: number,
): ActivityEvent[] => {
  const events: ActivityEvent[] = []
  for (const requestEntity of [
    ...(payload.lightRequests ?? []),
    ...(payload.classicRequests ?? []),
  ]) {
    const at = toNumber(requestEntity.submissionTime)
    if (at)
      events.push({
        at,
        chainId,
        kind:
          requestEntity.requestType === 'ClearingRequested'
            ? 'removals'
            : 'submissions',
      })
  }
  for (const challenge of [
    ...(payload.lightChallenges ?? []),
    ...(payload.classicChallenges ?? []),
  ]) {
    const at = challengeTimeOf(challenge)
    if (at >= since) events.push({ at, chainId, kind: 'challenges' })
  }
  return events
}

const permanentPageEvents = (
  payload: any,
  since: number,
  chainId: number,
): ActivityEvent[] => [
  ...(payload.submissions ?? [])
    .map((submission: any) => toNumber(submission.createdAt))
    .filter((at: number) => at >= since)
    .map((at: number) => ({ at, chainId, kind: 'submissions' as const })),
  ...(payload.challenges ?? [])
    .map((challenge: any) => toNumber(challenge.createdAt))
    .filter((at: number) => at >= since)
    .map((at: number) => ({ at, chainId, kind: 'challenges' as const })),
]

/** Buckets events into the window's 30 UTC days, oldest first. */
const buildSeries = (
  events: ActivityEvent[],
  since: number,
): DashboardDay[] => {
  const days: DashboardDay[] = Array.from({ length: 30 }, (_, index) => ({
    day: since + index * DAY,
    submissions: 0,
    removals: 0,
    challenges: 0,
  }))
  for (const event of events) {
    const index = Math.floor((event.at - since) / DAY)
    if (index >= 0 && index < days.length) days[index][event.kind] += 1
  }
  return days
}

const pageRows = (payload: any, keys: string[]) =>
  Math.max(0, ...keys.map((key) => (payload?.[key] ?? []).length))

const fetchCuratorLeaderboard = async (
  since: number,
  chains: number[],
  failed: Set<number>,
): Promise<{
  users: DashboardUser[]
  series: DashboardDay[]
  seriesByChain: Record<number, DashboardDay[]>
  seriesTruncated: boolean
}> => {
  const lastPage = LEADERBOARD_MAX_PAGES - 1
  const noteFailure = (chainId: number) => {
    failed.add(chainId)
    return null
  }
  const pages = await Promise.all(
    chains.flatMap((chainId) =>
      Array.from({ length: LEADERBOARD_MAX_PAGES }).flatMap((_, page) => [
        safeRequest<any>(subgraphUrl[chainId], ENVIO_CURATOR_PAGE_QUERY, {
          chainId,
          since,
          limit: LEADERBOARD_PAGE_SIZE,
          offset: page * LEADERBOARD_PAGE_SIZE,
        }).then((payload) =>
          payload
            ? {
                users: normalizeEnvioLeaderboardPage(payload, chainId, since),
                events: envioPageEvents(payload, chainId, since),
                full:
                  page === lastPage &&
                  pageRows(payload, [
                    'lightRequests',
                    'classicRequests',
                    'lightChallenges',
                    'classicChallenges',
                  ]) >= LEADERBOARD_PAGE_SIZE,
              }
            : noteFailure(chainId),
        ),
        safeRequest<any>(
          subgraphUrlPermanent[chainId],
          PERMANENT_CURATOR_PAGE_QUERY,
          {
            first: LEADERBOARD_PAGE_SIZE,
            skip: page * LEADERBOARD_PAGE_SIZE,
          },
        ).then((payload) =>
          payload
            ? {
                users: normalizePermanentLeaderboardPage(
                  payload,
                  chainId,
                  since,
                ),
                events: permanentPageEvents(payload, since, chainId),
                full: false,
              }
            : noteFailure(chainId),
        ),
      ]),
    ),
  )

  const valid = pages.filter(Boolean) as {
    users: Map<string, DashboardUser>
    events: ActivityEvent[]
    full: boolean
  }[]
  const events = valid.flatMap((page) => page.events)
  return {
    // Every curator, not a top slice: the page's totals (curators,
    // challenges, decided, won) are summed from this list.
    users: mergeUsers(valid.map((page) => page.users)),
    series: buildSeries(events, since),
    seriesByChain: Object.fromEntries(
      chains.map((chainId) => [
        chainId,
        buildSeries(
          events.filter((event) => event.chainId === chainId),
          since,
        ),
      ]),
    ),
    seriesTruncated: valid.some((page) => page.full),
  }
}

const dedupeRegistries = (
  registries: DashboardRegistry[],
): DashboardRegistry[] => {
  const byKey = new Map<string, DashboardRegistry>()
  for (const registry of registries) {
    const key = `${registry.chainId}:${registry.address}`
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, registry)
      continue
    }

    if (existing.kind !== 'permanent' && registry.kind === 'permanent') continue
    byKey.set(key, {
      ...existing,
      ...registry,
      trustStatus:
        existing.trustStatus === 'verified' ||
        registry.trustStatus === 'verified'
          ? 'verified'
          : registry.trustStatus,
      itemCount: Math.max(existing.itemCount, registry.itemCount),
      activeCount: existing.activeCount + registry.activeCount,
      disputeCount: existing.disputeCount + registry.disputeCount,
      lastActivityAt: Math.max(
        existing.lastActivityAt || 0,
        registry.lastActivityAt || 0,
      ),
    })
  }
  return [...byKey.values()]
}

const buildMetrics = (
  registries: DashboardRegistry[],
  users: DashboardUser[],
): DashboardMetrics => ({
  registries: registries.length,
  verifiedRegistries: registries.filter((r) => r.trustStatus === 'verified')
    .length,
  curatedItems: registries.reduce(
    (sum, registry) => sum + entryCount(registry),
    0,
  ),
  activeVerification: registries.reduce(
    (sum, registry) => sum + registry.pendingCount,
    0,
  ),
  disputes: registries.reduce(
    (sum, registry) => sum + registry.disputeCount,
    0,
  ),
  curators: users.length,
})

const safeRequest = async <T>(
  url: string | undefined,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T | null> => {
  if (!url) return null
  try {
    return await Promise.race([
      request<T>(url, query, variables),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), DASHBOARD_QUERY_TIMEOUT_MS)
      }),
    ])
  } catch (err) {
    console.warn('Dashboard query failed', err)
    return null
  }
}

/**
 * The first page of each registry kind, and of the lists of lists' entries,
 * comes with the dashboard query; when one is full, read on until a short
 * page, so no list drops out of the totals or loses its Kleros Verified mark.
 */
const readRemainingRegistries = async (
  payload: any,
  chainId: number,
  onFail: () => void = () => undefined,
) => {
  const listsOfLists = getListOfListsAddresses(chainId)
  const pages: {
    keys: string[]
    query: string
    size: number
    maxPages: number
    variables: Record<string, unknown>
  }[] = [
    {
      keys: ['lregistries'],
      query: ENVIO_LREGISTRY_PAGE_QUERY,
      size: REGISTRY_PAGE_SIZE,
      maxPages: REGISTRY_MAX_PAGES,
      variables: {},
    },
    {
      keys: ['registries'],
      query: ENVIO_REGISTRY_PAGE_QUERY,
      size: REGISTRY_PAGE_SIZE,
      maxPages: REGISTRY_MAX_PAGES,
      variables: {},
    },
    {
      keys: ['verifiedClassic', 'verifiedLight'],
      query: ENVIO_VERIFIED_PAGE_QUERY,
      size: VERIFIED_PAGE_SIZE,
      maxPages: REGISTRY_MAX_PAGES,
      variables: { listsOfLists },
    },
  ]
  await Promise.all(
    pages.map(async ({ keys, query, size, maxPages, variables }) => {
      const rows = keys.map((key): unknown[] => payload[key] ?? [])
      let full = rows.some((list) => list.length >= size)
      for (let page = 1; full && page < maxPages; page += 1) {
        const next = await safeRequest<any>(subgraphUrl[chainId], query, {
          chainId,
          offset: page * size,
          ...variables,
        })
        if (!next) onFail()
        const more = keys.map((key): unknown[] => next?.[key] ?? [])
        more.forEach((list, index) => rows[index].push(...list))
        full = !!next && more.some((list) => list.length >= size)
      }
      keys.forEach((key, index) => {
        payload[key] = rows[index]
      })
    }),
  )
  return payload
}

/* ---------- Rulings: the all-time ledger ---------- */

/** A Light or Classic resolved dispute as the ledger reads it. */
interface LedgerRequestRow {
  id: string
  registry_id?: string
  requestType?: string
  deposit?: string | null
  challenger?: string | null
  disputeOutcome?: string | null
  resolutionTime?: string | number
}

/** A resolved Stake challenge as the ledger reads it. */
interface LedgerChallengeRow {
  id: string
  itemStake?: string | null
  challenger?: string | null
  disputeOutcome?: string | null
  resolutionTime?: string | number | null
  item?: { itemID?: string } | null
  registry?: { id?: string; token?: string } | null
}

const requestRuling = (
  row: LedgerRequestRow,
  chainId: number,
  kind: 'light' | 'classic',
): RulingRow => {
  const challengerWon = row.disputeOutcome === 'Reject'
  return {
    id: `${kind}-${row.id}`,
    chainId,
    kind,
    registry: normalizeAddress(row.registry_id),
    itemID: row.id.split('@')[0] || undefined,
    resolvedAt: toNumber(row.resolutionTime),
    outcome:
      disputeOutcomeOf({ ...row, disputed: true, resolved: true }) ??
      'no-ruling',
    challengerWon,
    challenger: normalizeAddress(row.challenger) || undefined,
    // A winning challenger gets their own payment back plus the
    // requester's base deposit (the arbitration cost paid the court).
    bounty: challengerWon ? String(row.deposit ?? '0') : '0',
  }
}

const challengeRuling = (
  row: LedgerChallengeRow,
  chainId: number,
): RulingRow => {
  const challengerWon = row.disputeOutcome === 'Reject'
  return {
    id: `permanent-challenge-${chainId}-${row.id}`,
    chainId,
    kind: 'permanent',
    registry: normalizeAddress(row.registry?.id),
    itemID: row.item?.itemID,
    resolvedAt: toNumber(row.resolutionTime),
    outcome:
      row.disputeOutcome === 'Accept'
        ? 'kept'
        : challengerWon
          ? 'removed'
          : 'no-ruling',
    challengerWon,
    challenger: normalizeAddress(row.challenger) || undefined,
    // Stake Curate: a successful challenger recovers their deposit and
    // earns the entry's entire stake.
    bounty: challengerWon ? String(row.itemStake ?? '0') : '0',
    token: normalizeAddress(row.registry?.token) || undefined,
  }
}

/**
 * One chain's ledger: every Light, Classic and Stake dispute the court has
 * closed, newest first, read page by page to the end. Null when a page did
 * not load (the figures would be partial).
 */
const readRulings = async (
  chainId: number,
): Promise<{ rows: RulingRow[]; capped: boolean } | null> => {
  const envio = (async () => {
    const rows = new Map<string, RulingRow>()
    for (let page = 0; page < RULINGS_MAX_PAGES; page += 1) {
      const payload = await safeRequest<{
        light?: LedgerRequestRow[]
        classic?: LedgerRequestRow[]
      }>(subgraphUrl[chainId], ENVIO_RULINGS_PAGE_QUERY, {
        chainId,
        offset: page * RULINGS_PAGE_SIZE,
      })
      if (!payload) return null
      const light = payload.light ?? []
      const classic = payload.classic ?? []
      // A ruling landing between two pages shifts the rest by one: the
      // repeat is dropped by id, nothing is skipped.
      for (const row of light)
        rows.set(`light-${row.id}`, requestRuling(row, chainId, 'light'))
      for (const row of classic)
        rows.set(`classic-${row.id}`, requestRuling(row, chainId, 'classic'))
      if (
        light.length < RULINGS_PAGE_SIZE &&
        classic.length < RULINGS_PAGE_SIZE
      )
        return { rows: [...rows.values()], capped: false }
    }
    return { rows: [...rows.values()], capped: true }
  })()
  const stake = (async () => {
    const url = subgraphUrlPermanent[chainId]
    if (!url) return { rows: [], capped: false }
    const rows: RulingRow[] = []
    let after = ''
    for (let page = 0; page < RULINGS_MAX_PAGES; page += 1) {
      const payload = await safeRequest<{ challenges?: LedgerChallengeRow[] }>(
        url,
        PERMANENT_RULINGS_PAGE_QUERY,
        { after },
      )
      if (!payload) return null
      const challenges = payload.challenges ?? []
      rows.push(...challenges.map((row) => challengeRuling(row, chainId)))
      if (challenges.length < RULINGS_PAGE_SIZE) return { rows, capped: false }
      after = challenges[challenges.length - 1].id
    }
    return { rows, capped: true }
  })()
  const [requests, challenges] = await Promise.all([envio, stake])
  if (!requests || !challenges) return null
  return {
    rows: [...requests.rows, ...challenges.rows].sort(
      (a, b) => b.resolvedAt - a.resolvedAt || a.id.localeCompare(b.id),
    ),
    capped: requests.capped || challenges.capped,
  }
}

/**
 * The cards (registry, entry identifiers, outcome) of rulings past the ones
 * the load read, for "show more": one query per chain and indexer. Rows
 * whose card did not load are left out; the caller keeps showing them from
 * the ledger alone.
 */
export const loadRulingCards = async (
  rows: RulingRow[],
): Promise<DashboardActivity[]> => {
  const chains = [...new Set(rows.map((row) => row.chainId))]
  const cards = await Promise.all(
    chains.flatMap((chainId) => {
      const onChain = rows.filter((row) => row.chainId === chainId)
      const requestIds = (kind: 'light' | 'classic') =>
        onChain
          .filter((row) => row.kind === kind)
          .map((row) => row.id.slice(kind.length + 1))
      const lightIds = requestIds('light')
      const classicIds = requestIds('classic')
      const stakePrefix = `permanent-challenge-${chainId}-`
      const stakeIds = onChain
        .filter((row) => row.kind === 'permanent')
        .map((row) => row.id.slice(stakePrefix.length))
      return [
        lightIds.length + classicIds.length > 0
          ? safeRequest<any>(subgraphUrl[chainId], ENVIO_REQUEST_CARDS_QUERY, {
              lightIds,
              classicIds,
            }).then((payload): DashboardActivity[] =>
              payload
                ? [
                    ...(payload.light ?? []).map((row: DashboardRequestRow) =>
                      requestToActivity(row, 'light'),
                    ),
                    ...(payload.classic ?? []).map((row: DashboardRequestRow) =>
                      requestToActivity(row, 'classic'),
                    ),
                  ]
                : [],
            )
          : Promise.resolve([]),
        stakeIds.length > 0
          ? safeRequest<any>(
              subgraphUrlPermanent[chainId],
              PERMANENT_CHALLENGE_CARDS_QUERY,
              { ids: stakeIds },
            ).then((payload): DashboardActivity[] =>
              (payload?.challenges ?? []).map((challenge: any) =>
                permanentChallengeToActivity(challenge, chainId, new Map()),
              ),
            )
          : Promise.resolve([]),
      ]
    }),
  )
  return cards.flat()
}

/** The app's load: every chain, list metadata, creation-time refresh. */
export const fetchDashboardData = (): Promise<DashboardData> =>
  loadDashboardData({ refreshCreationTimes: true, challengeWindows: true })

/** A promise that settles to null past its budget. */
const withBudget = <T>(promise: Promise<T>, ms: number): Promise<T | null> => {
  let timer: number | undefined
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      timer = window.setTimeout(() => resolve(null), ms)
    }),
  ]).finally(() => window.clearTimeout(timer))
}

/**
 * One chain's challenge windows: each list's period read on chain, then the
 * cards of the requests whose window closes soonest. A period that did not
 * load is left out, never guessed; the cards are read only when every
 * request on the chain could be placed, so their order is exact.
 */
const readChainWindows = async (
  chainId: number,
  rows: UnchallengedRow[],
): Promise<{
  periods: Record<string, number>
  closingSoon?: DashboardActivity[]
}> => {
  const read = await readChallengePeriods(
    chainId,
    rows.map((row) => row.registry),
  ).catch(() => new Map<string, number>())
  const periods = Object.fromEntries(read)
  if (!rowsPlaced(rows, periods)) return { periods }
  const soonest = openWindows(rows, periods, Math.floor(Date.now() / 1000))
    .slice(0, CLOSING_SOON_LIMIT)
    .map(({ row }) => row)
  if (soonest.length === 0) return { periods, closingSoon: [] }
  const payload = await safeRequest<any>(
    subgraphUrl[chainId],
    ENVIO_REQUEST_CARDS_QUERY,
    {
      lightIds: soonest
        .filter((row) => row.kind === 'light')
        .map((row) => row.id),
      classicIds: soonest
        .filter((row) => row.kind === 'classic')
        .map((row) => row.id),
    },
  )
  if (!payload) return { periods }
  const cards = new Map<string, DashboardActivity>()
  for (const row of (payload.light ?? []) as DashboardRequestRow[])
    cards.set(`light-${row.id}`, requestToActivity(row, 'light'))
  for (const row of (payload.classic ?? []) as DashboardRequestRow[])
    cards.set(`classic-${row.id}`, requestToActivity(row, 'classic'))
  return {
    periods,
    closingSoon: soonest
      .map((row) => cards.get(`${row.kind}-${row.id}`))
      .filter((card): card is DashboardActivity => !!card),
  }
}

/**
 * A second try at the challenge windows a load could not place (a slow or
 * failing node), outside the load's time budget: reads the chains still
 * missing a period or their closing-soon cards and returns the data with
 * them filled in. Periods read before come from the read cache.
 */
export const completeChallengeWindows = async (
  data: DashboardData,
): Promise<DashboardData> => {
  const chains = Object.keys(data.unchallengedRows)
    .map(Number)
    .filter((chainId) => windowsPending(data, chainId))
  if (chains.length === 0) return data
  const next: DashboardData = {
    ...data,
    challengePeriods: { ...data.challengePeriods },
    closingSoon: { ...data.closingSoon },
  }
  await Promise.all(
    chains.map(async (chainId) => {
      const placed = await readChainWindows(
        chainId,
        data.unchallengedRows[chainId] ?? [],
      )
      next.challengePeriods[chainId] = {
        ...data.challengePeriods[chainId],
        ...placed.periods,
      }
      if (placed.closingSoon) next.closingSoon[chainId] = placed.closingSoon
    }),
  )
  return next
}

export const loadDashboardData = async ({
  refreshCreationTimes,
  chains = SUPPORTED_CHAIN_IDS,
  enrichMetadata = true,
  challengeWindows: readWindows = false,
}: {
  /** Scan chain logs in the background for list creation times. */
  refreshCreationTimes: boolean
  /** The chains to read (the landing page reads the mainnets only). */
  chains?: number[]
  /** Read missing list metadata from IPFS (titles, logos). */
  enrichMetadata?: boolean
  /** Read each list's challenge period on chain to place open requests. */
  challengeWindows?: boolean
}): Promise<DashboardData> => {
  const since = windowStart(Math.floor(Date.now() / 1000))
  // Chains where any query failed or timed out: their figures are partial.
  const failed = new Set<number>()
  // Chains whose lists did not load: a subset of `failed`.
  const listsFailed = new Set<number>()
  const listsMissing = (chainId: number) => {
    failed.add(chainId)
    listsFailed.add(chainId)
  }
  // Creation blocks come from chain logs (cached once read). Use what is
  // cached now and refresh in the background; never block the page on it.
  const cachedCreation = readCachedCreationTimes(chains)
  if (refreshCreationTimes)
    void fetchRegistryCreationTimes(chains).catch(() => undefined)

  // The Stake lists (another indexer) load alongside the main query.
  const permanentRead = Promise.all(
    chains.map((chainId) =>
      safeRequest<any>(
        subgraphUrlPermanent[chainId],
        PERMANENT_DASHBOARD_QUERY,
      ),
    ),
  )

  const envioResults = await Promise.all(
    chains.map(async (chainId) => {
      const payload = await safeRequest<any>(
        subgraphUrl[chainId],
        ENVIO_DASHBOARD_QUERY,
        {
          chainId,
          since,
          listsOfLists: getListOfListsAddresses(chainId),
        },
      )
      if (!payload) listsMissing(chainId)
      return payload
        ? normalizeEnvio(
            await readRemainingRegistries(payload, chainId, () =>
              listsMissing(chainId),
            ),
            chainId,
          )
        : null
    }),
  )

  // Once the main query is in (the heaviest: nothing competes with it on
  // its indexer), the 30-day curator pages and the all-time rulings ledger
  // run together, alongside the list metadata.
  const leaderboardRead = fetchCuratorLeaderboard(since, chains, failed)
  const rulingsRead = Promise.all(
    chains.map((chainId) =>
      readRulings(chainId).then((ledger) => {
        if (!ledger) failed.add(chainId)
        return ledger
      }),
    ),
  )

  // Chain reads run alongside the Stake and curator queries below, and
  // never hold the page: past their budget a chain's windows count as
  // unknown (the dashboard then tries again on its own).
  const windowsRead = Promise.all(
    chains.map((chainId, index) => {
      const result = envioResults[index]
      return readWindows && result
        ? withBudget(
            readChainWindows(chainId, result.unchallengedRows),
            CHALLENGE_WINDOWS_BUDGET_MS,
          )
        : Promise.resolve(null)
    }),
  )

  const permanentResults = (await permanentRead).map((payload, index) => {
    const chainId = chains[index]
    const verifiedRegistryAddresses = new Set(
      envioResults[index]?.verifiedRegistryAddresses ??
        getListOfListsAddresses(chainId),
    )
    if (!payload) listsMissing(chainId)
    return payload
      ? normalizePermanent(payload, chainId, since, verifiedRegistryAddresses)
      : null
  })

  const allResults = [...envioResults, ...permanentResults].filter(
    Boolean,
  ) as NormalizedChain[]

  const merged = dedupeRegistries(
    allResults.flatMap((result) => result.registries),
  )
  const [enriched, leaderboard, ledgers] = await Promise.all([
    enrichMetadata ? enrichRegistryMetadata(merged) : merged,
    leaderboardRead,
    rulingsRead,
  ])
  const registries = applyCreationTimes(enriched, cachedCreation).sort(
    (a, b) =>
      Number(b.trustStatus === 'verified') -
        Number(a.trustStatus === 'verified') ||
      b.activeCount - a.activeCount ||
      b.itemCount - a.itemCount ||
      (b.lastActivityAt || 0) - (a.lastActivityAt || 0),
  )

  // When each Kleros Verified list earned the badge (the lists of lists
  // themselves have no registration: they grant it).
  chains.forEach((chainId, index) => {
    const since = envioResults[index]?.verifiedSince ?? {}
    for (const registry of registries)
      if (
        registry.chainId === chainId &&
        registry.trustStatus === 'verified' &&
        since[registry.address]
      )
        registry.verifiedAt = since[registry.address]
  })

  const newestFirst = (rows: DashboardActivity[]) =>
    rows
      .filter((activity) => activity.timestamp > 0)
      .sort((a, b) => b.timestamp - a.timestamp)

  const openDisputes = newestFirst(
    allResults.flatMap((result) => result.openDisputes),
  )
  // "In court" per list = its disputes that are open right now (the per-list
  // counters drift on some deployments and were double counted before).
  const openByRegistry = new Map<string, number>()
  for (const activity of openDisputes) {
    const key = `${activity.chainId}:${activity.registryAddress}`
    openByRegistry.set(key, (openByRegistry.get(key) ?? 0) + 1)
  }
  for (const registry of registries)
    registry.disputeCount =
      openByRegistry.get(`${registry.chainId}:${registry.address}`) ?? 0

  const unchallengedCount: DashboardData['unchallengedCount'] = {}
  const openDisputesCapped: DashboardData['openDisputesCapped'] = {}
  const rulings: DashboardData['rulings'] = {}
  const rulingsCapped: DashboardData['rulingsCapped'] = {}
  chains.forEach((chainId, index) => {
    const envio = envioResults[index]
    const permanent = permanentResults[index]
    unchallengedCount[chainId] = {
      count: envio?.unchallengedCount ?? 0,
      capped: !!envio?.unchallengedCapped,
    }
    openDisputesCapped[chainId] =
      !!envio?.openDisputesCapped || !!permanent?.openDisputesCapped
    const ledger = ledgers[index]
    if (!ledger) return
    rulings[chainId] = ledger.rows
    rulingsCapped[chainId] = ledger.capped
  })

  // Symbols of the tokens Stake bounties were paid in (known ones need no read).
  const bountyTokens = new Map<string, { chainId: number; token: string }>()
  for (const rows of Object.values(rulings))
    for (const row of rows)
      if (row.token && row.challengerWon)
        bountyTokens.set(`${row.chainId}:${row.token}`, {
          chainId: row.chainId,
          token: row.token,
        })
  const tokens =
    (await withBudget(
      readTokens([...bountyTokens.values()]),
      TOKEN_BUDGET_MS,
    )) ?? {}

  const { users, series, seriesByChain, seriesTruncated } = leaderboard

  const windows = await windowsRead
  const unchallengedRows: DashboardData['unchallengedRows'] = {}
  const challengePeriods: DashboardData['challengePeriods'] = {}
  const closingSoon: DashboardData['closingSoon'] = {}
  chains.forEach((chainId, index) => {
    const envio = envioResults[index]
    if (envio) unchallengedRows[chainId] = envio.unchallengedRows
    const placed = windows[index]
    if (!placed) return
    challengePeriods[chainId] = placed.periods
    if (placed.closingSoon) closingSoon[chainId] = placed.closingSoon
  })

  return {
    generatedAt: Date.now(),
    since,
    series,
    seriesByChain,
    seriesTruncated,
    registries,
    activities: newestFirst(allResults.flatMap((result) => result.activities)),
    unchallenged: newestFirst(
      allResults.flatMap((result) => result.unchallenged),
    ),
    unchallengedCount,
    unchallengedRows,
    challengePeriods,
    closingSoon,
    decided: newestFirst(allResults.flatMap((result) => result.decided)),
    rulings,
    rulingsCapped,
    tokens,
    openDisputes,
    openDisputesCapped,
    users,
    metrics: buildMetrics(registries, users),
    failedChains: [...failed],
    listFailedChains: [...listsFailed],
  }
}
