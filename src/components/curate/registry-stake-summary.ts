import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { gql } from 'graphql-request'
import { BigNumber } from 'ethers'
import { STALE_TIME } from 'consts'
import { useGraphqlBatcher } from 'contexts/graphql-batcher'
import { stakeEntryStatus } from './entry-status'
import type { StatusTone } from './primitives'
import type { V2Field } from './v2'

/*
 * Stake Curate registry summary: every entry of one list with only what the
 * page's drawings need (status, stake, each listing's start and end, each
 * challenge's start, end and effect). The subgraph's per-list counters drift
 * (one list reports -2 submitted, 2 absent and 2 disputed for two removed
 * entries), so the page counts the entries themselves when it has them all.
 */

/** The Graph's largest page; a list at this size may have more entries. */
export const SUMMARY_CAP = 1000

const STAKE_SUMMARY_QUERY = gql`
  query stakeRegistrySummary($registry: String!, $first: Int!) {
    items(
      first: $first
      where: { registry: $registry }
      orderBy: includedAt
      orderDirection: desc
    ) {
      itemID
      status
      stake
      includedAt
      createdAt
      withdrawingTimestamp
      metadata {
        props {
          label
          value
          type
          isIdentifier
        }
      }
      submissions(first: 1, orderBy: createdAt, orderDirection: desc) {
        withdrawingTx
      }
      listings: submissions(
        first: 100
        orderBy: createdAt
        orderDirection: asc
      ) {
        createdAt
        finishedAt
      }
      challenges(first: 1, orderBy: createdAt, orderDirection: desc) {
        createdAt
        resolutionTime
        disputeOutcome
        rounds(first: 1, orderBy: creationTime, orderDirection: desc) {
          appealPeriodStart
          appealPeriodEnd
          ruling
          rulingTime
          hasPaidRequester
          hasPaidChallenger
        }
      }
      history: challenges(first: 100, orderBy: createdAt, orderDirection: asc) {
        createdAt
        resolutionTime
      }
    }
  }
`

interface SummaryItem extends SubgraphItem {
  itemID: string
  status: string
  stake?: string
  includedAt?: string
  withdrawingTimestamp?: string
  metadata?: { props?: V2Field[] } | null
  listings?: { createdAt: string; finishedAt?: string | null }[]
  history?: { createdAt: string; resolutionTime?: string | null }[]
}

export type ListingEnd = 'removed' | 'withdrawn'

export interface StakeListing {
  start: number
  /** Unix seconds; undefined while the entry is still listed. */
  end?: number
  endedBy?: ListingEnd
}

export interface StakeChallenge {
  start: number
  /** Unix seconds; undefined while the dispute is open. */
  end?: number
  /** The ruling ended the listing it was raised against. */
  removed: boolean
}

export interface StakeLane {
  id: string
  name?: string
  /** The status the list rows show, which colours the open listing. */
  tone?: StatusTone
  statusCode?: number
  statusLabel?: string
  listings: StakeListing[]
  challenges: StakeChallenge[]
}

export type StakeBucket = 'listed' | 'disputed' | 'absent'

export interface StakeSummary {
  /** Entries in the list (all of them unless `partial`). */
  total: number
  /** The list reached SUMMARY_CAP, so counts are a lower bound. */
  partial: boolean
  /** By subgraph status: Submitted or Reincluded, Disputed, Absent. */
  buckets: Record<StakeBucket, number>
  /** Entries per status tone, as the list rows label them. */
  tones: Record<StatusTone, number>
  /** False until the chain clock and the registry periods are known. */
  tonesReady: boolean
  /** Stake locked by entries still on the list (listed or disputed), in token units. */
  locked: BigNumber
  challenges: { total: number; removed: number; kept: number; open: number }
  lanes: StakeLane[]
}

const num = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

const isTextType = (type?: string) =>
  !type || ['text', 'long text', 'address', 'rich address'].includes(type)

const isNamingType = (type?: string) =>
  !type || !['image', 'file', 'boolean', 'link'].includes(type)

/**
 * The entry's name, as the table's first column shows it: its first
 * identifying field (a bare number keeps its label, "Agent number 1143"),
 * else its first text field.
 */
const entryName = (item: SummaryItem): string | undefined => {
  const props = (item.metadata?.props ?? []).filter(
    (prop) =>
      prop.value !== undefined &&
      prop.value !== null &&
      typeof prop.value !== 'object' &&
      String(prop.value).trim() !== '',
  )
  const pick =
    props.find(
      (prop) => prop.isIdentifier && isNamingType(prop.type?.toLowerCase()),
    ) ?? props.find((prop) => isTextType(prop.type?.toLowerCase()))
  if (!pick) return undefined
  const value = String(pick.value).trim()
  return /^\d+$/.test(value) && pick.label ? `${pick.label} ${value}` : value
}

