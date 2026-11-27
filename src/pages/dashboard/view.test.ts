import { describe, expect, it } from 'vitest'
import type {
  DashboardActivity,
  DashboardData,
  DashboardRegistry,
  RulingRow,
  UnchallengedRow,
} from './types'
import {
  MAINNET_CHAIN_IDS,
  SUPPORTED_CHAIN_IDS,
  TESTNET_CHAIN_IDS,
  buildBoard,
  chainWindowsKnown,
  curatorsSince,
  entryCount,
  formatAgoLong,
  formatUnits,
  historySeries,
  isOwnCase,
  newestVerified,
  openWindows,
  ownCasesFirst,
  parseRange,
  rangeStart,
  registryHref,
  rowsPlaced,
  rulingCard,
  scopeChains,
  scopedBounties,
  scopedChallengeRecord,
  scopedFigures,
  scopedRulings,
  scopedSeries,
  scopedWins,
  sortRegistries,
  toAmount,
  validChain,
  windowsPending,
} from './view'

const ETHEREUM = 1
const GNOSIS = 100
const SEPOLIA = 11_155_111
const ALL = [ETHEREUM, GNOSIS]

const LIST_OF_LISTS_ETHEREUM = '0x2acf59a420ca888f46d46974f62570f8a38cd4da'
const A = '0x00000000000000000000000000000000000000aa'
const B = '0x00000000000000000000000000000000000000bb'
const C = '0x00000000000000000000000000000000000000cc'
const D = '0x00000000000000000000000000000000000000dd'
const STETH = '0xae7ab96520de3a18e5e111b5eaab095312d7fe84'
const SDAI = '0xaf204776c7245bf4147c2612bf6e5972ee483701'
const ODD_TOKEN = '0x1234567890abcdef1234567890abcdef1234abcd'

const DAY = 86_400
const HOUR = 3600
const ETH = 10n ** 18n

const registry = (
  overrides: Partial<DashboardRegistry> = {},
): DashboardRegistry => ({
  id: overrides.address ?? A,
  address: A,
  chainId: ETHEREUM,
  kind: 'standard',
  title: 'A list',
  itemCount: 0,
  activeCount: 0,
  pendingCount: 0,
  disputeCount: 0,
  trustStatus: 'unverified',
  ...overrides,
})

const dashboard = (overrides: Partial<DashboardData> = {}): DashboardData => ({
  generatedAt: 0,
  failedChains: [],
  since: 0,
  series: [],
  seriesByChain: {},
  seriesTruncated: false,
  registries: [],
  activities: [],
  unchallenged: [],
  unchallengedCount: {},
  unchallengedRows: {},
  challengePeriods: {},
  closingSoon: {},
  decided: [],
  rulings: {},
  rulingsCapped: {},
  classicEntries: {},
  tokens: {},
  openDisputes: [],
  openDisputesCapped: {},
  users: [],
  ...overrides,
})

const ruling = (overrides: Partial<RulingRow> = {}): RulingRow => ({
  id: 'standard-1',
  chainId: ETHEREUM,
  kind: 'standard',
  registry: A,
  resolvedAt: 1000,
  outcome: 'rejected',
  challengerWon: true,
  bounty: '0',
  ...overrides,
})

const activity = (
  overrides: Partial<DashboardActivity> = {},
): DashboardActivity => ({
  id: 'standard-1',
  chainId: ETHEREUM,
  registryAddress: A,
  registryTitle: 'A list',
  kind: 'submission',
  requestType: 'submission',
  status: 'Submitted',
  timestamp: 1000,
  href: `/tcr/1/${A}/0x01`,
  ...overrides,
})

const row = (
  id: string,
  list: string,
  submittedAt: number,
  deposit = '0',
): UnchallengedRow => ({ id, registry: list, submittedAt, deposit })

const user = (chains: number[]) => ({
  address: `0x${chains.join('')}`,
  chainId: chains[0],
  chains: Object.fromEntries(
    chains.map((chainId) => [
      chainId,
      {
        activity: 1,
        submissions: 1,
        removals: 0,
        challenges: 0,
        decidedChallenges: 0,
        successfulChallenges: 0,
        lastActiveAt: 0,
      },
    ]),
  ),
  submissions: 1,
  removals: 0,
  challenges: 0,
  decidedChallenges: 0,
  successfulChallenges: 0,
  activity: 1,
  lastActiveAt: 0,
})

describe('chain scopes', () => {
  it('means Ethereum and Gnosis by "All chains", never Sepolia', () => {
    expect(scopeChains('all')).toEqual([ETHEREUM, GNOSIS])
    expect(MAINNET_CHAIN_IDS).toEqual([ETHEREUM, GNOSIS])
    expect(TESTNET_CHAIN_IDS).toEqual([SEPOLIA])
  })

  it('picks Sepolia on its own', () => {
    expect(scopeChains(SEPOLIA)).toEqual([SEPOLIA])
    expect(SUPPORTED_CHAIN_IDS).toContain(SEPOLIA)
  })

  it.each([
    ['1', ETHEREUM],
    ['100', GNOSIS],
    ['11155111', SEPOLIA],
    ['137', 'all'],
    ['abc', 'all'],
    ['', 'all'],
    [null, 'all'],
  ] as const)('reads ?chain=%s as %s', (value, chain) => {
    expect(validChain(value)).toBe(chain)
  })
})

