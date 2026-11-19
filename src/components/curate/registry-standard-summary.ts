import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { gql } from 'graphql-request'
import { STALE_TIME } from 'consts'
import { useGraphqlBatcher } from 'contexts/graphql-batcher'
import { CONTRACT_STATUS, SUBGRAPH_RULING } from 'utils/item-status'

/*
 * What the Standard registry page's challenge figures are drawn from: every
 * challenge raised on the list, by what it did to the entry. A Standard entry
 * lives through requests, so the figures come from the challenges themselves
 * rather than from the per-list counters (DESIGN.md, Data rules: those
 * drift). The read is one page of the newest challenges, so at the cap every
 * figure is a lower bound and the page says what it was counted from.
 */

/** Challenges read in one page; the tally reads "n+" at this many. */
export const CHALLENGE_CAP = 1000

const STANDARD_SUMMARY_QUERY = gql`
  query standardRegistrySummary($registryId: String!, $challenges: Int!) {
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

interface RawChallenge {
  requestType: string
  resolved: boolean
  disputeOutcome?: string | null
}

export interface StandardSummary {
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

const isRemoval = (requestType: string) =>
  requestType === CONTRACT_STATUS.REMOVAL_REQUESTED

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
 * The Standard registry page's challenge figures. `summary` is undefined
 * while the read is in flight and when it failed, so the page shows nothing
 * rather than a figure it cannot stand behind.
 */
export const useStandardSummary = ({
  chainId,
  registryId,
}: {
  chainId?: number | null
  registryId?: string
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
        variables: { registryId: registry, challenges: CHALLENGE_CAP },
        chainId,
      })
      // The batcher resolves a failed request to an empty object: no
      // challenges field at all is a failed read, not a list without
      // challenges.
      return (data?.challenges as RawChallenge[] | undefined) ?? null
    },
    enabled: !!chainId && !!registry,
    staleTime: STALE_TIME,
  })
  const data = query.data
  const summary = useMemo(
    (): StandardSummary | undefined =>
      data ? { challenges: tallyChallenges(data) } : undefined,
    [data],
  )
  return {
    summary,
    loading: query.isLoading,
    failed: query.isError || data === null,
  }
}

export default useStandardSummary
