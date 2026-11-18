import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { gql } from 'graphql-request'
import { BigNumber } from 'ethers'
import { STALE_TIME } from 'consts'
import { useGraphqlBatcher } from 'contexts/graphql-batcher'
import { CONTRACT_STATUS, SUBGRAPH_RULING } from 'utils/item-status'
import { standardEntryStatus } from './entry-status'
import { entryName } from './registry-entry-name'
import { LANE_CAP } from './registry-lane-plot'
import type { LaneMark, LaneSegment } from './registry-lane-plot'
import type { V2Field } from './v2'

/*
 * What the Standard registry page's stats are drawn from. A Standard entry
 * lives through requests, so each figure comes from its own selection rather
 * than from the per-list counters (DESIGN.md, Data rules: those drift):
 * - the latest entries with their request history, for one lane each;
 * - every challenge raised on the list, for the challenge outcomes.
 * The statuses the lanes' heads carry come from standardEntryStatus, the one
 * place that derives a Standard entry's status, so a lane can never disagree
 * with the row it belongs to.
 */

/** Entries drawn as lanes: the most recently active ones. */
const LANES = LANE_CAP
/** Requests read per entry, newest first: far more than any entry has. */
const HISTORY_CAP = 24
/** Challenges read in one page; the tally reads "n+" at this many. */
export const CHALLENGE_CAP = 1000

const STANDARD_SUMMARY_QUERY = gql`
  query standardRegistrySummary(
    $registryId: String!
    $lanes: Int!
    $history: Int!
    $challenges: Int!
  ) {
    recent: LItem(
      limit: $lanes
      where: { registry_id: { _eq: $registryId } }
      order_by: [{ latestRequestSubmissionTime: desc }]
    ) {
      itemID
      status
      data
      props(order_by: [{ label: asc }]) {
        label
        value
        type: itemType
        isIdentifier
      }
      latest: requests(limit: 1, order_by: [{ submissionTime: desc }]) {
        requester
        challenger
        requestType
        submissionTime
        disputed
        resolved
        rounds(limit: 1, order_by: [{ creationTime: desc }]) {
          appealPeriodStart
          appealPeriodEnd
          ruling
          hasPaidRequester
          hasPaidChallenger
          amountPaidRequester
          amountPaidChallenger
        }
      }
      history: requests(limit: $history, order_by: [{ submissionTime: desc }]) {
        requestType
        submissionTime
        challengeTime
        resolutionTime
        resolved
        disputed
        disputeOutcome
      }
    }
    challenges: LRequest(
      limit: $challenges
      where: { registry_id: { _eq: $registryId }, disputed: { _eq: true } }
      order_by: [{ challengeTime: desc }]
    ) {
      requestType
      resolved
      disputeOutcome
    }
  }
`

interface RawRound {
  appealPeriodStart: string
  appealPeriodEnd: string
  ruling: string
  hasPaidRequester: boolean
  hasPaidChallenger: boolean
  amountPaidRequester: string
  amountPaidChallenger: string
}

/** The entry's current request, all the status derivation needs. */
interface LatestRequest {
  requester: string
  challenger: string
  requestType: string
  submissionTime: string
  disputed: boolean
  resolved: boolean
  rounds: RawRound[]
}

/** One request in the entry's history, as the lane reads it. */
interface HistoryRequest {
  requestType: string
  submissionTime: string
  challengeTime?: string | null
  resolutionTime?: string | null
  resolved: boolean
  disputed: boolean
  disputeOutcome?: string | null
}

interface SummaryItem {
  itemID: string
  status: string
  data: string
  props?: V2Field[] | null
  latest?: LatestRequest[] | null
  history?: HistoryRequest[] | null
}

interface RawChallenge {
  requestType: string
  resolved: boolean
  disputeOutcome?: string | null
}