describe('entryCount', () => {
  it('adds a Standard list’s entries with an open request to its settled ones', () => {
    expect(entryCount(registry({ itemCount: 7, pendingCount: 3 }))).toBe(10)
  })

  it('takes a Stake list’s count as it is: its pendingCount is listed entries', () => {
    expect(
      entryCount(
        registry({ kind: 'permanent', itemCount: 7, pendingCount: 3 }),
      ),
    ).toBe(7)
  })

  it('links a list by its chain and address', () => {
    expect(registryHref(registry({ chainId: GNOSIS, address: B }))).toBe(
      `/tcr/100/${B}`,
    )
  })
})

describe('toAmount', () => {
  it.each([
    ['1000000000000000000', ETH],
    [' 42 ', 42n],
    ['0', 0n],
    [
      '123456789012345678901234567890',
      123_456_789_012_345_678_901_234_567_890n,
    ],
    // A JS number of 1000 xDAI stringifies to "1e+21".
    ['1e+21', 0n],
    ['1.5', 0n],
    ['-5', 0n],
    ['0x10', 0n],
    ['', 0n],
    [undefined, 0n],
    [null, 0n],
  ])('reads %j as %s', (value, amount) => {
    expect(toAmount(value)).toBe(amount)
  })
})

describe('formatUnits', () => {
  it.each([
    [30_690n * ETH + ETH / 10n, 18, '30,690.1'],
    [22_586n * 10n ** 15n, 18, '22.586'],
    [10n ** 14n, 18, '0.0001'],
    // Rounded to four decimals, half up.
    [5n * 10n ** 13n, 18, '0.0001'],
    [5n * 10n ** 13n - 1n, 18, '0'],
    [99_995n * 10n ** 13n, 18, '1'],
    [1_234_567n * 10n ** 16n, 18, '12,345.67'],
    [1234n, 2, '12.34'],
    [5n, 0, '5'],
    [0n, 18, '0'],
  ])('formats %s at %i decimals as %s', (amount, decimals, text) => {
    expect(formatUnits(amount, decimals)).toBe(text)
  })

  it.each([
    [1_234_567n, 6, 6, '1.234567'],
    [123_456_789n, 8, 2, '1.23'],
  ])(
    'formats %s at %i decimals to %i places as %s',
    (amount, decimals, fraction, text) => {
      expect(formatUnits(amount, decimals, fraction)).toBe(text)
    },
  )
})

describe('challenge windows', () => {
  const rows = [row('r1', A, 1000), row('r2', B, 2000), row('r3', A, 500)]

  it('places the rows only when every list’s period is known', () => {
    expect(rowsPlaced(rows, { [A]: 3600, [B]: 0 })).toBe(true)
    expect(rowsPlaced(rows, { [A]: 3600 })).toBe(false)
    expect(rowsPlaced(rows, undefined)).toBe(false)
    expect(rowsPlaced([row('r4', A, 0)], { [A]: 3600 })).toBe(false)
  })

  it('keeps the rows still inside their window, closing soonest first', () => {
    const open = openWindows(rows, { [A]: 1000, [B]: 1000 }, 2000)
    // r3 closed at 1500; r1 closes at 2000 (now: still open), r2 at 3000.
    expect(open).toEqual([
      { row: rows[0], closes: 2000 },
      { row: rows[1], closes: 3000 },
    ])
  })

  it('claims no window for a row whose list period did not load', () => {
    expect(
      openWindows(rows, { [A]: 10_000 }, 0).map(({ row }) => row.id),
    ).toEqual(['r3', 'r1'])
  })

  it('orders rows closing at once by id', () => {
    const tied = [row('b', A, 1000), row('a', A, 1000)]
    expect(openWindows(tied, { [A]: 10 }, 0).map(({ row }) => row.id)).toEqual([
      'a',
      'b',
    ])
  })

  it('knows a chain’s windows once each of its rows can be placed', () => {
    const data = dashboard({
      unchallengedRows: { [ETHEREUM]: rows, [GNOSIS]: [] },
      challengePeriods: { [ETHEREUM]: { [A]: 1, [B]: 1 } },
    })
    expect(chainWindowsKnown(data, ETHEREUM)).toBe(true)
    // No rows: nothing to place.
    expect(chainWindowsKnown(data, GNOSIS)).toBe(true)
    expect(
      chainWindowsKnown(
        dashboard({ unchallengedRows: { [ETHEREUM]: rows } }),
        ETHEREUM,
      ),
    ).toBe(false)
  })

  it('waits on a chain’s periods and its closing-soon cards', () => {
    const periods = { [ETHEREUM]: { [A]: 1, [B]: 1 } }
    const rowsByChain = { [ETHEREUM]: rows }
    expect(
      windowsPending(dashboard({ unchallengedRows: rowsByChain }), ETHEREUM),
    ).toBe(true)
    expect(
      windowsPending(
        dashboard({ unchallengedRows: rowsByChain, challengePeriods: periods }),
        ETHEREUM,
      ),
    ).toBe(true)
    expect(
      windowsPending(
        dashboard({
          unchallengedRows: rowsByChain,
          challengePeriods: periods,
          closingSoon: { [ETHEREUM]: [] },
        }),
        ETHEREUM,
      ),
    ).toBe(false)
    expect(windowsPending(dashboard(), ETHEREUM)).toBe(false)
  })
})

