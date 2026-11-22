import { describe, expect, it, vi } from 'vitest'
import { LAYOUT_OPTIONS } from 'hooks/use-stored-layout'
import { ZERO_ADDRESS, windowStart } from 'pages/dashboard/data'
import { historySeries } from 'pages/dashboard/view'
import { emptyStats, type AddressStats, type ProfileActivity } from './data'
import type { CurateJury } from './jury'
import {
  ACTIVITY_LAYOUT_OPTIONS,
  activeChains,
  activityLayout,
  activityStatus,
  bucketAxisLabel,
  bucketLabel,
  chainNames,
  challengeRecord,
  coverage,
  filterActivities,
  filterCount,
  formatInt,
  inScope,
  jurorBadge,
  jurorTip,
  otherParty,
  parseFilter,
  parsePage,
  parseScope,
  parseTab,
  profileRoles,
  rangeBuckets,
  registryShares,
  searchActivities,
  type ActivityFilter,
} from './view'

// The wagmi config reads window.location when it loads; these helpers never
// touch a wallet.
vi.mock('config/wagmi', () => ({ wagmiConfig: {} }))

const ETHEREUM = 1
const GNOSIS = 100
const SEPOLIA = 11_155_111
const ME = '0x00000000000000000000000000000000000000e1'
const A = '0x00000000000000000000000000000000000000aa'
const B = '0x00000000000000000000000000000000000000bb'

const DAY = 86_400
// Sunday 22 Nov 2026, 12:00 UTC.
const NOW = Date.UTC(2026, 10, 22, 12) / 1000
const TODAY = Date.UTC(2026, 10, 22) / 1000
const at = (iso: string) => Date.parse(iso) / 1000

const action = (overrides: Partial<ProfileActivity> = {}): ProfileActivity => ({
  id: 'standard-1',
  chainId: ETHEREUM,
  registryAddress: A,
  registryTitle: 'Tokens',
  kind: 'submission',
  status: 'Submitted',
  timestamp: NOW - 3600,
  href: `/tcr/1/${A}/0x01`,
  ...overrides,
})

const stats = (overrides: Partial<AddressStats> = {}): AddressStats => ({
  ...emptyStats(),
  ...overrides,
})

describe('URL parameters', () => {
  it.each([
    ['submission', 'submission'],
    ['removal', 'removal'],
    ['challenge', 'challenge'],
    ['disputed', 'disputed'],
    ['all', 'all'],
    ['bogus', 'all'],
    [null, 'all'],
  ] as const)('reads ?show=%j as %s', (value, filter) => {
    expect(parseFilter(value)).toBe(filter)
  })

  it.each([
    ['governed', 'governed'],
    ['activity', 'activity'],
    ['Governed', 'activity'],
    [null, 'activity'],
  ] as const)('reads ?tab=%j as %s', (value, tab) => {
    expect(parseTab(value)).toBe(tab)
  })

  it.each([
    ['4', 4],
    ['4.9', 4],
    ['0', 1],
    ['-1', 1],
    ['x', 1],
    [null, 1],
  ])('reads ?page=%j as page %i', (value, page) => {
    expect(parsePage(value)).toBe(page)
  })

  it.each([
    ['1', ETHEREUM],
    ['100', GNOSIS],
    ['11155111', SEPOLIA],
    ['137', 'all'],
    ['all', 'all'],
    ['', 'all'],
    [null, 'all'],
  ] as const)('reads ?chain=%j as %s', (value, scope) => {
    expect(parseScope(value)).toBe(scope)
  })

  it('covers one chain, or every mainnet under All chains', () => {
    expect(inScope(GNOSIS, GNOSIS)).toBe(true)
    expect(inScope(GNOSIS, ETHEREUM)).toBe(false)
    expect(inScope(SEPOLIA, ETHEREUM)).toBe(false)
    expect(inScope('all', ETHEREUM)).toBe(true)
    expect(inScope('all', GNOSIS)).toBe(true)
  })
})

describe('the activity layout', () => {
  it.each([
    ['table', 'rows'],
    ['rows', 'rows'],
    ['cards', 'cards'],
  ] as const)(
    'opens a stored %s as %s: the profile has no table',
    (stored, layout) => {
      expect(activityLayout(stored)).toBe(layout)
    },
  )

  it('offers cards and rows as icons, with the shared glyphs', () => {
    expect(ACTIVITY_LAYOUT_OPTIONS).toEqual(
      LAYOUT_OPTIONS.filter((option) => option.value !== 'table').map(
        (option) => ({ ...option, hideLabel: true }),
      ),
    )
  })
})

