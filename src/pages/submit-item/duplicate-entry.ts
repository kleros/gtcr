import { useQuery } from '@tanstack/react-query'
import { useDebounce } from 'use-debounce'
import { request } from 'utils/indexer-request'
import { subgraphUrl, subgraphUrlPermanent } from 'config/tcr-addresses'

/*
 * An entry already on the list under the same identifiers. The indexers
 * keep a list's identifier columns, in their order, as key0…key4 (key0: a
 * token's or a list's address). Most lists' policies reject a duplicate, so
 * its deposit would likely go to a challenger, and nothing else stops it: a
 * Light entry is named by where its data is stored, which a new upload
 * changes, and a Stake entry the same way. (A Classic entry is named by its
 * data, and the contract refuses an identical one before anything is sent.)
 *
 * Entries are looked up by the first identifier; the others are compared
 * here. A list with several identifiers can hold the same first one more
 * than once (one contract under several domains): only an entry that
 * matches on every identifier is a duplicate.
 */

export interface DuplicateEntry {
  itemID: string
  /** The entry's status in the indexer's words. */
  status: string
  /** It matches on every identifier, not only the first. */
  allMatch: boolean
}

export type DuplicateCheck = {
  kind: 'light' | 'stake'
  tcrAddress: string
}

type Keys = Partial<Record<`key${number}`, string | null>>

interface Found {
  itemID: string
  status: string
  keys: Keys
}

/** The identifiers the indexers keep: key0 to key4. */
const MAX_KEYS = 5

const LIGHT_KEYS = `
      itemID
      status
      key0
      key1
      key2
      key3
      key4
`

const LIGHT_DUPLICATE = `
  query SubmitDuplicateLight($where: LItem_bool_exp!) {
    duplicates: LItem(limit: 3, where: $where) {${LIGHT_KEYS}    }
  }
`

/*
 * The same, plus the entry that matches on every identifier, asked in the
 * same request: a list can hold its first identifier hundreds of times (one
 * contract under many domains), so the three rows above rarely hold it.
 */
const LIGHT_DUPLICATE_FULL = `
  query SubmitDuplicateLightFull(
    $where: LItem_bool_exp!
    $whereAll: LItem_bool_exp!
  ) {
    duplicates: LItem(limit: 3, where: $where) {${LIGHT_KEYS}    }
    full: LItem(limit: 1, where: $whereAll) {${LIGHT_KEYS}    }
  }
`

const STAKE_FIELDS = `
      itemID
      status
      metadata {
        key0
        key1
        key2
        key3
        key4
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
    ) {${STAKE_FIELDS}    }
  }
`

/** As LIGHT_DUPLICATE_FULL: the entry matching every identifier too. */
const STAKE_DUPLICATE_FULL = `
  query SubmitDuplicateStakeFull(
    $registry: String!
    $value: String!
    $metadataAll: ItemMetadata_filter!
  ) {
    duplicates: items(
      first: 3
      where: {
        registry: $registry
        status_in: [Submitted, Reincluded, Disputed]
        metadata_: { key0_contains_nocase: $value }
      }
    ) {${STAKE_FIELDS}    }
    full: items(
      first: 3
      where: {
        registry: $registry
        status_in: [Submitted, Reincluded, Disputed]
        metadata_: $metadataAll
      }
    ) {${STAKE_FIELDS}    }
  }
`

/** Statuses of a Light or Classic entry that is on the list or on its way. */
const LIGHT_LIVE = ['Registered', 'RegistrationRequested', 'ClearingRequested']

