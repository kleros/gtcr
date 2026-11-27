import { describe, expect, it } from 'vitest'
import type { DashboardRegistry } from 'pages/dashboard/types'
import {
  ENTRIES_PER_LIST,
  groupHits,
  matchLists,
  repeatedTitles,
  stakeHits,
  stakeSearchWhere,
  standardHit,
  standardHitStatus,
  standardSearchWhere,
  termAddress,
  type RawStandardHit,
} from './site-search-data'

const TAGS = '0x66260c69d03837016d88c9877e61e08ef74c59f2'
const TOKENS = '0xee1502e29795ef6c2d60f8d7120596abe3bad990'

const raw = (
  registry: string,
  itemID: string,
  overrides: Partial<RawStandardHit> = {},
): RawStandardHit => ({
  itemID,
  status: 'Registered',
  disputed: false,
  chainId: 100,
  registry_id: registry,
  props: [
    {
      label: 'Contract Address',
      value: 'eip155:8453:0x1e41238acd3a9ff90b0dcb9ea96cf45f104e09ef',
      isIdentifier: true,
      itemType: 'rich address',
    },
  ],
  ...overrides,
})

const registry = (
  overrides: Partial<DashboardRegistry>,
): DashboardRegistry => ({
  id: overrides.address ?? 'x',
  address: '0x0',
  chainId: 100,
  kind: 'standard',
  title: '',
  itemCount: 0,
  activeCount: 0,
  pendingCount: 0,
  disputeCount: 0,
  trustStatus: 'verified',
  ...overrides,
})

describe('search clauses', () => {
  it('matches identifying fields only, never keywords, wildcards escaped', () => {
    const where = standardSearchWhere('50%_off', [1, 100])
    expect(where.chainId).toEqual({ _in: [1, 100] })
    expect(where._or).toHaveLength(5)
    expect(where._or[0]).toEqual({ key0: { _ilike: '%50\\%\\_off%' } })
    expect(JSON.stringify(where)).not.toContain('keywords')
    expect(stakeSearchWhere('usdc').or[4]).toEqual({
      metadata_: { key4_contains_nocase: 'usdc' },
    })
  })
})

describe('hits', () => {
  it('names an entry from its fields and links to it', () => {
    const hit = standardHit(
      raw(TAGS.toUpperCase().replace('0X', '0x'), '0xabc'),
    )
    expect(hit.registry).toBe(TAGS)
    expect(hit.href).toBe(`/tcr/100/${TAGS}/0xabc`)
    expect(hit.name.address).toBe(true)
    expect(hit.name.network).toBe('Base Mainnet')
    expect(hit.status).toEqual({ tone: 'registered', label: 'Registered' })
  })

  it('reads statuses in the list pages’ words', () => {
    expect(standardHitStatus('RegistrationRequested', false).label).toBe(
      'Submitted',
    )
    expect(standardHitStatus('ClearingRequested', true).label).toBe(
      'Challenged',
    )
    expect(standardHitStatus('Absent', false).tone).toBe('off')
    expect(
      stakeHits(
        [{ itemID: '0x1', status: 'Disputed', registry: { id: TAGS } }],
        100,
      )[0].status.label,
    ).toBe('Disputed now')
  })

  it('falls back to a short id for an entry with no usable field', () => {
    expect(
      standardHit(raw(TAGS, '0x1234567890abcdef', { props: [] })).name.text,
    ).toBe('Entry 0x12345678…')
  })
})