describe('filters and search', () => {
  const actions = [
    action({ id: 's1' }),
    action({ id: 's2', disputed: true }),
    action({ id: 'r1', kind: 'removal', status: 'Removal requested' }),
    action({
      id: 'c1',
      kind: 'challenge',
      status: 'Challenged',
      disputed: true,
    }),
  ]

  it.each([
    ['all', ['s1', 's2', 'r1', 'c1']],
    ['submission', ['s1', 's2']],
    ['removal', ['r1']],
    ['challenge', ['c1']],
    // Whatever their kind: the actions whose request went to court.
    ['disputed', ['s2', 'c1']],
  ] as const)('shows %s', (filter: ActivityFilter, ids) => {
    expect(filterActivities(actions, filter).map((a) => a.id)).toEqual(ids)
    expect(filterCount(actions, filter)).toBe(ids.length)
  })

  const searched = [
    action({
      id: 'binance',
      entry: { text: 'Binance · Hot Wallet 34' },
      entryFields: ['Address: 0x3f5c…e5a6', 'Project: Binance'],
    }),
    action({
      id: 'pnk',
      chainId: GNOSIS,
      kind: 'challenge',
      status: 'Challenged · case 12',
      disputeID: '12',
      registryTitle: 'Address Tags',
      registryAddress: B,
      entryFields: ['Symbol: PNK'],
      secondaryActor: '0x00000000000000000000000000000000000000c0',
    }),
    action({
      id: 'test',
      chainId: SEPOLIA,
      itemID: '0xfeed',
      registryTitle: 'Practice',
    }),
  ]

  it.each([
    ['binance wallet', ['binance']],
    ['HOT', ['binance']],
    ['binance tags', []],
    ['case 12', ['pnk']],
    ['gnosis', ['pnk']],
    ['pnk', ['pnk']],
    ['address tags', ['pnk']],
    [B.slice(-6), ['pnk']],
    ['c0', ['pnk']],
    ['0xfeed', ['test']],
    ['sepolia', ['test']],
    ['tokens', ['binance']],
  ])('finds %j: every word must match', (query, ids) => {
    expect(searchActivities(searched, query).map((a) => a.id)).toEqual(ids)
  })

  it('returns every action for an empty query', () => {
    expect(searchActivities(searched, '   ')).toBe(searched)
  })
})

describe('activityStatus', () => {
  it.each([
    ['an open request', {}, { resolved: false }, 'window', 'open'],
    [
      'an executed submission',
      {},
      { resolved: true },
      'registered',
      'accepted',
    ],
    [
      'an executed removal',
      { kind: 'removal' },
      { resolved: true },
      'registered',
      'removed',
    ],
    [
      'a request in court',
      {},
      { disputed: true, resolved: false },
      'contested',
      'in court',
    ],
    [
      'a dispute of unknown state',
      {},
      { disputed: true },
      'neutral',
      undefined,
    ],
    [
      'a submission the court accepted',
      {},
      { disputed: true, resolved: true, disputeOutcome: 'Accept' },
      'registered',
      'dispute won',
    ],
    [
      'a submission the court rejected',
      {},
      { disputed: true, resolved: true, disputeOutcome: 'Reject' },
      'off',
      'dispute lost',
    ],
    [
      'a challenge the court upheld',
      { kind: 'challenge' },
      { disputed: true, resolved: true, disputeOutcome: 'Reject' },
      'registered',
      'dispute won',
    ],
    [
      'a challenge the court refused',
      { kind: 'challenge' },
      { disputed: true, resolved: true, disputeOutcome: 'Accept' },
      'off',
      'dispute lost',
    ],
    [
      'a removal the court rejected',
      { kind: 'removal' },
      { disputed: true, resolved: true, disputeOutcome: 'Reject' },
      'off',
      'dispute lost',
    ],
    [
      'a dispute with no ruling',
      {},
      { disputed: true, resolved: true, disputeOutcome: 'None' },
      'neutral',
      'no ruling',
    ],
    [
      'a ruling it cannot read',
      {},
      { disputed: true, resolved: true, disputeOutcome: '7' },
      'neutral',
      'dispute resolved',
    ],
    ['nothing known', {}, {}, 'neutral', undefined],
  ] as const)('dots %s', (_name, kind, state, tone, detail) => {
    const activity = action({
      ...kind,
      ...state,
      status: 'The data’s own words',
    })
    expect(activityStatus(activity)).toEqual({
      tone,
      label: 'The data’s own words',
      detail,
    })
  })
})

