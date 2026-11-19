import { gql } from 'graphql-request'
import { getPublicClient } from '@wagmi/core'
import { parseAbi } from 'viem'
import { request } from 'utils/indexer-request'
import {
  klerosAddresses,
  klerosDisplayUrl,
  subgraphUrl,
  subgraphUrlPermanent,
} from 'config/tcr-addresses'
import { wagmiConfig } from 'config/wagmi'
import { normalizeAddress } from 'pages/dashboard/data'
import { SUPPORTED_CHAIN_IDS } from './data'

/*
 * The address as a Kleros juror on Curate: the seats it was drawn to in
 * disputes over a Curate list, and how many of those it voted in.
 *
 * "A Curate dispute" is the dashboard's own population: a dispute whose
 * arbitrable is a list the Curate indexers know (Standard, Stake, and the
 * retired Classic lists of 2020-2022, which the all-time ledger counts as the
 * protocol's history). It is never a court filter: Curate disputes sit in
 * several courts, and those courts hear other cases too.
 *
 * Per chain:
 * 1. Seats: the Kleros Display index's draws for the address (one row per
 *    vote slot, paged by id).
 * 2. Their disputes' arbitrable, period and round count, from the same index.
 * 3. Which arbitrables are Curate lists, from the Envio indexer (Standard and
 *    Classic) and the Stake subgraph.
 * 4. Votes: getVote on the arbitrator for every Curate seat, in one multicall
 *    per 400 seats. The index has no vote entity, so the chain is the only
 *    source, and `voted` is the only field read: before a juror reveals,
 *    `choice` reads 0, a vote nobody cast (hooks/use-dispute-jury.ts).
 *
 * Nothing is guessed. A chain whose index or indexers did not answer is
 * reported unread and counts nothing; a chain whose seats run past the page
 * cap is reported capped, its seats a lower bound; and when the votes could
 * not be read the seats still stand and the votes stay unknown.
 */

const TIMEOUT_MS = 10_000
const PAGE_ROWS = 1000
/**
 * Seat pages read per chain at most. The busiest juror today holds 589 seats
 * on Gnosis and 365 on Ethereum, one page each; past this the seats are a
 * lower bound and the chain is reported capped.
 */
const MAX_DRAW_PAGES = 10
export const JURY_SEAT_LIMIT = PAGE_ROWS * MAX_DRAW_PAGES
/** Dispute IDs asked about per query. */
const DISPUTE_CHUNK = 500
/** getVote calls per multicall: about 2.5M gas, under every node's cap. */
const VOTE_CHUNK = 400

/** The periods in which a round is still collecting votes. */
const VOTING_PERIODS = new Set(['EVIDENCE', 'COMMIT', 'VOTE'])

const GET_VOTE_ABI = parseAbi([
  'function getVote(uint256 disputeID, uint256 appeal, uint256 voteID) view returns (address account, bytes32 commit, uint256 choice, bool voted)',
])

const DRAWS_QUERY = gql`
  query JurorDraws($juror: Bytes!, $after: ID!) {
    draws(
      first: ${PAGE_ROWS}
      where: { address: $juror, id_gt: $after }
      orderBy: id
      orderDirection: asc
    ) {
      id
      disputeID
      appeal
      voteID
    }
  }
`

const DISPUTES_QUERY = gql`
  query JurorDisputes($ids: [BigInt!]!) {
    disputes(first: ${PAGE_ROWS}, where: { disputeIDNumber_in: $ids }) {
      disputeIDNumber
      arbitrated
      period
      nbRounds
    }
  }
`

const STANDARD_LISTS_QUERY = gql`
  query CurateLists($ids: [String!]!, $chainId: Int!) {
    LRegistry(where: { id: { _in: $ids }, chainId: { _eq: $chainId } }) {
      id
    }
    Registry(where: { id: { _in: $ids }, chainId: { _eq: $chainId } }) {
      id
    }
  }
`

