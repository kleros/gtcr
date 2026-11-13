import { useQuery } from '@tanstack/react-query'
import { useDebounce } from 'use-debounce'
import { request } from 'utils/indexer-request'
import { subgraphUrl, subgraphUrlPermanent } from 'config/tcr-addresses'

/*
 * An entry already on the list under the same first identifier (the value
 * the indexers keep as key0: a token's or a list's address). Most lists'
 * policies reject a duplicate, so its deposit would likely go to a
 * challenger, and nothing else stops it: a Light entry is named by where
 * its data is stored, which a new upload changes, and a Stake entry the
 * same way. (A Classic entry is named by its data, and the contract refuses
 * an identical one before anything is sent.)
 */

export interface DuplicateEntry {
  itemID: string
  /** The entry's status in the indexer's words. */
  status: string
}

export type DuplicateCheck = {
  kind: 'light' | 'stake'
  tcrAddress: string
}

const LIGHT_DUPLICATE = `
  query SubmitDuplicateLight($where: LItem_bool_exp!) {
    duplicates: LItem(limit: 3, where: $where) {
      itemID
      status
      key0
    }
  }
`

const STAKE_DUPLICATE = `
  query SubmitDuplicateStake($registry: String!, $value: String!) {
    duplicates: items(
      first: 3
      where: {
        registry: $registry
        status_in: [Submitted, Reincluded, Disputed]
        metadata_: { key0_contains_nocase: $value }
      }
    ) {
      itemID
      status
      metadata {
        key0
      }
    }
  }
`

/** Statuses of a Light or Classic entry that is on the list or on its way. */
const LIGHT_LIVE = ['Registered', 'RegistrationRequested', 'ClearingRequested']

// ILIKE reads % and _ as wildcards: escaped, the value only matches itself.
const exactLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`)

export const useDuplicateEntry = ({
  check,
  chainId,
  value,
}: {
  check?: DuplicateCheck
  chainId?: number
  value?: string
}): DuplicateEntry | undefined => {
  const [typed] = useDebounce((value ?? '').trim(), 600)
  const url = chainId
    ? check?.kind === 'stake'
      ? subgraphUrlPermanent[chainId]
      : subgraphUrl[chainId]
    : undefined
  const enabled = !!check && !!url && typed.length >= 3
  const { data } = useQuery({
    queryKey: [
      'submitDuplicate',
      check?.kind,
      chainId,
      check?.tcrAddress.toLowerCase(),
      typed.toLowerCase(),
    ],
    enabled,
    staleTime: 30_000,
    queryFn: async ({ signal }): Promise<DuplicateEntry | null> => {
      const registry = check!.tcrAddress.toLowerCase()
      if (check!.kind === 'light') {
        const result = await request<{ duplicates: DuplicateEntry[] }>({
          url: url!,
          document: LIGHT_DUPLICATE,
          variables: {
            where: {
              registry_id: { _eq: registry },
              status: { _in: LIGHT_LIVE },
              key0: { _ilike: exactLike(typed) },
            },
          },
          signal,
        })
        return result.duplicates[0] ?? null
      }
      const result = await request<{
        duplicates: (DuplicateEntry & { metadata?: { key0?: string } })[]
      }>({
        url: url!,
        document: STAKE_DUPLICATE,
        variables: { registry, value: typed },
        signal,
      })
      // "contains" is the closest the subgraph has to equal, ignoring case.
      return (
        result.duplicates.find(
          (entry) =>
            entry.metadata?.key0?.toLowerCase() === typed.toLowerCase(),
        ) ?? null
      )
    },
  })
  return enabled && data ? data : undefined
}
