import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { ethers } from 'ethers'
import { useEthersProvider } from 'hooks/ethers-adapters'
import { isKlerosArbitrator } from 'config/tcr-addresses'
import { aggregateCalls } from 'hooks/use-dispute-timeline'

/*
 * The jury of a Kleros Court v1 dispute, read from the arbitrator itself:
 * who was drawn, where each juror is (committed, revealed, still to vote)
 * and, once revealed, which way they voted.
 *
 * The chain is the only source for this. The Kleros Display subgraph these
 * chains index has no vote entity at all — its Draw rows carry an address
 * and a vote id and nothing else, and Round.jurors comes back empty — so
 * the votes are read with getVote, one call per vote slot, batched into one
 * eth_call per dispute.
 *
 * A juror can hold several of a round's vote slots (they are drawn in
 * proportion to their stake), so slots are grouped by address and the
 * juror's weight is the number of slots they hold.
 *
 * The one trap: before a juror reveals, `choice` reads 0, which in Curate
 * means "refused to rule". Rendering it would publish a vote nobody cast,
 * so the state comes from the `voted` flag and the commitment alone, and
 * `choice` is only ever exposed once `voted` is true. That also keeps a
 * hidden-votes court sealed until its reveal period.
 */

const KLEROS_LIQUID_ABI = [
  'function disputes(uint256) view returns (uint96 subcourtID, address arbitrated, uint256 numberOfChoices, uint8 period, uint256 lastPeriodChange, uint256 drawsInRound, uint256 commitsInRound, bool ruled)',
  'function getDispute(uint256) view returns (uint256[] votesLengths, uint256[] tokensAtStakePerJuror, uint256[] totalFeesForJurors, uint256[] votesInEachRound, uint256[] repartitionsInEachRound, uint256[] penaltiesInEachRound)',
  'function getVote(uint256,uint256,uint256) view returns (address account, bytes32 commit, uint256 choice, bool voted)',
  'function getVoteCounter(uint256,uint256) view returns (uint256 winningChoice, uint256[] counts, bool tied)',
]
const kleros = new ethers.utils.Interface(KLEROS_LIQUID_ABI)

/**
 * A round larger than this is not read: it would be one call per seat. The
 * jury band says so in place of the rows, so it reads the same limit.
 */
export const MAX_SLOTS = 64
/** The rounds read when no round is asked for: the live one and the one
    appealed from. */
const MAX_ROUNDS = 2
/**
 * How many of an entry's disputes the evidence badges ask about. A Stake
 * entry can be challenged again and again, and every dispute costs one
 * multicall of one getVote per seat, so only the first few the caller
 * lists are read (newest first); a juror of an older one gets no badge,
 * which is honest.
 */
const MAX_DISPUTES = 4

const NO_COMMIT =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

export type JurorState = 'pending' | 'committed' | 'revealed'

export interface JuryJuror {
  address: string
  /** The round's vote slots this juror holds: their weight in the tally. */
  voteIDs: number[]
  state: JurorState
  /** Only set once the juror has revealed: never read before that. */
  choice?: number
  /** The sealed vote, while a hidden-votes court holds one. */
  commit?: string
}

export interface JuryRound {
  /** 1 for the first round, as the page numbers them. */
  round: number
  /** The arbitrator's own index for the round (0 for the first). */
  appeal: number
  /** Seats in the round. */
  slots: number
  /** Seats drawn so far; the rest have no juror yet. */
  drawn: number
  jurors: JuryJuror[]
  /** Votes per choice, once any is revealed (index = choice). */
  tally?: { counts: number[]; winning: number; tied: boolean }
}

export interface DisputeJury {
  /** Newest round first. */
  rounds: JuryRound[]
  /** Ruled, or in the execution period: no seat or vote changes any more. */
  settled: boolean
}

/** KlerosLiquid's execution period: the votes are counted and final. */
const EXECUTION_PERIOD = 4