describe('scopedFigures', () => {
  const NOW = 10_000
  const data = dashboard({
    registries: [
      registry({
        address: LIST_OF_LISTS_ETHEREUM,
        trustStatus: 'verified',
        itemCount: 10,
        pendingCount: 1,
      }),
      registry({
        address: A,
        trustStatus: 'verified',
        itemCount: 5,
        pendingCount: 2,
      }),
      registry({
        address: B,
        chainId: GNOSIS,
        kind: 'permanent',
        trustStatus: 'verified',
        itemCount: 7,
        pendingCount: 4,
      }),
      registry({ address: C, chainId: GNOSIS, itemCount: 1 }),
      registry({
        address: D,
        chainId: GNOSIS,
        trustStatus: 'unknown',
        itemCount: 2,
        pendingCount: 1,
      }),
      registry({
        address: A,
        chainId: SEPOLIA,
        trustStatus: 'verified',
        itemCount: 100,
        pendingCount: 50,
      }),
    ],
    users: [user([ETHEREUM]), user([GNOSIS, SEPOLIA]), user([SEPOLIA])],
    openDisputes: [
      activity({ id: 'd1', kind: 'challenge' }),
      activity({ id: 'd2', chainId: GNOSIS, kind: 'challenge' }),
      activity({ id: 'd3', chainId: SEPOLIA, kind: 'challenge' }),
    ],
    openDisputesCapped: { [SEPOLIA]: true },
    unchallengedCount: {
      [ETHEREUM]: { count: 3, capped: false },
      [GNOSIS]: { count: 1000, capped: true },
      [SEPOLIA]: { count: 9, capped: false },
    },
    unchallengedRows: {
      [ETHEREUM]: [
        row('e1', A, 9500, '10'),
        row('e2', A, 8000, '20'),
        row('e3', LIST_OF_LISTS_ETHEREUM, 9900, '1e+21'),
      ],
      [GNOSIS]: [row('g1', C, 9000, '5')],
    },
    challengePeriods: {
      [ETHEREUM]: { [A]: 1000, [LIST_OF_LISTS_ETHEREUM]: 1000 },
      [GNOSIS]: { [C]: 2000 },
    },
    classicEntries: {
      [ETHEREUM]: { lists: 3, entries: 100, capped: false },
      [GNOSIS]: { lists: 2, entries: 50, capped: true },
      [SEPOLIA]: { lists: 9, entries: 999, capped: false },
    },
  })

  it('counts the lists in scope, Sepolia left out of "All chains"', () => {
    const figures = scopedFigures(data, ALL, NOW)
    expect(figures.registries).toBe(5)
    expect(figures.entries).toBe(11 + 7 + 7 + 1 + 3)
    expect(figures.curators).toBe(2)
  })

  it('counts Kleros Verified lists without the list of lists or unknown ones', () => {
    expect(scopedFigures(data, ALL, NOW).verified).toBe(2)
    expect(scopedFigures(data, [ETHEREUM], NOW).verified).toBe(1)
  })

  it('never counts a Stake list’s listed entries as open requests', () => {
    expect(scopedFigures(data, ALL, NOW).requestsOpen).toBe(1 + 2 + 0 + 1)
    expect(scopedFigures(data, [GNOSIS], NOW).requestsOpen).toBe(1)
  })

  it('counts the disputes open now in scope, and says when a read hit its cap', () => {
    const figures = scopedFigures(data, ALL, NOW)
    expect(figures.inCourt).toBe(2)
    expect(figures.inCourtCapped).toBe(false)
    expect(scopedFigures(data, [SEPOLIA], NOW)).toMatchObject({
      inCourt: 1,
      inCourtCapped: true,
    })
  })

  it('adds the unchallenged counts, capped when any chain’s count is', () => {
    expect(scopedFigures(data, ALL, NOW)).toMatchObject({
      unchallenged: 1003,
      unchallengedCapped: true,
    })
    expect(scopedFigures(data, [ETHEREUM], NOW)).toMatchObject({
      unchallenged: 3,
      unchallengedCapped: false,
    })
  })

  it('splits the unchallenged requests by their window, deposits per chain', () => {
    const figures = scopedFigures(data, ALL, NOW)
    expect(figures.windowsKnown).toBe(true)
    // e1 closes at 10500 and g1 at 11000; e2 closed at 9000. e3 is open, but
    // its deposit is unreadable and counts as none.
    expect(figures.inWindow).toBe(3)
    expect(figures.pastWindow).toBe(1)
    expect(figures.inWindowDeposits).toEqual({ [ETHEREUM]: 10n, [GNOSIS]: 5n })
  })

  it('claims no window when a chain’s periods are unknown', () => {
    const unknown = dashboard({
      ...data,
      challengePeriods: { [ETHEREUM]: data.challengePeriods[ETHEREUM] },
    })
    expect(scopedFigures(unknown, ALL, NOW)).toMatchObject({
      windowsKnown: false,
      inWindow: 0,
      pastWindow: 0,
      inWindowDeposits: {},
    })
  })

  it('adds the retired Classic lists to the all-time entries only', () => {
    const figures = scopedFigures(data, ALL, NOW)
    expect(figures.classicLists).toBe(5)
    expect(figures.classicEntries).toBe(150)
    expect(figures.entriesAllTime).toBe(figures.entries + 150)
    // A Classic total that came back a full page is a lower bound.
    expect(figures.classicCapped).toBe(true)
    expect(scopedFigures(data, [ETHEREUM], NOW).classicCapped).toBe(false)
  })
})