describe('groupHits', () => {
  it('groups by list, busiest first, a few entries each', () => {
    const hits = [
      standardHit(raw(TOKENS, '0x1')),
      ...Array.from({ length: 6 }, (_, index) =>
        standardHit(raw(TAGS, `0x${index + 10}`)),
      ),
    ]
    const groups = groupHits(
      hits,
      new Map([[`100:${TAGS}`, { title: 'Address Tags', kind: 'standard' }]]),
      'usdc',
    )
    expect(groups.map((group) => group.title)).toEqual([
      'Address Tags',
      `List ${TOKENS.slice(0, 6)}…${TOKENS.slice(-4)}`,
    ])
    expect(groups[0].hits).toHaveLength(ENTRIES_PER_LIST)
    expect(groups[0].more).toBe(6 - ENTRIES_PER_LIST)
    expect(groups[0].href).toBe(`/tcr/100/${TAGS}?q=usdc`)
  })

  it('keeps the same address on two chains apart', () => {
    const groups = groupHits(
      [
        standardHit(raw(TAGS, '0x1', { chainId: 1 })),
        standardHit(raw(TAGS, '0x2', { chainId: 100 })),
      ],
      new Map(),
      'x',
    )
    expect(groups).toHaveLength(2)
  })
})

describe('matchLists', () => {
  const lists = [
    registry({ address: '0xa', title: 'Kleros Tokens', itemCount: 10 }),
    registry({ address: '0xb', title: 'Tokens of Gnosis', itemCount: 500 }),
    registry({ address: '0xc', title: 'Address Tags', itemCount: 20_000 }),
  ]

  it('puts names that start with the term first, then the busiest', () => {
    expect(matchLists(lists, 'tok').map((list) => list.address)).toEqual([
      '0xb',
      '0xa',
    ])
  })

  it('finds a list by its address, and nothing for a blank term', () => {
    expect(matchLists(lists, '0xC').map((list) => list.address)).toEqual([
      '0xc',
    ])
    expect(matchLists(lists, '  ')).toEqual([])
  })
})

describe('termAddress', () => {
  it('reads a plain or CAIP-10 EVM address, nothing else', () => {
    const address = '0x1e41238acd3a9ff90b0dcb9ea96cf45f104e09ef'
    expect(termAddress(` ${address} `)).toBe(address)
    expect(termAddress(`eip155:8453:${address}`)).toBe(address)
    expect(termAddress('usdc')).toBeUndefined()
    expect(termAddress('0x1234')).toBeUndefined()
  })
})

describe('repeatedTitles', () => {
  it('flags a name two different lists share, not one list shown twice', () => {
    expect(
      repeatedTitles([
        { title: 'Kleros Tokens', chainId: 100, address: '0xA' },
        { title: 'Kleros Tokens', chainId: 100, address: '0xa' },
        { title: 'Address Tags', chainId: 100, address: '0xb' },
        { title: 'Address Tags', chainId: 100, address: '0xc' },
      ]),
    ).toEqual(new Set(['Address Tags']))
  })
})

describe('entry networks', () => {
  it('gives a text-named entry the network of its rich address', () => {
    const hit = standardHit(
      raw(TAGS, '0x1', {
        props: [
          {
            label: 'Name',
            value: 'USD Coin',
            isIdentifier: true,
            itemType: 'text',
          },
          {
            label: 'Address',
            value: 'eip155:1:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            isIdentifier: true,
            itemType: 'rich address',
          },
        ],
      }),
    )
    expect(hit.name.text).toBe('USD Coin')
    expect(hit.name.network).toBe('Ethereum Mainnet')
  })
})

describe('Stake hits', () => {
  it('drops an item that came back without its list', () => {
    expect(
      stakeHits(
        [
          { itemID: '0x1', status: 'Absent', registry: null },
          { itemID: '0x2', status: 'Absent', registry: { id: TAGS } },
        ],
        100,
      ).map((hit) => hit.itemID),
    ).toEqual(['0x2'])
  })

  it('shows every Stake hit and links to the plain list', () => {
    // The Stake list page's search filters only the page on screen, so a
    // Stake group never sends anyone there for "more".
    const hits = stakeHits(
      Array.from({ length: 7 }, (_, index) => ({
        itemID: `0x${index + 1}`,
        status: 'Submitted',
        registry: { id: TOKENS },
      })),
      100,
    )
    const [group] = groupHits(hits, new Map(), 'usdc')
    expect(group.hits).toHaveLength(7)
    expect(group.more).toBe(0)
    expect(group.href).toBe(`/tcr/100/${TOKENS}`)
  })
})
