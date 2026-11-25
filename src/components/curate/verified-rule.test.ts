import type { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { request } from 'utils/indexer-request'
import type { TrustStatus } from 'pages/dashboard/types'
import {
  LIST_OF_LISTS_ADDRESS_LABEL,
  countsAsCommunityList,
  countsAsVerifiedList,
  fetchVerifiedRegistries,
  listOfListsEntryAddress,
  readVerifiedSets,
  verifiedSetFrom,
  withVerified,
} from './verified-rule'

vi.mock('utils/indexer-request', () => ({ request: vi.fn() }))

const GNOSIS = 100
const ETHEREUM = 1
const LIST_OF_LISTS = {
  [ETHEREUM]: '0x2acf59a420ca888f46d46974f62570f8a38cd4da',
  [GNOSIS]: '0x5f688a4bac5e2787ef1d9de325831e537ee4cffa',
}
const FORMER_GNOSIS = '0x2418d887d0d0fe03b793a6af4321fa488226a0b5'
const RETIRED_GNOSIS = '0x2442d40b0aecad0298c2724a97f2f1bbdf2c2615'

/** A distinct, valid list address. */
const address = (n: number) => `0x${n.toString(16).padStart(40, '0')}`
const A = '0xAbCdEf0123456789aBcDeF0123456789AbCdEf01'
const B = address(0xb)
const C = address(0xc)

type Options = {
  url: string
  document: string
  variables: Record<string, unknown>
}

/** The indexer as the rule reads it: one handler per query. */
const indexer = (answer: {
  entries?: (options: Options) => unknown
  classic?: (options: Options) => unknown
}) =>
  vi.mocked(request).mockImplementation((async (options: Options) => {
    if (options.document.includes('query VerifiedRegistries'))
      return { verifiedStandard: answer.entries?.(options) ?? [] }
    if (options.document.includes('query ClassicAmong'))
      return { classic: answer.classic?.(options) ?? [] }
    throw new Error('unexpected query')
  }) as never)

const entry = (value: unknown, label = 'Address') => ({
  props: [{ label, value }],
})

const registry = (
  chainId: number,
  addr: string,
  trustStatus: TrustStatus = 'unknown',
) => ({ chainId, address: addr, trustStatus })

describe('listOfListsEntryAddress', () => {
  it('reads the field labelled Address, lowercased', () => {
    expect(listOfListsEntryAddress([{ label: 'Address', value: A }])).toBe(
      A.toLowerCase(),
    )
    expect(
      listOfListsEntryAddress([
        { label: LIST_OF_LISTS_ADDRESS_LABEL, value: B },
      ]),
    ).toBe(B)
  })

  it('takes no other field, even one that comes first', () => {
    expect(
      listOfListsEntryAddress([
        { label: 'Contract address', value: B },
        { label: 'Address', value: A },
        { label: 'Zebra', value: C },
      ]),
    ).toBe(A.toLowerCase())
    expect(
      listOfListsEntryAddress([
        { label: 'address', value: A },
        { label: 'Addresses', value: B },
        { label: ' Address', value: C },
      ]),
    ).toBeNull()
  })

  it.each([
    ['a short value', '0x1234'],
    ['a value with no 0x', A.slice(2)],
    ['a value with room around it', ` ${A} `],
    ['a CAIP-10 address', `eip155:100:${A}`],
    ['a number', 42],
    ['no value', undefined],
    ['null', null],
  ])('points to nothing for %s', (_name, value) => {
    expect(listOfListsEntryAddress([{ label: 'Address', value }])).toBeNull()
  })

  it('points to nothing when the indexer has no fields', () => {
    expect(listOfListsEntryAddress()).toBeNull()
    expect(listOfListsEntryAddress(null)).toBeNull()
    expect(listOfListsEntryAddress([])).toBeNull()
    expect(listOfListsEntryAddress([null, undefined])).toBeNull()
  })

  it('reads another label when asked', () => {
    expect(listOfListsEntryAddress([{ label: 'List', value: B }], 'List')).toBe(
      B,
    )
  })
})

describe('verifiedSetFrom', () => {
  it('holds the chain’s list of lists and every list on it', () => {
    const set = verifiedSetFrom(GNOSIS, [entry(A), entry(B)])
    expect([...set].sort()).toEqual(
      [LIST_OF_LISTS[GNOSIS], A.toLowerCase(), B].sort(),
    )
  })

  it('never takes the address from the file name', () => {
    const set = verifiedSetFrom(GNOSIS, [
      {
        data: `/ipfs/Qm.../${A}.json`,
        props: [{ label: 'Title', value: 'x' }],
      },
    ])
    expect([...set]).toEqual([LIST_OF_LISTS[GNOSIS]])
  })

  it('holds no former or retired list of lists', () => {
    const set = verifiedSetFrom(GNOSIS, [])
    expect(set.has(FORMER_GNOSIS)).toBe(false)
    expect(set.has(RETIRED_GNOSIS)).toBe(false)
  })

  it('holds only the entries on a chain with no list of lists', () => {
    expect([...verifiedSetFrom(137, [entry(B)])]).toEqual([B])
  })
})

describe('fetchVerifiedRegistries', () => {
  it('reads Registered entries and those with a removal request still open', async () => {
    indexer({})
    await fetchVerifiedRegistries(GNOSIS)
    const [options] = vi.mocked(request).mock.calls[0] as unknown as [Options]
    expect(options.document).toMatch(
      /status:\s*{\s*_in:\s*\["Registered",\s*"ClearingRequested"\]\s*}/,
    )
  })

  it('reads the chain’s current list of lists alone', async () => {
    indexer({})
    await fetchVerifiedRegistries(GNOSIS)
    const [options] = vi.mocked(request).mock.calls[0] as unknown as [Options]
    expect(options.url).toBe('https://standard.indexer.test/100')
    expect(options.variables).toMatchObject({
      chainId: GNOSIS,
      listsOfLists: [LIST_OF_LISTS[GNOSIS]],
      offset: 0,
    })
  })

  it('answers the list of lists and the lists it holds, Classic ones left out', async () => {
    indexer({
      entries: () => [entry(A), entry(B), entry(C)],
      classic: () => [{ id: C }],
    })
    const verified = await fetchVerifiedRegistries(GNOSIS)
    expect(verified.sort()).toEqual(
      [LIST_OF_LISTS[GNOSIS], A.toLowerCase(), B].sort(),
    )
    const classic = vi
      .mocked(request)
      .mock.calls.map(([options]) => options as unknown as Options)
      .find((options) => options.document.includes('ClassicAmong'))
    expect((classic?.variables.ids as string[]).sort()).toEqual(
      [LIST_OF_LISTS[GNOSIS], A.toLowerCase(), B, C].sort(),
    )
  })

  it('pages through the entries, 500 at a time', async () => {
    const all = Array.from({ length: 501 }, (_, i) => entry(address(i + 1)))
    indexer({
      entries: ({ variables }) => {
        const offset = variables.offset as number
        return all.slice(offset, offset + 500)
      },
    })
    const verified = await fetchVerifiedRegistries(ETHEREUM)
    expect(verified).toHaveLength(502)
    const offsets = vi
      .mocked(request)
      .mock.calls.map(([options]) => (options as unknown as Options).variables)
      .filter((variables) => 'offset' in variables)
      .map((variables) => variables.offset)
    expect(offsets).toEqual([0, 500])
  })

  it('throws rather than read past its page bound', async () => {
    indexer({ entries: () => Array.from({ length: 500 }, () => entry(B)) })
    await expect(fetchVerifiedRegistries(GNOSIS)).rejects.toThrow(
      /past 20 pages/,
    )
    expect(request).toHaveBeenCalledTimes(20)
  })

  it.each([
    ['the entries', 'VerifiedRegistries'],
    ['the Classic check', 'ClassicAmong'],
  ])('throws when the indexer fails on %s', async (_name, failing) => {
    vi.mocked(request).mockImplementation((async (options: Options) => {
      if (options.document.includes(failing)) throw new Error('down')
      return { verifiedStandard: [], classic: [] }
    }) as never)
    await expect(fetchVerifiedRegistries(GNOSIS)).rejects.toThrow('down')
  })

  it('gives up on a page that takes longer than ten seconds', async () => {
    vi.useFakeTimers()
    try {
      // An indexer that never answers, until the read gives up on it.
      vi.mocked(request).mockImplementation((async (options: {
        signal: AbortSignal
      }) => {
        await new Promise((resolve) => {
          options.signal.addEventListener('abort', resolve)
        })
        throw new Error('aborted')
      }) as never)
      let settled = false
      const read = fetchVerifiedRegistries(GNOSIS).finally(() => {
        settled = true
      })
      const failed = expect(read).rejects.toThrow('aborted')
      await vi.advanceTimersByTimeAsync(9999)
      expect(settled).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      await failed
    } finally {
      vi.useRealTimers()
    }
  })

  it('reads nothing on a chain with no list of lists', async () => {
    await expect(fetchVerifiedRegistries(137)).resolves.toEqual([])
    expect(request).not.toHaveBeenCalled()
  })
})

describe('readVerifiedSets', () => {
  it('reads each chain once', async () => {
    indexer({
      entries: ({ variables }) => [entry(address(variables.chainId as number))],
    })
    const sets = await readVerifiedSets([ETHEREUM, GNOSIS, ETHEREUM])
    expect([...sets.keys()].sort()).toEqual([ETHEREUM, GNOSIS])
    expect(sets.get(GNOSIS)?.has(address(GNOSIS))).toBe(true)
    expect(sets.get(ETHEREUM)?.has(LIST_OF_LISTS[ETHEREUM])).toBe(true)
    const entryReads = vi
      .mocked(request)
      .mock.calls.filter(([options]) =>
        (options as unknown as Options).document.includes('VerifiedRegistries'),
      )
    expect(entryReads).toHaveLength(2)
  })

  it('leaves out a chain whose read failed, so its lists stay unknown', async () => {
    vi.mocked(request).mockImplementation((async (options: Options) => {
      if (options.variables.chainId === GNOSIS) throw new Error('down')
      return { verifiedStandard: [], classic: [] }
    }) as never)
    const sets = await readVerifiedSets([ETHEREUM, GNOSIS])
    expect([...sets.keys()]).toEqual([ETHEREUM])
    const [community] = withVerified([registry(GNOSIS, A, 'unverified')], sets)
    expect(community.trustStatus).toBe('unknown')
  })

  it('shares the pages’ cache through a query client', async () => {
    const fetchQuery = vi.fn(async () => [B])
    const sets = await readVerifiedSets([GNOSIS], {
      fetchQuery,
    } as unknown as QueryClient)
    expect(fetchQuery).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['verifiedRegistries', GNOSIS] }),
    )
    expect(sets.get(GNOSIS)?.has(B)).toBe(true)
    expect(request).not.toHaveBeenCalled()
  })
})