describe('the rulings ledger', () => {
  const data = dashboard({
    rulings: {
      [ETHEREUM]: [
        ruling({
          id: 's1',
          bounty: String(ETH),
          challenger: '0xc1',
          resolvedAt: 50,
        }),
        ruling({
          id: 's2',
          challengerWon: false,
          outcome: 'registered',
          challenger: '0xc2',
          resolvedAt: 40,
        }),
        ruling({
          id: 'c1',
          kind: 'classic',
          registry: '',
          bounty: String(ETH / 2n),
          challenger: '0xc1',
          resolvedAt: 90,
        }),
        ruling({ id: 'c2', kind: 'classic', registry: '', resolvedAt: 80 }),
        ruling({
          id: 'p1',
          kind: 'permanent',
          token: STETH,
          bounty: String(2n * ETH),
          challenger: '0xc3',
          resolvedAt: 30,
        }),
      ],
      [GNOSIS]: [
        ruling({
          id: 'g1',
          chainId: GNOSIS,
          bounty: String(30n * ETH),
          challenger: '0xc1',
          resolvedAt: 60,
        }),
        ruling({
          id: 'g2',
          chainId: GNOSIS,
          kind: 'permanent',
          token: SDAI,
          bounty: String(60_615n * 10n ** 16n),
          challenger: '0xc4',
          resolvedAt: 60,
        }),
        ruling({
          id: 'g3',
          chainId: GNOSIS,
          kind: 'permanent',
          bounty: '5',
          resolvedAt: 10,
        }),
        ruling({
          id: 'g4',
          chainId: GNOSIS,
          kind: 'permanent',
          token: ODD_TOKEN,
          bounty: '7',
          resolvedAt: 20,
        }),
      ],
      [SEPOLIA]: [
        ruling({
          id: 't1',
          chainId: SEPOLIA,
          bounty: '999',
          challenger: '0xc9',
        }),
      ],
    },
    rulingsCapped: { [GNOSIS]: true },
    tokens: {
      [`${ETHEREUM}:${STETH}`]: { symbol: 'stETH', decimals: 18 },
      [`${GNOSIS}:${SDAI}`]: { symbol: 'sDAI', decimals: 18 },
    },
  })

  describe('scopedRulings', () => {
    it('lists the Standard and Stake rulings newest first, never a Classic one', () => {
      expect(scopedRulings(data, ALL).map((r) => r.id)).toEqual([
        'g1',
        'g2',
        's1',
        's2',
        'p1',
        'g4',
        'g3',
      ])
    })

    it('lists only the chains in scope', () => {
      expect(scopedRulings(data, [SEPOLIA]).map((r) => r.id)).toEqual(['t1'])
      expect(scopedRulings(dashboard(), ALL)).toEqual([])
    })
  })

  describe('scopedBounties', () => {
    const bounties = scopedBounties(data, ALL)
    const coin = (key: string) => bounties.coins.find((c) => c.key === key)

    it('keeps one figure per coin, the chain’s coin before its Stake tokens', () => {
      expect(bounties.coins.map((c) => c.key)).toEqual([
        `${ETHEREUM}:native`,
        `${ETHEREUM}:${STETH}`,
        `${GNOSIS}:native`,
        `${GNOSIS}:${ODD_TOKEN}`,
        `${GNOSIS}:${SDAI}`,
        `${GNOSIS}:token-unknown`,
      ])
    })

    it('adds the retired Classic lists’ bounties to the chain’s coin', () => {
      expect(coin('1:native')).toMatchObject({
        amount: ETH + ETH / 2n,
        won: 3,
        paid: 2,
        symbol: 'ETH',
        display: '1.5 ETH',
        value: 1.5,
        stake: false,
      })
    })

    it('names each coin from the chain or the token read', () => {
      expect(coin('100:native')).toMatchObject({
        symbol: 'xDAI',
        display: '30 xDAI',
      })
      expect(coin(`100:${SDAI}`)).toMatchObject({
        symbol: 'sDAI',
        display: '606.15 sDAI',
        stake: true,
        token: SDAI,
      })
      expect(coin(`1:${STETH}`)?.display).toBe('2 stETH')
    })

    it('shows the count, not an amount, for a token whose decimals did not load', () => {
      const odd = coin(`100:${ODD_TOKEN}`)
      expect(odd).toMatchObject({ symbol: '0x1234…abcd', amount: 7n, won: 1 })
      expect(odd?.decimals).toBeUndefined()
      expect(odd?.display).toBeUndefined()
    })

    it('keeps a Stake bounty whose token did not load out of the chain’s coin', () => {
      const unknown = coin('100:token-unknown')
      expect(unknown).toMatchObject({ stake: true, symbol: '', amount: 5n })
      expect(unknown?.token).toBeUndefined()
      expect(unknown?.display).toBeUndefined()
      expect(coin('100:native')?.amount).toBe(30n * ETH)
    })

    it('counts the winners and the rulings, Classic aside where the panel lists', () => {
      expect(bounties).toMatchObject({
        won: 8,
        winners: 3,
        rulings: 9,
        listedRulings: 7,
        listedWon: 6,
        classicBounties: 1,
      })
    })

    it('says which chains’ ledgers loaded and whether one stopped at its cap', () => {
      expect(bounties).toMatchObject({
        capped: true,
        loaded: ALL,
        missing: [],
      })
      const partial = dashboard({ rulings: { [ETHEREUM]: [] } })
      expect(scopedBounties(partial, ALL)).toMatchObject({
        capped: false,
        loaded: [ETHEREUM],
        missing: [GNOSIS],
        coins: [],
      })
    })

    it('reads Sepolia only when it is picked', () => {
      expect(bounties.coins.some((c) => c.chainId === SEPOLIA)).toBe(false)
      expect(scopedBounties(data, [SEPOLIA]).coins).toMatchObject([
        { key: `${SEPOLIA}:native`, amount: 999n, symbol: 'ETH' },
      ])
    })
  })

  describe('scopedChallengeRecord', () => {
    it('adds the disputes open now to the closed ones, on loaded chains only', () => {
      const record = scopedChallengeRecord(
        dashboard({
          rulings: { [ETHEREUM]: data.rulings[ETHEREUM] },
          openDisputes: [
            activity({ id: 'o1', kind: 'challenge' }),
            activity({ id: 'o2', chainId: GNOSIS, kind: 'challenge' }),
          ],
        }),
        ALL,
      )
      expect(record.challenged).toBe(5 + 1)
      // Gnosis's ledger is missing: the count is a lower bound.
      expect(record.challengedPartial).toBe(true)
    })

    it.each([
      ['nothing is missing', {}, false],
      [
        'a ledger stopped at its cap',
        { rulingsCapped: { [GNOSIS]: true } },
        true,
      ],
      [
        'the open disputes read hit its limit',
        { openDisputesCapped: { [ETHEREUM]: true } },
        true,
      ],
      [
        'only a chain out of scope is capped',
        { openDisputesCapped: { [SEPOLIA]: true } },
        false,
      ],
    ])('is complete or not when %s', (_name, overrides, partial) => {
      const record = scopedChallengeRecord(
        dashboard({
          rulings: { [ETHEREUM]: [], [GNOSIS]: [] },
          ...overrides,
        }),
        ALL,
      )
      expect(record.challengedPartial).toBe(partial)
    })
  })

  describe('scopedWins', () => {
    it('counts each challenger’s wins on the lists the app shows', () => {
      const wins = scopedWins(data, ALL)
      // 0xc1 also won a Classic dispute, which their profile cannot show.
      expect(Object.fromEntries(wins)).toEqual({
        '0xc1': 2,
        '0xc3': 1,
        '0xc4': 1,
      })
    })
  })
})