export interface StandardLane {
  id: string
  name?: string
  /** The status the list rows show: its code says what the page hides, its
   *  label names the lane's live head. */
  statusCode?: number
  statusLabel?: string
  /** Listed stretches first, so the request overlays sit on top of them. */
  segments: LaneSegment[]
  marks: LaneMark[]
  /** Unix seconds of the earliest request the lane was built from. */
  since: number
  /** When the current listing began; undefined when it is not listed now. */
  listedSince?: number
  /** The last listing that ended, and what ended it. */
  wasListed?: { start: number; end: number; by: 'ruling' | 'executed' }
  /** The request still running, if any. */
  open?: { start: number; inCourtSince?: number; removal: boolean }
  /** Times it has been on the list, the current listing included. */
  listings: number
  /** Challenges raised against it, and when the latest one was raised. */
  challenges: number
  lastChallenge?: number
}

export interface StandardSummary {
  /** One lane per entry, the most recently active first. */
  lanes: StandardLane[]
  /** Every challenge on the list, by what it did to the entry. */
  challenges: {
    total: number
    offList: number
    onList: number
    inCourt: number
    /** The page cap was reached: the counts are a lower bound ("n+"). */
    capped: boolean
  }
}

const num = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

const isRemoval = (requestType: string) =>
  requestType === CONTRACT_STATUS.REMOVAL_REQUESTED

/** A request the registry carried out: unchallenged, or won in court. */
const succeeded = (request: HistoryRequest) =>
  request.resolved &&
  (!request.disputed || request.disputeOutcome === SUBGRAPH_RULING.ACCEPT)

/**
 * The entry as standardEntryStatus reads it: its contract status and its
 * current request. Nothing is invented — the amounts paid are fetched
 * because a round holds them, though the status never reads them.
 */
const asSubgraphItem = (item: SummaryItem): SubgraphItem => ({
  itemID: item.itemID,
  status: item.status,
  data: item.data,
  disputed: item.latest?.[0]?.disputed ?? false,
  resolved: item.latest?.[0]?.resolved,
  requests: (item.latest ?? []).map((request) => ({
    requester: request.requester,
    challenger: request.challenger,
    submissionTime: request.submissionTime,
    disputed: request.disputed,
    resolved: request.resolved,
    requestType: request.requestType,
    rounds: (request.rounds ?? []).map((round) => ({
      appealPeriodStart: round.appealPeriodStart,
      appealPeriodEnd: round.appealPeriodEnd,
      ruling: round.ruling,
      hasPaidRequester: round.hasPaidRequester,
      hasPaidChallenger: round.hasPaidChallenger,
      amountPaidRequester: BigNumber.from(round.amountPaidRequester || 0),
      amountPaidChallenger: BigNumber.from(round.amountPaidChallenger || 0),
    })),
  })),
})

/**
 * One entry's lane. A Standard entry is on the list only from the moment a
 * registration request resolved in its favour, so the blue stretch is the
 * request's window, the amber one the court, and the green one the listing
 * that followed. A ruling that took the entry off leaves a red dot; an
 * uncontested removal a plain stop.
 */
