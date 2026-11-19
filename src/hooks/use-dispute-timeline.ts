import { useQuery } from '@tanstack/react-query'
import { ethers } from 'ethers'
import { useEthersProvider } from 'hooks/ethers-adapters'
import { isKlerosArbitrator } from 'config/tcr-addresses'
import type { CourtDispute } from 'components/curate/dispute-timeline-model'

/*
 * A Kleros Court dispute's period and timings, read from the arbitrator
 * (KlerosLiquid on Ethereum, Gnosis and Sepolia) in one multicall: the
 * dispute, its court's period lengths and hidden-votes flag, and its rounds.
 * Only for disputes Kleros arbitrates; anything else reads nothing.
 */

const KLEROS_LIQUID_ABI = [
  'function disputes(uint256) view returns (uint96 subcourtID, address arbitrated, uint256 numberOfChoices, uint8 period, uint256 lastPeriodChange, uint256 drawsInRound, uint256 commitsInRound, bool ruled)',
  'function getSubcourt(uint96) view returns (uint256[] children, uint256[4] timesPerPeriod)',
  'function courts(uint256) view returns (uint96 parent, bool hiddenVotes, uint256 minStake, uint256 alpha, uint256 feeForJuror, uint256 jurorsForCourtJump)',
  'function getDispute(uint256) view returns (uint256[] votesLengths, uint256[] tokensAtStakePerJuror, uint256[] totalFeesForJurors, uint256[] votesInEachRound, uint256[] repartitionsInEachRound, uint256[] penaltiesInEachRound)',
]
const kleros = new ethers.utils.Interface(KLEROS_LIQUID_ABI)

/** Multicall3, deployed at the same address on Ethereum, Gnosis and Sepolia. */
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11'
const multicall = new ethers.utils.Interface([
  'function aggregate((address target, bytes callData)[] calls) view returns (uint256 blockNumber, bytes[] returnData)',
])

/**
 * Several reads of one contract in a single eth_call (Multicall3), decoded
 * in the order they were asked for. Shared with the jury read, which asks
 * the same arbitrator for one call per vote.
 */
export const aggregateCalls = async (
  provider: ethers.providers.Provider,
  target: string,
  iface: ethers.utils.Interface,
  calls: [string, unknown[]][],
): Promise<ethers.utils.Result[]> => {
  const data = multicall.encodeFunctionData('aggregate', [
    calls.map(([name, args]) => ({
      target,
      callData: iface.encodeFunctionData(name, args),
    })),
  ])
  const raw = await provider.call({ to: MULTICALL3, data })
  const [, results] = multicall.decodeFunctionResult('aggregate', raw)
  return (results as string[]).map((result, index) =>
    iface.decodeFunctionResult(calls[index][0], result),
  )
}

const call = (
  provider: ethers.providers.Provider,
  arbitrator: string,
  calls: [string, unknown[]][],
): Promise<ethers.utils.Result[]> =>
  aggregateCalls(provider, arbitrator, kleros, calls)

const last = (values: ethers.BigNumber[]): number =>
  values.length > 0 ? values[values.length - 1].toNumber() : 0

export const fetchCourtDispute = async (
  provider: ethers.providers.Provider,
  arbitrator: string,
  disputeID: string,
  arbitrable?: string | null,
): Promise<CourtDispute> => {
  const [dispute, rounds] = await call(provider, arbitrator, [
    ['disputes', [disputeID]],
    ['getDispute', [disputeID]],
  ])
  // xKlerosLiquid keeps disputes in a mapping: an unknown ID reads as zeros
  // rather than reverting. Neither it nor another list's case is this one.
  const arbitrated = String(dispute.arbitrated).toLowerCase()
  if (
    arbitrated === ethers.constants.AddressZero ||
    (rounds.votesLengths as ethers.BigNumber[]).length === 0
  )
    throw new Error(`No dispute ${disputeID} on this arbitrator`)
  if (arbitrable && arbitrated !== arbitrable.toLowerCase())
    throw new Error(`Dispute ${disputeID} belongs to another contract`)
  const court = dispute.subcourtID as ethers.BigNumber
  const [subcourt, settings] = await call(provider, arbitrator, [
    ['getSubcourt', [court]],
    ['courts', [court]],
  ])
  const times = (subcourt.timesPerPeriod as ethers.BigNumber[]).map((t) =>
    t.toNumber(),
  ) as CourtDispute['times']
  const votesLengths = rounds.votesLengths as ethers.BigNumber[]
  return {
    disputeID,
    court: court.toNumber(),
    period: Number(dispute.period),
    periodStart: (dispute.lastPeriodChange as ethers.BigNumber).toNumber(),
    times,
    hiddenVotes: Boolean(settings.hiddenVotes),
    round: Math.max(1, votesLengths.length),
    // Every round's size, not only the live one's: the jury band tabs
    // through the rounds and this read already decoded them all.
    roundSlots: votesLengths.map((v) => v.toNumber()),
    jurors: last(votesLengths),
    drawn: (dispute.drawsInRound as ethers.BigNumber).toNumber(),
    committed: (dispute.commitsInRound as ethers.BigNumber).toNumber(),
    voted: last(rounds.votesInEachRound as ethers.BigNumber[]),
    ruled: Boolean(dispute.ruled),
    // KlerosLiquid.appealCost is unpayable from the General court (0) once a
    // round has jurorsForCourtJump jurors: there is nowhere higher to go.
    appealable: !(
      court.isZero() &&
      last(votesLengths) >=
        (settings.jurorsForCourtJump as ethers.BigNumber).toNumber()
    ),
  }
}

/**
 * The dispute's court timings, or undefined while loading, when the
 * arbitrator is not Kleros, or when the read failed (the card then hides:
 * it is extra information, never the only way to see the case).
 */
const useDisputeTimeline = ({
  chainId,
  arbitrator,
  disputeID,
  arbitrable,
  enabled = true,
}: {
  chainId?: number | null
  arbitrator?: string | null
  disputeID?: string | null
  /** The list the case must belong to (its contract address). */
  arbitrable?: string | null
  enabled?: boolean
}) => {
  const provider = useEthersProvider({ chainId: chainId ?? undefined })
  const kleros =
    !!chainId && !!arbitrator && isKlerosArbitrator(chainId, arbitrator)
  return useQuery({
    queryKey: [
      'courtDispute',
      chainId,
      arbitrator?.toLowerCase(),
      disputeID,
      arbitrable?.toLowerCase(),
    ],
    queryFn: () =>
      fetchCourtDispute(provider!, arbitrator!, disputeID!, arbitrable),
    enabled:
      enabled &&
      kleros &&
      !!provider &&
      disputeID !== undefined &&
      disputeID !== null,
    // Periods last hours to days; a refresh every two minutes catches a
    // period that moved on (or an appeal that started a round) soon enough.
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  })
}

export default useDisputeTimeline