describe('otherParty', () => {
  it.each([
    ['the challenger of my request', { actor: ME, secondaryActor: B }, B],
    ['the requester I challenged', { actor: A, secondaryActor: ME }, A],
    [
      'nobody when the other side is the zero address',
      { actor: ME, secondaryActor: ZERO_ADDRESS },
      undefined,
    ],
    ['nobody when the data names none', { actor: ME }, undefined],
  ])('names %s', (_name, parties, other) => {
    expect(otherParty(action(parties), ME)).toBe(other)
  })
})

describe('coverage', () => {
  it('spans the dated actions only', () => {
    const actions = [
      action({ timestamp: 0 }),
      action({ timestamp: 500 }),
      action({ timestamp: 100 }),
      action({ timestamp: -5 }),
    ]
    expect(coverage(actions)).toEqual({ oldest: 100, newest: 500 })
    expect(coverage([action({ timestamp: 0 })])).toBeUndefined()
    expect(coverage([])).toBeUndefined()
  })
})

describe('activeChains', () => {
  it('lists the chains the address acted or governs on, busiest first', () => {
    const chains = activeChains({
      [ETHEREUM]: stats({ activity: 3 }),
      [GNOSIS]: stats({ governedLists: 1 }),
      [SEPOLIA]: stats({ activity: 9 }),
      137: stats(),
    })
    expect(chains.map(({ chainId }) => chainId)).toEqual([
      SEPOLIA,
      ETHEREUM,
      GNOSIS,
    ])
    expect(activeChains(undefined)).toEqual([])
  })
})

describe('chainNames', () => {
  it.each([
    [[ETHEREUM], 'Ethereum'],
    [[ETHEREUM, GNOSIS], 'Ethereum and Gnosis'],
    [[137], 'Chain 137'],
  ])('names %j “%s”', (chainIds, text) => {
    expect(chainNames(chainIds)).toBe(text)
  })

  // Regression: the comment over chainNames promises "Ethereum, Gnosis
  // and Sepolia", as Browse (en-GB) and the dashboard write lists, but the
  // formatter is Intl.ListFormat('en'), which adds a serial comma: "Ethereum,
  // Gnosis, and Sepolia". profile.tsx shows it in the quiet line of an
  // address with no action under All chains.
  it('names three chains without a serial comma', () => {
    expect(chainNames([ETHEREUM, GNOSIS, SEPOLIA])).toBe(
      'Ethereum, Gnosis and Sepolia',
    )
  })

  it('groups a figure’s thousands', () => {
    expect(formatInt(10_000)).toBe('10,000')
    expect(formatInt(2.6)).toBe('3')
  })
})