// ILIKE reads % and _ as wildcards: escaped, the value only matches itself.
const exactLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`)

/** Same text, ignoring case and surrounding spaces, as the lookup does. */
const sameKey = (stored: string | null | undefined, typed: string) =>
  (stored ?? '').trim().toLowerCase() === typed.trim().toLowerCase()

/**
 * Of the entries found by the first identifier, the one to name: one that
 * also matches every other identifier (`others`, key1 on) if there is one.
 * Past key4, or with a value that cannot be compared, a match on every
 * identifier cannot be told, and none is claimed.
 */
export const pickDuplicate = (
  found: Found[],
  others: (string | null)[],
): DuplicateEntry | undefined => {
  if (found.length === 0) return undefined
  const comparable =
    others.length < MAX_KEYS && others.every((value) => value !== null)
  const full = comparable
    ? found.find((entry) =>
        others.every((value, index) =>
          sameKey(entry.keys[`key${index + 1}`], value as string),
        ),
      )
    : undefined
  const entry = full ?? found[0]
  return { itemID: entry.itemID, status: entry.status, allMatch: !!full }
}

export const useDuplicateEntry = ({
  check,
  chainId,
  values,
}: {
  check?: DuplicateCheck
  chainId?: number
  /**
   * The identifier columns' values, in the list's column order (the order
   * of key0…key4); null where a value cannot be compared (a file not yet
   * uploaded).
   */
  values: (string | null)[]
}): DuplicateEntry | undefined => {
  const [typed] = useDebounce((values[0] ?? '').trim(), 600)
  // The other identifiers, as text so an unchanged list is the same value.
  const [othersText] = useDebounce(
    JSON.stringify(values.slice(1).map((value) => value?.trim() ?? null)),
    600,
  )
  const url = chainId
    ? check?.kind === 'stake'
      ? subgraphUrlPermanent[chainId]
      : subgraphUrl[chainId]
    : undefined
  const enabled = !!check && !!url && typed.length >= 3
  const { data } = useQuery({
    queryKey: [
      'submitDuplicateKeys',
      check?.kind,
      chainId,
      check?.tcrAddress.toLowerCase(),
      typed.toLowerCase(),
      othersText.toLowerCase(),
    ],
    enabled,
    staleTime: 30_000,
    queryFn: async ({ signal }): Promise<Found[]> => {
      const registry = check!.tcrAddress.toLowerCase()
      // The other identifiers, when each can be compared: the entry that
      // matches them all is asked for by name, not hoped for among the rows
      // sharing the first one.
      const others = JSON.parse(othersText) as (string | null)[]
      const comparable =
        others.length > 0 &&
        others.length < MAX_KEYS &&
        others.every((value) => value !== null)
      const fullFirst = (full: Found[], rest: Found[]): Found[] => [
        ...full,
        ...rest.filter((entry) => !full.some((f) => f.itemID === entry.itemID)),
      ]
      if (check!.kind === 'light') {
        type Row = Keys & { itemID: string; status: string }
        const where = {
          registry_id: { _eq: registry },
          status: { _in: LIGHT_LIVE },
          key0: { _ilike: exactLike(typed) },
        }
        // An empty identifier is stored as empty or not at all.
        const keyIs = (value: string) =>
          value ? { _ilike: exactLike(value) } : { _in: [''] as string[] }
        const result = await request<{ duplicates: Row[]; full?: Row[] }>({
          url: url!,
          document: comparable ? LIGHT_DUPLICATE_FULL : LIGHT_DUPLICATE,
          variables: comparable
            ? {
                where,
                whereAll: {
                  ...where,
                  _and: others.map((value, index) =>
                    value
                      ? { [`key${index + 1}`]: keyIs(value) }
                      : {
                          _or: [
                            { [`key${index + 1}`]: keyIs('') },
                            { [`key${index + 1}`]: { _is_null: true } },
                          ],
                        },
                  ),
                },
              }
            : { where },
          signal,
        })
        const found = ({ itemID, status, ...keys }: Row): Found => ({
          itemID,
          status,
          keys,
        })
        return fullFirst(
          (result.full ?? []).map(found),
          result.duplicates.map(found),
        )
      }
      type StakeRow = { itemID: string; status: string; metadata?: Keys }
      const metadataAll = Object.fromEntries([
        ['key0_contains_nocase', typed],
        ...others.map((value, index) => [
          `key${index + 1}_contains_nocase`,
          value ?? '',
        ]),
      ])
      const result = await request<{
        duplicates: StakeRow[]
        full?: StakeRow[]
      }>({
        url: url!,
        document: comparable ? STAKE_DUPLICATE_FULL : STAKE_DUPLICATE,
        variables: comparable
          ? { registry, value: typed, metadataAll }
          : { registry, value: typed },
        signal,
      })
      // "contains" is the closest the subgraph has to equal, ignoring case.
      const found = ({ itemID, status, metadata }: StakeRow): Found => ({
        itemID,
        status,
        keys: metadata ?? {},
      })
      return fullFirst(
        (result.full ?? []).map(found),
        result.duplicates.map(found),
      ).filter((entry) => sameKey(entry.keys.key0, typed))
    },
  })
  return enabled && data
    ? pickDuplicate(data, JSON.parse(othersText) as (string | null)[])
    : undefined
}
