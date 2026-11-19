import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { gql } from 'graphql-request'
import { BigNumber } from 'ethers'
import { STALE_TIME } from 'consts'
import { useGraphqlBatcher } from 'contexts/graphql-batcher'

/*
 * Stake Curate registry summary: every entry of one list with only what the
 * page's figures need — its status, its stake, and each listing and challenge
 * with the dates that say what the challenge did to the entry. The subgraph's
 * per-list counters drift (one list reports -2 submitted, 2 absent and 2
 * disputed for two removed entries), so the page counts the entries
 * themselves when it has them all.
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
      status
      stake
      listings: submissions(
        first: 100
        orderBy: createdAt
        orderDirection: asc
      ) {
        createdAt
        finishedAt
      }
      history: challenges(first: 100, orderBy: createdAt, orderDirection: asc) {
        createdAt
        resolutionTime
        disputeOutcome
      }
    }
  }
`

interface SummaryItem {
  status: string
  stake?: string
  listings?: { createdAt: string; finishedAt?: string | null }[]
  history?: {
    createdAt: string
    resolutionTime?: string | null
    disputeOutcome?: string | null
  }[]
}

export type StakeBucket = 'listed' | 'disputed' | 'absent'

export interface StakeSummary {
  /** Entries in the list (all of them unless `partial`). */
  total: number
  /** The list reached SUMMARY_CAP, so counts are a lower bound. */
  partial: boolean
  /** By subgraph status: Submitted or Reincluded, Disputed, Absent. */
  buckets: Record<StakeBucket, number>
  /** Stake locked by entries still on the list (listed or disputed), in token units. */
  locked: BigNumber
  challenges: { total: number; removed: number; kept: number; open: number }
}

const num = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

const bucketOf = (status: string): StakeBucket =>
  status === 'Disputed'
    ? 'disputed'
    : status === 'Submitted' || status === 'Reincluded'
      ? 'listed'
      : 'absent'

const summarize = (items: SummaryItem[]): StakeSummary => {
  const buckets: Record<StakeBucket, number> = {
    listed: 0,
    disputed: 0,
    absent: 0,
  }
  const challenges = { total: 0, removed: 0, kept: 0, open: 0 }
  let locked = BigNumber.from(0)

  items.forEach((item) => {
    const bucket = bucketOf(item.status)
    buckets[bucket] += 1
    if (bucket !== 'absent' && item.stake)
      locked = locked.add(BigNumber.from(item.stake))

    // A listing ends either with a ruling (the dispute resolves in the same
    // transaction) or with a withdrawal: the only two ways back to Absent.
    // A ruling that keeps the entry ends its listing only when a withdrawal
    // was pending, and then it is that withdrawal that ends it. So a
    // challenge removed the entry when a listing of its own ended at the
    // moment that challenge resolved.
    const removals = new Set(
      (item.history ?? [])
        .filter((challenge) => challenge.disputeOutcome !== 'Accept')
        .map((challenge) => num(challenge.resolutionTime))
        .filter((time) => time > 0),
    )
    const removedAt = new Set(
      (item.listings ?? [])
        .filter((listing) => num(listing.createdAt) > 0)
        .map((listing) => num(listing.finishedAt))
        .filter((end) => end > 0 && removals.has(end)),
    )
    ;(item.history ?? []).forEach((challenge) => {
      if (num(challenge.createdAt) <= 0) return
      challenges.total += 1
      const end = num(challenge.resolutionTime) || undefined
      if (end === undefined) challenges.open += 1
      else if (removedAt.has(end)) challenges.removed += 1
      else challenges.kept += 1
    })
  })

  return {
    total: items.length,
    partial: items.length >= SUMMARY_CAP,
    buckets,
    locked,
    challenges,
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
}: {
  chainId?: number | null
  registryId?: string
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
  const summary = useMemo(() => (items ? summarize(items) : undefined), [items])
  return {
    summary,
    loading: query.isLoading,
    failed: query.isError || items === null,
  }
}

export default useStakeSummary