describe('Juror on Curate', () => {
  const jury: CurateJury = {
    chains: {
      [ETHEREUM]: { seats: 3, cases: 2, votes: 2, voting: 1, capped: false },
      [GNOSIS]: {
        seats: 5,
        cases: 4,
        votes: undefined,
        voting: 0,
        capped: true,
      },
      [SEPOLIA]: { seats: 50, cases: 9, votes: 40, voting: 0, capped: false },
    },
    unreadChains: [],
  }

  it('adds the mainnets under All chains, never Sepolia’s practice seats', () => {
    expect(jurorBadge(jury, 'all', false)).toEqual({
      state: 'ready',
      seats: 8,
      cases: 6,
      votes: undefined,
      voting: 1,
      unread: [],
      capped: [GNOSIS],
      votesUnread: [GNOSIS],
    })
  })

  it('shows Sepolia’s own seats when it is picked', () => {
    expect(jurorBadge(jury, SEPOLIA, false)).toMatchObject({
      state: 'ready',
      seats: 50,
      cases: 9,
      votes: 40,
    })
  })

  it('counts the votes when every chain’s could be read', () => {
    expect(jurorBadge(jury, ETHEREUM, false)).toMatchObject({
      seats: 3,
      votes: 2,
      votesUnread: [],
      capped: [],
    })
  })

  it('names a chain that was not read rather than count it as zero', () => {
    const partial: CurateJury = {
      chains: { [ETHEREUM]: jury.chains[ETHEREUM] },
      unreadChains: [GNOSIS],
    }
    expect(jurorBadge(partial, 'all', false)).toMatchObject({
      state: 'ready',
      seats: 3,
      unread: [GNOSIS],
    })
  })

  it('is unavailable, never 0, when nothing in the scope was read', () => {
    const none: CurateJury = { chains: {}, unreadChains: [ETHEREUM, GNOSIS] }
    expect(jurorBadge(none, 'all', false)).toMatchObject({
      state: 'unavailable',
      unread: [ETHEREUM, GNOSIS],
    })
    expect(jurorBadge(undefined, 'all', false).state).toBe('unavailable')
    expect(jurorBadge(undefined, 'all', true).state).toBe('loading')
  })

  it('explains itself in one sentence, adding the cap only where it bit', () => {
    expect(jurorTip(jurorBadge(jury, ETHEREUM, false))).toBe(
      'Seats and votes as a Kleros juror in Curate disputes, Classic lists included.',
    )
    expect(jurorTip(jurorBadge(jury, 'all', false))).toBe(
      'Seats and votes as a Kleros juror in Curate disputes, Classic lists included. On Gnosis the read stops at 10,000 seats.',
    )
  })
})

describe('profileRoles', () => {
  it.each([
    [
      { acted: true, governs: true, judges: true },
      ['Curator', 'Governor', 'Juror'],
    ],
    [{ acted: false, governs: false, judges: true }, ['Juror']],
    [{ acted: true, governs: false, judges: true }, ['Curator', 'Juror']],
    [{ acted: false, governs: false, judges: false }, []],
  ])('names %j as %j', (roles, names) => {
    expect(profileRoles(roles)).toEqual(names)
  })
})

describe('bucket labels', () => {
  const start = at('2026-10-08T14:00:00Z')

  it.each([
    ['hour', '8 Oct, 14:00 UTC', '14:00'],
    ['day', '8 Oct 2026', '8 Oct'],
    ['week', 'Week of 8 Oct 2026', '8 Oct'],
    ['month', 'Oct 2026', 'Oct 2026'],
  ] as const)('labels a %s “%s”, “%s” on the axis', (unit, label, axis) => {
    expect(bucketLabel(start, unit)).toBe(label)
    expect(bucketAxisLabel(start, unit)).toBe(axis)
  })
})