describe('newestVerified', () => {
  it('lists the Verified lists newest to earn the badge first', () => {
    const lists = [
      registry({
        address: A,
        title: 'Old',
        trustStatus: 'verified',
        verifiedAt: 100,
      }),
      registry({
        address: B,
        title: 'New',
        trustStatus: 'verified',
        verifiedAt: 300,
      }),
      registry({ address: C, title: 'Community', verifiedAt: 999 }),
      registry({
        address: LIST_OF_LISTS_ETHEREUM,
        title: 'List of lists',
        trustStatus: 'verified',
      }),
      registry({
        address: D,
        title: 'Big',
        trustStatus: 'verified',
        verifiedAt: 100,
        itemCount: 50,
      }),
    ]
    expect(newestVerified(lists).map((list) => list.title)).toEqual([
      'New',
      'Big',
      'Old',
    ])
  })

  it('breaks a tie by entries, then by name', () => {
    const lists = [
      registry({ address: A, title: 'Beta', trustStatus: 'verified' }),
      registry({ address: B, title: 'Alpha', trustStatus: 'verified' }),
    ]
    expect(newestVerified(lists).map((list) => list.title)).toEqual([
      'Alpha',
      'Beta',
    ])
  })
})

describe('rulingCard', () => {
  const NOW = 100_000

  it.each([
    ['registered', 'Registered by ruling', 'registered'],
    ['kept', 'Kept by ruling', 'registered'],
    ['rejected', 'Rejected by ruling', 'off'],
    ['removed', 'Removed by ruling', 'off'],
    ['no-ruling', 'Court refused to rule', 'neutral'],
  ] as const)('labels a %s ruling “%s”', (outcome, detail, tone) => {
    expect(rulingCard(ruling({ outcome }), NOW)).toMatchObject({ detail, tone })
  })

  it('links the entry when the ledger names it, else the list', () => {
    expect(rulingCard(ruling({ itemID: '0x01' }), NOW).href).toBe(
      `/tcr/1/${A}/0x01`,
    )
    expect(rulingCard(ruling(), NOW).href).toBe(`/tcr/1/${A}`)
  })

  it('takes the entry and its list from the loaded card', () => {
    const card = rulingCard(
      ruling({ resolvedAt: NOW - 3 * HOUR }),
      NOW,
      activity({
        registryTitle: 'Tokens',
        previewProps: [{ label: 'Name', value: 'Kleros' }],
        actor: '0xc1',
      }),
      '30 xDAI',
    )
    expect(card).toMatchObject({
      registry: 'Tokens',
      identifiers: [{ label: 'Name', value: 'Kleros' }],
      actor: '0xc1',
      bounty: '30 xDAI',
      when: 'decided 3h ago',
      at: NOW - 3 * HOUR,
    })
  })
})