const STAKE_LISTS_QUERY = gql`
  query CurateStakeLists($ids: [ID!]!) {
    registries(first: ${PAGE_ROWS}, where: { id_in: $ids }) {
      id
    }
  }
`

export interface JuryChain {
  /** Seats the address held in disputes over a Curate list. */
  seats: number
  /** The distinct disputes those seats sit in. */
  cases: number
  /** Of the seats, those it voted in; undefined when the votes could not be read. */
  votes?: number
  /**
   * Seats not voted yet in a round still collecting votes (evidence, commit
   * or vote period): neither voted nor missed. 0 when the votes are unknown.
   */
  voting: number
  /** The seat read stopped at its page cap: the figures are lower bounds. */
  capped: boolean
}

export interface CurateJury {
  /** Per chain that was read in full or up to its cap. */
  chains: Record<number, JuryChain>
  /**
   * Chains whose court index or Curate indexers did not answer, or that have
   * no court index configured: nothing there is counted, so every figure
   * that covers them is a lower bound.
   */
  unreadChains: number[]
}

type Draw = { id: string; disputeID: string; appeal: string; voteID: string }
type Dispute = {
  disputeIDNumber: string
  arbitrated: string
  period: string
  nbRounds: string
}

/** One query, cut off after TIMEOUT_MS; throws on any failure. */
const ask = async <T>(
  url: string,
  document: string,
  variables: Record<string, unknown>,
): Promise<T> => {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await request<T>({
      url,
      document,
      variables,
      signal: controller.signal,
    })
  } finally {
    window.clearTimeout(timer)
  }
}

const chunks = <T>(values: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size),
  )

/** Every seat of the juror on a chain, and whether the read hit its cap. */
const readDraws = async (
  url: string,
  juror: string,
): Promise<{ draws: Draw[]; capped: boolean }> => {
  const draws: Draw[] = []
  let after = ''
  for (let page = 0; page < MAX_DRAW_PAGES; page += 1) {
    const { draws: rows } = await ask<{ draws: Draw[] }>(url, DRAWS_QUERY, {
      juror,
      after,
    })
    draws.push(...rows)
    if (rows.length < PAGE_ROWS) return { draws, capped: false }
    after = rows[rows.length - 1].id
  }
  return { draws, capped: true }
}

/** The arbitrables among `ids` that are Curate lists on the chain. */
const readCurateLists = async (
  chainId: number,
  ids: string[],
): Promise<Set<string>> => {
  const lists = new Set<string>()
  if (ids.length === 0) return lists
  const standardUrl = subgraphUrl[chainId]
  const stakeUrl = subgraphUrlPermanent[chainId]
  // An indexer with no URL has no lists on the chain: nothing to match, and
  // not a failure (as the profile's own reads treat it).
  const [standard, stake] = await Promise.all([
    standardUrl
      ? ask<{ LRegistry: { id: string }[]; Registry: { id: string }[] }>(
          standardUrl,
          STANDARD_LISTS_QUERY,
          { ids, chainId },
        )
      : undefined,
    stakeUrl
      ? ask<{ registries: { id: string }[] }>(stakeUrl, STAKE_LISTS_QUERY, {
          ids,
        })
      : undefined,
  ])
  for (const row of [
    ...(standard?.LRegistry ?? []),
    ...(standard?.Registry ?? []),
    ...(stake?.registries ?? []),
  ])
    lists.add(normalizeAddress(row.id))
  return lists
}

/**
 * How many of the seats the juror voted in, by getVote on the arbitrator;
 * undefined when any part of the read failed.
 */