describe('rangeBuckets', () => {
  const sum = (values: number[]) => values.reduce((total, n) => total + n, 0)

  it('draws 30 UTC days, today so far included, from the dashboard’s window start', () => {
    const buckets = rangeBuckets([action()], '30d', NOW, true)
    expect(buckets?.unit).toBe('day')
    expect(buckets?.starts).toHaveLength(30)
    expect(buckets?.starts.at(-1)).toBe(TODAY)
    expect(buckets?.starts[0]).toBe(TODAY - 29 * DAY)
    expect(buckets?.starts[0]).toBe(windowStart(NOW))
  })

  it.each(['6m', '1y', '3y'] as const)(
    'draws %s in the dashboard’s own buckets',
    (range) => {
      const buckets = rangeBuckets([action()], range, NOW, true)
      expect(buckets?.starts).toEqual(historySeries([], range, NOW).starts)
    },
  )

  it('counts requests and challenges in the bucket they were made in', () => {
    const buckets = rangeBuckets(
      [
        action({ timestamp: NOW - 60 }),
        action({ kind: 'removal', timestamp: TODAY - 1 }),
        action({ kind: 'challenge', timestamp: TODAY }),
        action({ timestamp: TODAY - 29 * DAY }),
        // Before the window, in the future, and undated.
        action({ timestamp: TODAY - 29 * DAY - 1 }),
        action({ timestamp: NOW + 60 }),
        action({ timestamp: 0 }),
      ],
      '30d',
      NOW,
      true,
    )
    expect(buckets?.requests.at(-1)).toBe(1)
    expect(buckets?.requests.at(-2)).toBe(1)
    expect(buckets?.requests[0]).toBe(1)
    expect(buckets?.challenges.at(-1)).toBe(1)
    expect(sum(buckets?.requests ?? [])).toBe(3)
    expect(sum(buckets?.challenges ?? [])).toBe(1)
    expect(buckets?.cut).toBe(false)
  })

  it('draws zeros for an address with actions, none in the range', () => {
    const buckets = rangeBuckets(
      [action({ timestamp: NOW - 400 * DAY })],
      '30d',
      NOW,
      true,
    )
    expect(buckets?.starts).toHaveLength(30)
    expect(sum(buckets?.requests ?? [])).toBe(0)
  })

  it('draws nothing for an address with no dated action', () => {
    expect(rangeBuckets([], '3y', NOW, true)).toBeUndefined()
    expect(
      rangeBuckets([action({ timestamp: 0 })], '30d', NOW, true),
    ).toBeUndefined()
    expect(
      rangeBuckets([action({ timestamp: NOW + DAY })], '30d', NOW, true),
    ).toBeUndefined()
  })

  it('starts a cut list at the bucket after the cut, drawing no short count', () => {
    const oldest = TODAY - 10 * DAY + 3600
    const buckets = rangeBuckets(
      [action({ timestamp: oldest }), action({ timestamp: NOW - 60 })],
      '30d',
      NOW,
      false,
    )
    expect(buckets?.cut).toBe(true)
    expect(buckets?.starts[0]).toBe(TODAY - 9 * DAY)
    expect(buckets?.starts).toHaveLength(10)
    expect(sum(buckets?.requests ?? [])).toBe(1)
    expect(buckets?.partialFrom).toBeUndefined()
  })

  it('keeps the cut bucket, marked partial, rather than draw a single bucket', () => {
    const oldest = TODAY - DAY + 9.5 * 3600
    const buckets = rangeBuckets(
      [action({ timestamp: oldest })],
      '30d',
      NOW,
      false,
    )
    expect(buckets?.starts).toEqual([TODAY - DAY, TODAY])
    expect(buckets?.partialFrom).toBe(oldest)
    expect(buckets?.labels[0]).toBe('21 Nov 2026 · listed from 09:30 UTC')
    expect(buckets?.requests).toEqual([1, 0])
  })

  it('names the day and time a cut week is listed from', () => {
    const oldest = at('2026-11-10T08:15:00Z')
    const buckets = rangeBuckets(
      [action({ timestamp: oldest })],
      '6m',
      NOW,
      false,
    )
    expect(buckets?.starts).toEqual([
      at('2026-11-09T00:00:00Z'),
      at('2026-11-16T00:00:00Z'),
    ])
    expect(buckets?.labels[0]).toBe(
      'Week of 9 Nov 2026 · listed from 10 Nov, 08:15 UTC',
    )
  })

  it('draws a cut list whole when the cut is older than the range', () => {
    const buckets = rangeBuckets(
      [action({ timestamp: NOW - 60 * DAY }), action()],
      '30d',
      NOW,
      false,
    )
    expect(buckets?.cut).toBe(false)
    expect(buckets?.starts).toHaveLength(30)
  })

  it('draws nothing when a cut leaves a single bucket', () => {
    expect(rangeBuckets([action()], '30d', NOW, false)).toBeUndefined()
  })
})

describe('registryShares', () => {
  it('ranks the lists the actions touch, busiest first, a list per chain', () => {
    const shares = registryShares([
      action({ registryAddress: A }),
      action({
        registryAddress: B,
        registryTitle: 'Tags',
        registryVerified: true,
      }),
      action({ registryAddress: A }),
      action({ chainId: GNOSIS, registryAddress: A }),
      action({ registryAddress: B, registryTitle: 'Tags' }),
      action({ registryAddress: B, registryTitle: 'Tags' }),
    ])
    expect(shares.map(({ key, count }) => [key, count])).toEqual([
      [`1:${B}`, 3],
      [`1:${A}`, 2],
      [`100:${A}`, 1],
    ])
    expect(shares[0]).toMatchObject({
      title: 'Tags',
      href: `/tcr/1/${B}`,
      verified: true,
    })
  })
})

describe('challengeRecord', () => {
  it('splits the challenges into decided and in court', () => {
    expect(
      challengeRecord(
        stats({
          successfulChallenges: 3,
          challengesLost: 2,
          challengesNoRuling: 1,
          challengesInCourt: 4,
        }),
      ),
    ).toEqual({
      won: 3,
      lost: 2,
      noRuling: 1,
      inCourt: 4,
      decided: 6,
      total: 10,
    })
  })
})