describe('formatAgoLong', () => {
  const NOW = 1000 * DAY

  it.each([
    [3 * HOUR, '3h ago'],
    [6 * DAY + 23 * HOUR, '6d 23h ago'],
    [7 * DAY, '7 days ago'],
    [59 * DAY, '59 days ago'],
    [60 * DAY, '2 months ago'],
    [150 * DAY, '5 months ago'],
    [365 * DAY, 'a year ago'],
    [729 * DAY, 'a year ago'],
    [730 * DAY, '2 years ago'],
  ])('reads %i seconds ago as “%s”', (age, text) => {
    expect(formatAgoLong(NOW - age, NOW)).toBe(text)
  })
})

describe('scopedSeries', () => {
  it('adds the chains in scope day by day', () => {
    const day = (n: number, submissions: number, challenges = 0) => ({
      day: n * DAY,
      submissions,
      removals: 1,
      challenges,
    })
    const data = dashboard({
      series: [day(0, 9), day(1, 9)],
      seriesByChain: {
        [ETHEREUM]: [day(0, 1), day(1, 2, 1)],
        [GNOSIS]: [day(0, 3)],
        [SEPOLIA]: [day(0, 100), day(1, 100)],
      },
    })
    expect(scopedSeries(data, ALL)).toEqual([
      { day: 0, submissions: 4, removals: 2, challenges: 0 },
      { day: DAY, submissions: 2, removals: 1, challenges: 1 },
    ])
  })
})

describe('sortRegistries', () => {
  const lists = [
    registry({
      address: A,
      title: 'Community',
      itemCount: 900,
      pendingCount: 1,
    }),
    registry({
      address: B,
      title: 'Verified',
      trustStatus: 'verified',
      itemCount: 1,
    }),
    registry({
      address: C,
      title: 'Stake',
      kind: 'permanent',
      itemCount: 50,
      pendingCount: 40,
      disputeCount: 1,
      lastActivityAt: 500,
    }),
    registry({
      address: D,
      title: 'Busy',
      pendingCount: 5,
      lastActivityAt: 100,
    }),
  ]
  const titles = (sort: Parameters<typeof sortRegistries>[1]) =>
    sortRegistries(lists, sort).map((list) => list.title)

  it('leads with Verified lists by signal', () => {
    expect(titles('signal')[0]).toBe('Verified')
  })

  it('ranks by open requests, a Stake list’s listed entries counting as none', () => {
    expect(titles('activity')).toEqual([
      'Busy',
      'Community',
      'Stake',
      'Verified',
    ])
  })

  it('ranks by entries and by the latest activity', () => {
    expect(titles('items')).toEqual(['Community', 'Stake', 'Busy', 'Verified'])
    expect(titles('recent').slice(0, 2)).toEqual(['Stake', 'Busy'])
  })

  it('leaves the input as it was', () => {
    sortRegistries(lists, 'items')
    expect(lists.map((list) => list.title)).toEqual([
      'Community',
      'Verified',
      'Stake',
      'Busy',
    ])
  })
})