describe('withVerified', () => {
  const sets = new Map([[GNOSIS, new Set([LIST_OF_LISTS[GNOSIS], B])]])

  it.each([
    ['a list on the list of lists', registry(GNOSIS, B), 'verified'],
    [
      'in any case',
      registry(GNOSIS, B.toUpperCase().replace('0X', '0x')),
      'verified',
    ],
    [
      'the list of lists itself',
      registry(GNOSIS, LIST_OF_LISTS[GNOSIS]),
      'verified',
    ],
    ['any other list', registry(GNOSIS, C), 'unverified'],
    [
      'a list whose chain has not answered',
      registry(ETHEREUM, B, 'verified'),
      'unknown',
    ],
  ] as const)('stamps %s %s', (_name, input, trustStatus) => {
    expect(withVerified([input], sets)[0].trustStatus).toBe(trustStatus)
  })

  it('keeps a registry whose standing did not change as it was', () => {
    const same = registry(GNOSIS, B, 'verified')
    const changed = registry(GNOSIS, C, 'verified')
    const [first, second] = withVerified([same, changed], sets)
    expect(first).toBe(same)
    expect(second).not.toBe(changed)
    expect(changed.trustStatus).toBe('verified')
  })
})

describe('countsAsVerifiedList', () => {
  it.each([
    ['a Verified list', true, registry(GNOSIS, B, 'verified')],
    [
      'the list of lists, which grants the badge',
      false,
      registry(GNOSIS, LIST_OF_LISTS[GNOSIS], 'verified'),
    ],
    [
      'the list of lists in another case',
      false,
      registry(
        GNOSIS,
        LIST_OF_LISTS[GNOSIS].toUpperCase().replace('0X', '0x'),
        'verified',
      ),
    ],
    ['a Community list', false, registry(GNOSIS, B, 'unverified')],
    ['a list whose standing is unknown', false, registry(GNOSIS, B, 'unknown')],
  ])('%s: %s', (_name, expected, input) => {
    expect(countsAsVerifiedList(input)).toBe(expected)
  })

  it('counts another chain’s list of lists like any Verified list', () => {
    expect(
      countsAsVerifiedList(
        registry(ETHEREUM, LIST_OF_LISTS[GNOSIS], 'verified'),
      ),
    ).toBe(true)
  })
})

describe('countsAsCommunityList', () => {
  it.each([
    ['a Community list', true, registry(GNOSIS, B, 'unverified')],
    [
      'the former Gnosis list of lists',
      false,
      registry(GNOSIS, FORMER_GNOSIS, 'unverified'),
    ],
    ['a Verified list', false, registry(GNOSIS, B, 'verified')],
    ['a list whose standing is unknown', false, registry(GNOSIS, B, 'unknown')],
  ])('%s: %s', (_name, expected, input) => {
    expect(countsAsCommunityList(input)).toBe(expected)
  })

  it('never counts a list both ways', () => {
    const lists = [
      registry(GNOSIS, B, 'verified'),
      registry(GNOSIS, B, 'unverified'),
      registry(GNOSIS, LIST_OF_LISTS[GNOSIS], 'verified'),
      registry(GNOSIS, FORMER_GNOSIS, 'unverified'),
      registry(GNOSIS, C, 'unknown'),
    ]
    for (const list of lists)
      expect(countsAsVerifiedList(list) && countsAsCommunityList(list)).toBe(
        false,
      )
  })
})