export const fetchDisputeJury = async (
  provider: ethers.providers.Provider,
  arbitrator: string,
  disputeID: string,
  /** The round indexes to read (0 for the first); the latest two by default. */
  appeals?: number[],
): Promise<DisputeJury> => {
  const [dispute, rounds] = await aggregateCalls(provider, arbitrator, kleros, [
    ['disputes', [disputeID]],
    ['getDispute', [disputeID]],
  ])
  const votesLengths = (rounds.votesLengths as ethers.BigNumber[]).map((v) =>
    v.toNumber(),
  )
  // xKlerosLiquid keeps disputes in a mapping: an unknown ID reads as zeros
  // rather than reverting.
  if (votesLengths.length === 0)
    throw new Error(`No dispute ${disputeID} on this arbitrator`)
  const latest = votesLengths.length - 1
  const drawsInRound = (dispute.drawsInRound as ethers.BigNumber).toNumber()
  const settled =
    Boolean(dispute.ruled) || Number(dispute.period) >= EXECUTION_PERIOD

  // The rounds asked for, or the latest ones; newest first, and skipping
  // any too large to read seat by seat (a General court round can seat
  // dozens). Asking for one round at a time is what lets the round tabs
  // cost one multicall each and cache on their own.
  const all = votesLengths.map((slots, appeal) => ({ appeal, slots }))
  const wanted = (
    appeals
      ? all.filter((round) => appeals.includes(round.appeal))
      : all.slice(-MAX_ROUNDS)
  )
    .filter((round) => round.slots > 0 && round.slots <= MAX_SLOTS)
    .reverse()
  if (wanted.length === 0) return { rounds: [], settled }

  const calls: [string, unknown[]][] = []
  for (const round of wanted) {
    calls.push(['getVoteCounter', [disputeID, round.appeal]])
    for (let voteID = 0; voteID < round.slots; voteID += 1)
      calls.push(['getVote', [disputeID, round.appeal, voteID]])
  }
  const results = await aggregateCalls(provider, arbitrator, kleros, calls)

  let cursor = 0
  const juryRounds: JuryRound[] = wanted.map((round) => {
    const counter = results[cursor]
    cursor += 1
    const seats = results.slice(cursor, cursor + round.slots)
    cursor += round.slots

    // One row per juror, in the order they were first drawn. A juror's
    // seats are cast one call at a time, so they can stand apart: seats that
    // differ in state or choice are rows of their own (the same address,
    // each with its weight), never folded into whatever the first seat says.
    const jurors: JuryJuror[] = []
    const byAddress = new Map<string, JuryJuror>()
    seats.forEach((seat, voteID) => {
      const account = String(seat.account)
      if (account === ethers.constants.AddressZero) return
      const commit = String(seat.commit)
      const voted = Boolean(seat.voted)
      const state: JurorState = voted
        ? 'revealed'
        : commit === NO_COMMIT
          ? 'pending'
          : 'committed'
      const choice = voted
        ? (seat.choice as ethers.BigNumber).toNumber()
        : undefined
      const key = `${account.toLowerCase()}:${state}:${choice ?? ''}`
      const existing = byAddress.get(key)
      if (existing) {
        existing.voteIDs.push(voteID)
        return
      }
      const juror: JuryJuror = {
        address: account,
        voteIDs: [voteID],
        state,
        choice,
        commit: commit === NO_COMMIT ? undefined : commit,
      }
      byAddress.set(key, juror)
      jurors.push(juror)
    })

    const counts = (counter.counts as ethers.BigNumber[]).map((c) =>
      c.toNumber(),
    )
    const cast = counts.reduce((sum, count) => sum + count, 0)
    return {
      round: round.appeal + 1,
      appeal: round.appeal,
      slots: round.slots,
      // Only the live round is still being drawn; earlier rounds are full.
      drawn:
        round.appeal === latest
          ? Math.min(drawsInRound, round.slots)
          : round.slots,
      jurors,
      tally:
        cast > 0
          ? {
              counts,
              winning: (counter.winningChoice as ethers.BigNumber).toNumber(),
              tied: Boolean(counter.tied),
            }
          : undefined,
    }
  })

  return { rounds: juryRounds, settled }
}