const bucketOf = (status: string): StakeBucket =>
  status === 'Disputed'
    ? 'disputed'
    : status === 'Submitted' || status === 'Reincluded'
      ? 'listed'
      : 'absent'

const emptyTones = (): Record<StatusTone, number> => ({
  registered: 0,
  window: 0,
  contested: 0,
  neutral: 0,
  off: 0,
})

const summarize = (
  items: SummaryItem[],
  timestamp: BigNumber | null | undefined,
  registry: SubgraphRegistry | undefined,
): StakeSummary => {
  const buckets: Record<StakeBucket, number> = {
    listed: 0,
    disputed: 0,
    absent: 0,
  }
  const tones = emptyTones()
  const challenges = { total: 0, removed: 0, kept: 0, open: 0 }
  let locked = BigNumber.from(0)

  const lanes = items.map((item): StakeLane => {
    const bucket = bucketOf(item.status)
    buckets[bucket] += 1
    if (bucket !== 'absent' && item.stake)
      locked = locked.add(BigNumber.from(item.stake))

    const status = stakeEntryStatus(item, timestamp, registry)
    if (status) tones[status.tone] += 1
    else if (bucket === 'absent') tones.off += 1

    // A listing ends either with a ruling (the dispute resolves in the same
    // transaction) or with a withdrawal: the only two ways back to Absent.
    const resolutions = new Set(
      (item.history ?? [])
        .map((challenge) => num(challenge.resolutionTime))
        .filter((time) => time > 0),
    )
    const listings = (item.listings ?? [])
      .map((listing): StakeListing => {
        const start = num(listing.createdAt)
        const end = num(listing.finishedAt) || undefined
        return {
          start,
          end,
          endedBy:
            end === undefined
              ? undefined
              : resolutions.has(end)
                ? 'removed'
                : 'withdrawn',
        }
      })
      .filter((listing) => listing.start > 0)
    const ends = new Set(
      listings.map((listing) => listing.end).filter(Boolean) as number[],
    )
    const laneChallenges = (item.history ?? [])
      .map((challenge): StakeChallenge => {
        const end = num(challenge.resolutionTime) || undefined
        return {
          start: num(challenge.createdAt),
          end,
          removed: end !== undefined && ends.has(end),
        }
      })
      .filter((challenge) => challenge.start > 0)
    laneChallenges.forEach((challenge) => {
      challenges.total += 1
      if (challenge.end === undefined) challenges.open += 1
      else if (challenge.removed) challenges.removed += 1
      else challenges.kept += 1
    })

    // Older entries may predate the submission history; their inclusion
    // time stands in for the one listing they have.
    if (listings.length === 0 && num(item.includedAt) > 0)
      listings.push({ start: num(item.includedAt) })

    return {
      id: item.itemID,
      name: entryName(item),
      tone: status?.tone ?? (bucket === 'absent' ? 'off' : undefined),
      statusCode: status?.code,
      statusLabel: status?.label,
      listings,
      challenges: laneChallenges,
    }
  })

  return {
    total: items.length,
    partial: items.length >= SUMMARY_CAP,
    buckets,
    tones,
    tonesReady: !!timestamp && !!registry,
    locked,
    challenges,
    lanes,
  }
}

/**
 * Every entry of a Stake Curate list, summarized. `summary` is undefined
 * while loading and when the indexer fails (the batcher resolves a failed
 * request to an empty object).
 */
export const useStakeSummary = ({
  chainId,
  registryId,
  registry,
  timestamp,
}: {
  chainId?: number | null
  registryId?: string
  registry?: SubgraphRegistry
  timestamp?: BigNumber | null
}) => {
  const { graphqlBatcher } = useGraphqlBatcher()
  const query = useQuery({
    queryKey: ['permanentRegistrySummary', chainId, registryId],
    queryFn: async () => {
      const data = await graphqlBatcher.fetch({
        id: crypto.randomUUID(),
        document: STAKE_SUMMARY_QUERY,
        variables: { registry: registryId, first: SUMMARY_CAP },
        chainId: chainId!,
        isPermanent: true,
      })
      return (data?.items as SummaryItem[] | undefined) ?? null
    },
    enabled: !!chainId && !!registryId,
    staleTime: STALE_TIME,
  })
  const items = query.data
  const summary = useMemo(
    () => (items ? summarize(items, timestamp, registry) : undefined),
    [items, timestamp, registry],
  )
  return {
    summary,
    loading: query.isLoading,
    failed: query.isError || items === null,
  }
}

export default useStakeSummary
