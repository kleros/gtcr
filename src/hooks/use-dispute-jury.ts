import { useQuery } from '@tanstack/react-query'
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

/** A round larger than this is not read: it would be one call per seat. */
const MAX_SLOTS = 64
/** The rounds worth showing: the live one and the one appealed from. */
const MAX_ROUNDS = 2

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
}

export const fetchDisputeJury = async (
  provider: ethers.providers.Provider,
  arbitrator: string,
  disputeID: string,
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

  // The latest rounds, newest first, skipping any too large to read seat by
  // seat (a General court round can seat dozens).
  const wanted = votesLengths
    .map((slots, appeal) => ({ appeal, slots }))
    .slice(-MAX_ROUNDS)
    .filter((round) => round.slots > 0 && round.slots <= MAX_SLOTS)
    .reverse()
  if (wanted.length === 0) return { rounds: [] }

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

    // One row per juror, in the order they were first drawn.
    const jurors: JuryJuror[] = []
    const byAddress = new Map<string, JuryJuror>()
    seats.forEach((seat, voteID) => {
      const account = String(seat.account)
      if (account === ethers.constants.AddressZero) return
      const existing = byAddress.get(account.toLowerCase())
      if (existing) {
        existing.voteIDs.push(voteID)
        return
      }
      const commit = String(seat.commit)
      const voted = Boolean(seat.voted)
      const juror: JuryJuror = {
        address: account,
        voteIDs: [voteID],
        state: voted
          ? 'revealed'
          : commit === NO_COMMIT
            ? 'pending'
            : 'committed',
        choice: voted
          ? (seat.choice as ethers.BigNumber).toNumber()
          : undefined,
        commit: commit === NO_COMMIT ? undefined : commit,
      }
      byAddress.set(account.toLowerCase(), juror)
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

  return { rounds: juryRounds }
}

/**
 * The dispute's jury, or undefined while loading, when the arbitrator is
 * not Kleros, or when the read failed: the panel then shows nothing extra,
 * never an error. It is depth, not the page's information.
 */
const useDisputeJury = ({
  chainId,
  arbitrator,
  disputeID,
  enabled = true,
}: {
  chainId?: number | null
  arbitrator?: string | null
  disputeID?: string | null
  enabled?: boolean
}) => {
  const provider = useEthersProvider({ chainId: chainId ?? undefined })
  const isKleros =
    !!chainId && !!arbitrator && isKlerosArbitrator(chainId, arbitrator)
  return useQuery({
    queryKey: ['disputeJury', chainId, arbitrator?.toLowerCase(), disputeID],
    queryFn: () => fetchDisputeJury(provider!, arbitrator!, disputeID!),
    enabled:
      enabled &&
      isKleros &&
      !!provider &&
      disputeID !== undefined &&
      disputeID !== null,
    // A vote lands in minutes, not seconds; the timeline refreshes at the
    // same pace, so the two never disagree by more than one period.
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  })
}

export default useDisputeJury