/**
 * The read itself, so the hook below and the badges' `useDisputeJurors`
 * share one cache entry per dispute and round selection.
 */
const juryQuery = (
  provider: ethers.providers.Provider | undefined,
  chainId: number | null | undefined,
  arbitrator: string | null | undefined,
  disputeID: string | null | undefined,
  appeals: number[] | undefined,
  enabled: boolean,
) => ({
  queryKey: [
    'disputeJury',
    chainId,
    arbitrator?.toLowerCase(),
    disputeID,
    appeals,
  ],
  queryFn: () => fetchDisputeJury(provider!, arbitrator!, disputeID!, appeals),
  enabled:
    enabled &&
    !!chainId &&
    !!arbitrator &&
    isKlerosArbitrator(chainId, arbitrator) &&
    !!provider &&
    disputeID !== undefined &&
    disputeID !== null,
  // A vote lands in minutes, not seconds; the timeline refreshes at the
  // same pace, so the two never disagree by more than one period. A ruled
  // case's jury no longer changes, so it is not read again.
  staleTime: 60_000,
  refetchInterval: (query: { state: { data?: DisputeJury } }) =>
    query.state.data?.settled ? false : 120_000,
  retry: 1,
})

/**
 * The dispute's jury, or undefined while loading, when the arbitrator is
 * not Kleros, or when the read failed: the panel then shows nothing extra,
 * never an error. It is depth, not the page's information.
 */
const useDisputeJury = ({
  chainId,
  arbitrator,
  disputeID,
  appeals,
  enabled = true,
}: {
  chainId?: number | null
  arbitrator?: string | null
  disputeID?: string | null
  /** Read exactly these rounds (0 for the first) instead of the latest two. */
  appeals?: number[]
  enabled?: boolean
}) => {
  const provider = useEthersProvider({ chainId: chainId ?? undefined })
  return useQuery(
    juryQuery(provider, chainId, arbitrator, disputeID, appeals, enabled),
  )
}

/**
 * The addresses the court drew as jurors on these disputes, lowercased, for
 * the badge on a piece of evidence. A dispute that was never appealed is
 * the same read its jury band makes, so the history shares that cache
 * entry; a band tabbing through an appealed dispute's rounds asks for its
 * one round separately. An address missing from the set gets no badge
 * rather than a wrong one.
 */
export const useDisputeJurors = ({
  chainId,
  arbitrator,
  disputeIDs,
}: {
  chainId?: number | null
  arbitrator?: string | null
  disputeIDs: (string | null | undefined)[]
}): Set<string> => {
  const provider = useEthersProvider({ chainId: chainId ?? undefined })
  // Every id the caller gave is a case: the caller knows which requests or
  // challenges have one, and the arbitrator numbers its first dispute 0, so
  // the number itself says nothing about whether there is a case to read.
  const ids = disputeIDs
    .filter((id): id is string => !!id)
    .slice(0, MAX_DISPUTES)
  const results = useQueries({
    queries: ids.map((id) =>
      juryQuery(provider, chainId, arbitrator, id, undefined, true),
    ),
  })
  const stamp = results
    .map((result, index) => `${ids[index]}:${result.dataUpdatedAt}`)
    .join(',')
  return useMemo(
    () =>
      new Set(
        results.flatMap((result) =>
          (result.data?.rounds ?? []).flatMap((round) =>
            round.jurors.map((juror) => juror.address.toLowerCase()),
          ),
        ),
      ),
    // The addresses change only when one of the reads does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stamp],
  )
}

export default useDisputeJury