const readVotes = async (
  chainId: number,
  arbitrator: string,
  juror: string,
  seats: Draw[],
): Promise<Set<string> | undefined> => {
  const client = getPublicClient(wagmiConfig, {
    chainId: chainId as (typeof wagmiConfig)['chains'][number]['id'],
  })
  if (!client) return undefined
  const voted = new Set<string>()
  for (const part of chunks(seats, VOTE_CHUNK)) {
    // batchSize 0: one eth_call per chunk (viem otherwise splits a multicall
    // at 1,024 bytes of calldata).
    const results = await client.multicall({
      contracts: part.map((seat) => ({
        address: arbitrator as `0x${string}`,
        abi: GET_VOTE_ABI,
        functionName: 'getVote',
        args: [
          BigInt(seat.disputeID),
          BigInt(seat.appeal),
          BigInt(seat.voteID),
        ],
      })),
      allowFailure: true,
      batchSize: 0,
    })
    for (const [index, result] of results.entries()) {
      if (result.status !== 'success') return undefined
      const vote = result.result as readonly [string, string, bigint, boolean]
      const [account] = vote
      const hasVoted = vote[3]
      if (hasVoted && normalizeAddress(account) === juror)
        voted.add(part[index].id)
    }
  }
  return voted
}

/** One chain's juror figures; throws when an index or indexer did not answer. */
const readChain = async (
  chainId: number,
  juror: string,
): Promise<JuryChain> => {
  const displayUrl = klerosDisplayUrl[chainId]
  const arbitrator = klerosAddresses[chainId]?.arbitrator
  if (!displayUrl || !arbitrator)
    throw new Error(`No court index configured for chain ${chainId}`)

  const { draws, capped } = await readDraws(displayUrl, juror)
  if (draws.length === 0)
    return { seats: 0, cases: 0, votes: 0, voting: 0, capped }

  const disputeIds = [...new Set(draws.map((draw) => draw.disputeID))]
  const disputes = new Map<string, Dispute>()
  for (const part of chunks(disputeIds, DISPUTE_CHUNK)) {
    const { disputes: rows } = await ask<{ disputes: Dispute[] }>(
      displayUrl,
      DISPUTES_QUERY,
      { ids: part },
    )
    for (const row of rows) disputes.set(row.disputeIDNumber, row)
  }

  const lists = await readCurateLists(chainId, [
    ...new Set(
      [...disputes.values()].map((d) => normalizeAddress(d.arbitrated)),
    ),
  ])
  const seats = draws.filter((draw) => {
    const dispute = disputes.get(draw.disputeID)
    return !!dispute && lists.has(normalizeAddress(dispute.arbitrated))
  })
  if (seats.length === 0)
    return { seats: 0, cases: 0, votes: 0, voting: 0, capped }

  const voted = await readVotes(chainId, arbitrator, juror, seats).catch(
    (err: unknown) => {
      console.warn('Juror votes read failed', chainId, err)
      return undefined
    },
  )
  // A seat in the dispute's latest round, while that round still collects
  // votes, has not been missed yet.
  const live = (draw: Draw) => {
    const dispute = disputes.get(draw.disputeID)
    return (
      !!dispute &&
      VOTING_PERIODS.has(dispute.period) &&
      Number(draw.appeal) === Number(dispute.nbRounds) - 1
    )
  }
  return {
    seats: seats.length,
    cases: new Set(seats.map((seat) => seat.disputeID)).size,
    votes: voted?.size,
    voting: voted
      ? seats.filter((seat) => !voted.has(seat.id) && live(seat)).length
      : 0,
    capped,
  }
}

/**
 * The address's juror record on Curate, every chain the profile covers. Read
 * apart from the profile, like the governance scan, so the figures never
 * wait for it.
 */
export const fetchCurateJury = async (
  rawAddress: string,
): Promise<CurateJury> => {
  const juror = normalizeAddress(rawAddress)
  const chains: Record<number, JuryChain> = {}
  const unreadChains: number[] = []
  await Promise.all(
    SUPPORTED_CHAIN_IDS.map(async (chainId) => {
      try {
        chains[chainId] = await readChain(chainId, juror)
      } catch (err) {
        console.warn('Juror read failed', chainId, err)
        unreadChains.push(chainId)
      }
    }),
  )
  return { chains, unreadChains }
}