describe('buildBoard', () => {
  const NOW = 10_000

  it('shows the newest unchallenged requests, with no window, when windows are unknown', () => {
    const data = dashboard({
      unchallenged: [
        activity({ id: 'x1', timestamp: NOW - HOUR }),
        activity({ id: 'x1', timestamp: NOW - HOUR }),
        activity({
          id: 'x2',
          chainId: GNOSIS,
          requestType: 'removal',
          kind: 'removal',
          timestamp: NOW - 2 * HOUR,
        }),
        activity({ id: 'x3', chainId: SEPOLIA }),
      ],
      unchallengedRows: { [ETHEREUM]: [row('x1', A, NOW - HOUR)] },
    })
    const board = buildBoard(data, NOW, ALL)
    expect(board.windowsKnown).toBe(false)
    expect(board.open.map((card) => [card.id, card.when])).toEqual([
      ['x1', 'submitted 1h ago'],
      ['x2', 'removal requested 2h ago'],
    ])
    expect(board.open[0]).toMatchObject({
      windowStart: undefined,
      windowEnd: undefined,
      tone: 'window',
      detail: '',
    })
    // With no window known, every unchallenged row counts for its list.
    expect(board.openLists).toEqual([
      { chainId: ETHEREUM, registry: A, count: 1 },
    ])
  })

  it('orders the open windows soonest first, as far as the loaded cards keep it exact', () => {
    const data = dashboard({
      challengePeriods: { [ETHEREUM]: { [A]: 1000 }, [GNOSIS]: { [C]: 1000 } },
      unchallengedRows: {
        // Five open on Ethereum, of which only the first two cards loaded.
        [ETHEREUM]: [9100, 9200, 9300, 9400, 9500].map((at) =>
          row(`e${at}`, A, at),
        ),
        [GNOSIS]: [row('g9150', C, 9150), row('g9900', C, 9900)],
      },
      closingSoon: {
        [ETHEREUM]: [
          activity({ id: 'e9100', timestamp: 9100 }),
          activity({ id: 'e9200', timestamp: 9200 }),
        ],
        [GNOSIS]: [
          activity({
            id: 'g9150',
            chainId: GNOSIS,
            registryAddress: C,
            timestamp: 9150,
          }),
          activity({
            id: 'g9900',
            chainId: GNOSIS,
            registryAddress: C,
            timestamp: 9900,
          }),
        ],
      },
    })
    const board = buildBoard(data, NOW, ALL)
    expect(board.windowsKnown).toBe(true)
    // Ethereum's unloaded cards may close before 10900, so Gnosis's g9900
    // waits until they are shown.
    expect(
      board.open.map((card) => [card.id, card.windowStart, card.windowEnd]),
    ).toEqual([
      ['e9100', 9100, 10_100],
      ['g9150', 9150, 10_150],
      ['e9200', 9200, 10_200],
    ])
    expect(board.openLists).toEqual([
      { chainId: ETHEREUM, registry: A, count: 5 },
      { chainId: GNOSIS, registry: C, count: 2 },
    ])
  })

  it('leaves out cards whose window has closed or whose period did not load', () => {
    const data = dashboard({
      challengePeriods: { [ETHEREUM]: { [A]: 1000 } },
      unchallengedRows: { [ETHEREUM]: [row('open', A, 9500)] },
      closingSoon: {
        [ETHEREUM]: [
          activity({ id: 'closed', timestamp: 8000 }),
          activity({ id: 'open', timestamp: 9500 }),
          activity({ id: 'unplaced', registryAddress: B, timestamp: 9900 }),
        ],
      },
    })
    expect(
      buildBoard(data, NOW, [ETHEREUM]).open.map((card) => card.id),
    ).toEqual(['open'])
  })

  it('lists the disputes open now in scope, each once, with its case number', () => {
    const dispute = activity({
      id: 'd1',
      kind: 'challenge',
      disputeID: '1040',
      timestamp: NOW - 2 * HOUR,
    })
    const board = buildBoard(
      dashboard({
        openDisputes: [
          dispute,
          dispute,
          activity({ id: 'd2', chainId: SEPOLIA }),
        ],
      }),
      NOW,
      ALL,
    )
    expect(board.live).toHaveLength(1)
    expect(board.live[0]).toMatchObject({
      id: 'd1',
      detail: 'Dispute',
      detailId: '#1040',
      when: 'challenged 2h ago',
      tone: 'contested',
    })
  })
})