const laneFor = (
  item: SummaryItem,
  timestamp: BigNumber | null | undefined,
  challengePeriodDuration: BigNumber | null | undefined,
): StandardLane => {
  // Newest first from the indexer (so the lane's recent end is always
  // right), walked oldest first here.
  const history = [...(item.history ?? [])].reverse()
  const listed: LaneSegment[] = []
  const requests: LaneSegment[] = []
  const marks: LaneMark[] = []
  let listedSince: number | undefined
  let wasListed: StandardLane['wasListed']
  let open: StandardLane['open']
  let listings = 0
  let challenges = 0
  let lastChallenge: number | undefined

  history.forEach((request) => {
    const start = num(request.submissionTime)
    if (start <= 0) return
    const removal = isRemoval(request.requestType)
    // A resolved request the indexer has no resolution time for claims no
    // date: its stretch closes where it opened rather than running to today.
    const closed = request.resolved
      ? num(request.resolutionTime) || start
      : undefined
    const inCourtSince = request.disputed
      ? num(request.challengeTime) || undefined
      : undefined
    if (request.disputed) {
      challenges += 1
      if (inCourtSince !== undefined) lastChallenge = inCourtSince
    }
    requests.push({
      start,
      end: inCourtSince ?? closed,
      kind: 'pending',
      glow: closed === undefined && inCourtSince === undefined,
    })
    if (inCourtSince !== undefined)
      requests.push({
        start: inCourtSince,
        end: closed,
        kind: 'court',
        glow: closed === undefined,
      })
    if (closed === undefined) {
      open = { start, inCourtSince, removal }
      return
    }
    if (!removal) {
      if (succeeded(request)) {
        listedSince = closed
        listings += 1
      } else marks.push({ at: closed, kind: 'off' })
      return
    }
    // A removal the registry carried out ends the listing; a rejected one
    // leaves it running.
    if (!succeeded(request)) return
    if (listedSince !== undefined) {
      listed.push({ start: listedSince, end: closed, kind: 'was-listed' })
      wasListed = {
        start: listedSince,
        end: closed,
        by: request.disputed ? 'ruling' : 'executed',
      }
      listedSince = undefined
    }
    marks.push({ at: closed, kind: request.disputed ? 'off' : 'stop' })
  })
  if (listedSince !== undefined)
    listed.push({ start: listedSince, kind: 'listed', glow: true })

  const status = standardEntryStatus(
    asSubgraphItem(item),
    timestamp,
    challengePeriodDuration,
  )
  // An entry off the list has no live head: its last mark says what ended it.
  if (status && item.status !== CONTRACT_STATUS.ABSENT)
    marks.push({ at: 'now', kind: 'status', tone: status.tone })

  const segments = [...listed, ...requests]
  return {
    id: item.itemID,
    name: entryName(item.props ?? undefined),
    statusCode: status?.code,
    statusLabel: status?.label,
    segments,
    marks,
    since: segments.length > 0 ? Math.min(...segments.map((s) => s.start)) : 0,
    listedSince,
    wasListed,
    open,
    listings,
    challenges,
    lastChallenge,
  }
}

const tallyChallenges = (
  challenges: RawChallenge[],
): StandardSummary['challenges'] => {
  const tally = {
    total: challenges.length,
    offList: 0,
    onList: 0,
    inCourt: 0,
    capped: challenges.length >= CHALLENGE_CAP,
  }
  challenges.forEach((challenge) => {
    if (!challenge.resolved) {
      tally.inCourt += 1
      return
    }
    // Accepted means the requester won: a registration lands the entry on
    // the list, a removal takes it off.
    const accepted = challenge.disputeOutcome === SUBGRAPH_RULING.ACCEPT
    if (accepted === isRemoval(challenge.requestType)) tally.offList += 1
    else tally.onList += 1
  })
  return tally
}

/**
 * The Standard registry page's stats. `summary` is undefined while the read
 * is in flight and when it failed, so the page shows nothing rather than a
 * figure it cannot stand behind.
 */
export const useStandardSummary = ({
  chainId,
  registryId,
  timestamp,
  challengePeriodDuration,
}: {
  chainId?: number | null
  registryId?: string
  timestamp?: BigNumber | null
  challengePeriodDuration?: BigNumber | null
}) => {
  const { graphqlBatcher } = useGraphqlBatcher()
  const registry = registryId?.toLowerCase()
  const query = useQuery({
    queryKey: ['standardRegistrySummary', chainId, registry],
    queryFn: async () => {
      if (!chainId || !registry) return null
      const data = await graphqlBatcher.fetch({
        id: crypto.randomUUID(),
        document: STANDARD_SUMMARY_QUERY,
        variables: {
          registryId: registry,
          lanes: LANES,
          history: HISTORY_CAP,
          challenges: CHALLENGE_CAP,
        },
        chainId,
      })
      const items = data?.recent as SummaryItem[] | undefined
      if (!items) return null
      return {
        items,
        challenges: (data?.challenges as RawChallenge[] | undefined) ?? [],
      }
    },
    enabled: !!chainId && !!registry,
    staleTime: STALE_TIME,
  })
  const data = query.data
  const summary = useMemo(
    (): StandardSummary | undefined =>
      data
        ? {
            lanes: data.items.map((item) =>
              laneFor(item, timestamp, challengePeriodDuration),
            ),
            challenges: tallyChallenges(data.challenges),
          }
        : undefined,
    [data, timestamp, challengePeriodDuration],
  )
  return {
    summary,
    loading: query.isLoading,
    failed: query.isError || data === null,
  }
}

export default useStandardSummary