describe('the chart’s ranges', () => {
  // Sunday 22 Nov 2026, 12:00 UTC.
  const NOW = Date.UTC(2026, 10, 22, 12) / 1000
  const at = (iso: string) => Date.parse(iso) / 1000

  it.each([
    ['30d', '6m'],
    ['6m', '30d'],
    ['1y', '30d'],
    ['3y', '30d'],
  ] as const)('reads ?range=%s', (value, fallback) => {
    expect(parseRange(value, fallback)).toBe(value)
  })

  it.each([null, '', '5y', '30D'])('falls back on %j', (value) => {
    expect(parseRange(value, '6m')).toBe('6m')
  })

  it.each([
    ['6m', 26],
    ['1y', 52],
  ] as const)(
    'buckets %s by UTC week, the current week last',
    (range, count) => {
      const series = historySeries([], range, NOW)
      expect(series.unit).toBe('week')
      expect(series.starts).toHaveLength(count)
      for (const start of series.starts) {
        expect(start % DAY).toBe(0)
        expect(new Date(start * 1000).getUTCDay()).toBe(1)
      }
      expect(series.starts.at(-1)).toBe(at('2026-11-16T00:00:00Z'))
      expect(rangeStart(range, NOW)).toBe(series.starts[0])
    },
  )

  it('buckets 3y by UTC month, the current month last', () => {
    const series = historySeries([], '3y', NOW)
    expect(series.unit).toBe('month')
    expect(series.starts).toHaveLength(36)
    expect(series.starts[0]).toBe(at('2023-12-01T00:00:00Z'))
    expect(series.starts.at(-1)).toBe(at('2026-11-01T00:00:00Z'))
    for (const start of series.starts)
      expect(new Date(start * 1000).getUTCDate()).toBe(1)
  })

  it('counts requests up and challenges down, each in its own week', () => {
    const series = historySeries(
      [
        { at: at('2026-11-16T00:00:00Z'), kind: 'submissions' },
        { at: at('2026-11-15T23:59:59Z'), kind: 'removals' },
        { at: at('2026-11-15T12:00:00Z'), kind: 'challenges' },
        // Before the range, and after the current week.
        { at: at('2026-05-01T00:00:00Z'), kind: 'submissions' },
        { at: at('2026-11-23T00:00:00Z'), kind: 'submissions' },
      ],
      '6m',
      NOW,
    )
    expect(series.up.at(-1)).toBe(1)
    expect(series.up.at(-2)).toBe(1)
    expect(series.down.at(-2)).toBe(1)
    expect(series.up.reduce((sum, n) => sum + n, 0)).toBe(2)
    expect(series.down.reduce((sum, n) => sum + n, 0)).toBe(1)
  })

  it('counts each month from its first second', () => {
    const series = historySeries(
      [
        { at: at('2023-11-30T23:59:59Z'), kind: 'submissions' },
        { at: at('2023-12-01T00:00:00Z'), kind: 'submissions' },
        { at: at('2026-11-22T11:00:00Z'), kind: 'challenges' },
      ],
      '3y',
      NOW,
    )
    expect(series.up[0]).toBe(1)
    expect(series.up.reduce((sum, n) => sum + n, 0)).toBe(1)
    expect(series.down.at(-1)).toBe(1)
  })
})

describe('curatorsSince', () => {
  it('counts each curator’s requests and challenges since the range began', () => {
    const curators = curatorsSince(
      [
        { at: 100, chainId: ETHEREUM, kind: 'submissions', who: '0xa' },
        { at: 200, chainId: GNOSIS, kind: 'removals', who: '0xa' },
        { at: 300, chainId: GNOSIS, kind: 'challenges', who: '0xa' },
        { at: 99, chainId: ETHEREUM, kind: 'challenges', who: '0xa' },
        { at: 400, chainId: SEPOLIA, kind: 'submissions', who: '0xa' },
        { at: 500, chainId: ETHEREUM, kind: 'submissions' },
        { at: 150, chainId: ETHEREUM, kind: 'challenges', who: '0xb' },
      ],
      100,
      ALL,
    )
    expect(curators).toEqual([
      { address: '0xa', requests: 2, challenges: 1, lastActiveAt: 300 },
      { address: '0xb', requests: 0, challenges: 1, lastActiveAt: 150 },
    ])
  })
})

describe('own cases in court', () => {
  const ME = `0x${'a'.repeat(40)}`
  const card = (id: string, parties?: string[]) =>
    ({ id, parties }) as unknown as Parameters<typeof isOwnCase>[0]
  const live = [
    card('1', ['0xb', '0xc']),
    card('2', ['0xb', ME]),
    card('3'),
    card('4', [ME, '0xc']),
  ]

  it('knows a case by either side, whatever the address’s case', () => {
    expect(isOwnCase(live[1], ME.toUpperCase().replace('0X', '0x'))).toBe(true)
    expect(isOwnCase(live[3], ME)).toBe(true)
    expect(isOwnCase(live[0], ME)).toBe(false)
    expect(isOwnCase(live[2], ME)).toBe(false)
    expect(isOwnCase(live[1], undefined)).toBe(false)
  })

  it('puts the wallet’s own first, each part in its order', () => {
    expect(ownCasesFirst(live, ME).map((c) => c.id)).toEqual([
      '2',
      '4',
      '1',
      '3',
    ])
  })

  it('leaves the order alone with no wallet, or none of its cases', () => {
    expect(ownCasesFirst(live, undefined)).toBe(live)
    expect(ownCasesFirst(live, `0x${'9'.repeat(40)}`)).toBe(live)
  })
})
