import { describe, expect, it } from 'vitest'
import type {
  DashboardActivity,
  DashboardRegistry,
} from 'pages/dashboard/types'
import {
  VERIFICATION_CHAIN_IDS,
  activityTone,
  chainName,
  entryCount,
  filterRegistries,
  hasAddressTitle,
  inScope,
  kindLabel,
  listOfListsHref,
  mediaUrl,
  openRequests,
  parseChains,
  parseKinds,
  parsePage,
  parseSort,
  parseTrust,
  pendingLabel,
  registryBlurb,
  scopeChainIds,
  scopeText,
  shownCreation,
  sortRegistries,
  summarize,
  trustParam,
  verificationHref,
  verifiedShowcase,
  type BrowseSort,
  type TrustMode,
} from './view'

const ETHEREUM = 1
const GNOSIS = 100
const SEPOLIA = 11_155_111

const LIST_OF_LISTS: Record<number, string> = {
  [ETHEREUM]: '0x2acf59a420ca888f46d46974f62570f8a38cd4da',
  [GNOSIS]: '0x5f688a4bac5e2787ef1d9de325831e537ee4cffa',
  [SEPOLIA]: '0xd965ce430afe0423ff19a5eb08f7c5722efabcaf',
}
const FORMER_GNOSIS = '0x2418d887d0d0fe03b793a6af4321fa488226a0b5'

let next = 0
const registry = (
  overrides: Partial<DashboardRegistry> = {},
): DashboardRegistry => {
  next += 1
  const address = `0x${next.toString(16).padStart(40, '0')}`
  return {
    id: address,
    address,
    chainId: ETHEREUM,
    kind: 'standard',
    title: `List ${next}`,
    itemCount: 1,
    activeCount: 0,
    pendingCount: 0,
    disputeCount: 0,
    trustStatus: 'unverified',
    ...overrides,
  }
}

describe('chain scope', () => {
  it('means Ethereum and Gnosis when no chain is chosen', () => {
    expect(scopeChainIds([])).toEqual([ETHEREUM, GNOSIS])
    expect(inScope([], SEPOLIA)).toBe(false)
    expect(inScope([], GNOSIS)).toBe(true)
  })

  it('takes Sepolia only when it is picked, on its own or beside others', () => {
    expect(scopeChainIds([SEPOLIA])).toEqual([SEPOLIA])
    expect(inScope([SEPOLIA], SEPOLIA)).toBe(true)
    expect(inScope([SEPOLIA], ETHEREUM)).toBe(false)
    expect(inScope([ETHEREUM, SEPOLIA], SEPOLIA)).toBe(true)
  })

  it.each([
    [[], 'Ethereum and Gnosis'],
    [[GNOSIS], 'Gnosis'],
    [[SEPOLIA], 'the Sepolia testnet'],
    [[ETHEREUM, GNOSIS, SEPOLIA], 'Ethereum, Gnosis and the Sepolia testnet'],
  ])('names the scope %j “%s”', (chains, text) => {
    expect(scopeText(chains)).toBe(text)
  })

  it('names a chain it does not know by its id', () => {
    expect(chainName(GNOSIS)).toBe('Gnosis')
    expect(chainName(137)).toBe('Chain 137')
  })
})

describe('URL parameters', () => {
  it.each([
    ['1,100', [ETHEREUM, GNOSIS]],
    ['11155111', [SEPOLIA]],
    ['1,137,abc,100', [ETHEREUM, GNOSIS]],
    ['', []],
    [null, []],
  ])('reads ?chain=%j as %j', (value, chains) => {
    expect(parseChains(value)).toEqual(chains)
  })

  it.each([
    [null, 'verified'],
    ['community', 'community'],
    // Links from before the Community name.
    ['unverified', 'community'],
    ['all', 'all'],
    ['verified', 'verified'],
    ['discovery', 'verified'],
  ] as const)('reads ?trust=%s as %s', (value, mode) => {
    expect(parseTrust(value)).toBe(mode)
  })

  it.each([
    ['verified', null],
    ['community', 'community'],
    ['all', 'all'],
  ] as const)('writes the %s mode as ?trust=%s', (mode, param) => {
    expect(trustParam(mode)).toBe(param)
    expect(parseTrust(param)).toBe(mode)
  })

  it.each([
    ['standard,permanent', ['standard', 'permanent']],
    // Standard lists were called Light until Nov 2026.
    ['light', ['standard']],
    ['light,standard,permanent,light', ['standard', 'permanent']],
    ['classic,stake', []],
    [null, []],
  ])('reads ?kind=%j as %j', (value, kinds) => {
    expect(parseKinds(value)).toEqual(kinds)
  })

  it.each([
    ['items', 'items'],
    ['name', 'name'],
    ['recent-creation', 'recent-creation'],
    ['bogus', 'recent-submission'],
    [null, 'recent-submission'],
  ])('reads ?sort=%j as %s', (value, sort) => {
    expect(parseSort(value)).toBe(sort)
  })

  it.each([
    ['3', 3],
    ['2.7', 2],
    ['0', 1],
    ['-4', 1],
    ['abc', 1],
    [null, 1],
  ])('reads ?page=%j as page %i', (value, page) => {
    expect(parsePage(value)).toBe(page)
  })
})

describe('getting Kleros Verified', () => {
  it('is offered on every chain with a Standard list of lists', () => {
    expect([...VERIFICATION_CHAIN_IDS].sort((a, b) => a - b)).toEqual([
      ETHEREUM,
      GNOSIS,
      SEPOLIA,
    ])
  })

  it.each([ETHEREUM, GNOSIS, SEPOLIA])(
    'links chain %i’s list of lists and its submission form',
    (chainId) => {
      const list = `/tcr/${chainId}/${LIST_OF_LISTS[chainId]}`
      expect(listOfListsHref(chainId)?.toLowerCase()).toBe(list)
      expect(verificationHref(chainId)?.toLowerCase()).toBe(`${list}/submit`)
    },
  )

  it('links nothing on a chain with no list of lists', () => {
    expect(listOfListsHref(137)).toBeNull()
    expect(verificationHref(137)).toBeNull()
  })
})

describe('registry figures', () => {
  it('counts every entry a list holds, as its own page does', () => {
    expect(entryCount(registry({ itemCount: 4, pendingCount: 2 }))).toBe(6)
    expect(
      entryCount(
        registry({ kind: 'permanent', itemCount: 4, pendingCount: 2 }),
      ),
    ).toBe(4)
  })

  it('never calls a Stake list’s listed entries open requests', () => {
    expect(openRequests(registry({ pendingCount: 3 }))).toBe(3)
    expect(openRequests(registry({ kind: 'permanent', pendingCount: 3 }))).toBe(
      0,
    )
    expect(pendingLabel('permanent')).toBe('Listed')
    expect(pendingLabel('standard')).toBe('Open requests')
  })

  it('names the two kinds Standard and Stake', () => {
    expect(kindLabel('standard')).toBe('Standard')
    expect(kindLabel('permanent')).toBe('Stake')
  })

  it.each([
    ['List 0x12ab…cdef', true],
    ['Stake list 0x12AB...CDEF', true],
    ['List 0x12ab…cdef v2', false],
    ['Token list 0x12ab…cdef', false],
    ['Tokens', false],
  ])('knows “%s” is a title that is only an address: %s', (title, expected) => {
    expect(hasAddressTitle(registry({ title }))).toBe(expected)
  })

  it.each([
    [undefined, null],
    ['', null],
    ['-', null],
    ['...', null],
    [' — ', null],
    ['  Verified tokens. ', 'Verified tokens.'],
  ])('shows the description %j as %j', (description, blurb) => {
    expect(registryBlurb(registry({ description }))).toBe(blurb)
  })

  it('shows a creation date only while sorting by newest, and only an exact one', () => {
    const exact = registry({ createdAt: 1000, createdAtExact: true })
    const guessed = registry({ createdAt: 1000, createdAtExact: false })
    expect(shownCreation(exact, 'recent-creation')).toBe(1000)
    expect(shownCreation(exact, 'recent-submission')).toBeNull()
    expect(shownCreation(guessed, 'recent-creation')).toBeNull()
  })

  it('reads a logo through the IPFS gateway only', () => {
    expect(mediaUrl('/ipfs/QmLogo/logo.png')).toBe(
      'https://cdn.kleros.link/ipfs/QmLogo/logo.png',
    )
    expect(mediaUrl('https://example.com/logo.png')).toBeNull()
    expect(mediaUrl(undefined)).toBeNull()
  })
})

describe('filterRegistries', () => {
  const verified = registry({ trustStatus: 'verified', title: 'Tokens' })
  const listOfLists = registry({
    address: LIST_OF_LISTS[GNOSIS],
    chainId: GNOSIS,
    trustStatus: 'verified',
  })
  const community = registry({
    chainId: GNOSIS,
    kind: 'permanent',
    title: 'Ledger',
  })
  const former = registry({ address: FORMER_GNOSIS, chainId: GNOSIS })
  const unknown = registry({ trustStatus: 'unknown' })
  const testnet = registry({ chainId: SEPOLIA, trustStatus: 'verified' })
  const all = [verified, listOfLists, community, former, unknown, testnet]

  const shown = (trust: TrustMode, chains: number[] = [], search = '') =>
    filterRegistries(all, { chains, trust, kinds: [], search })

  it('shows the Kleros Verified lists by default, not the lists of lists', () => {
    expect(shown('verified')).toEqual([verified])
  })

  it('shows every other list under Community, not the former list of lists', () => {
    expect(shown('community')).toEqual([community])
  })

  it('shows the lists of lists and lists not known yet under All only', () => {
    expect(shown('all')).toEqual([
      verified,
      listOfLists,
      community,
      former,
      unknown,
    ])
  })

  it('keeps Sepolia apart from "All chains"', () => {
    expect(shown('all', [SEPOLIA])).toEqual([testnet])
    expect(shown('verified', [ETHEREUM, SEPOLIA])).toEqual([verified, testnet])
  })

  it('narrows by kind', () => {
    expect(
      filterRegistries(all, {
        chains: [],
        trust: 'all',
        kinds: ['permanent'],
        search: '',
      }),
    ).toEqual([community])
  })

  it.each([
    ['tokens', [verified]],
    ['  LEDGER ', [community]],
    ['stake', [community]],
    // Standard lists were called Light: the old name still finds them.
    ['light', [verified, listOfLists, former, unknown]],
    ['gnosis', [listOfLists, community, former]],
    [
      LIST_OF_LISTS[GNOSIS].slice(0, 12).toUpperCase().replace('0X', '0x'),
      [listOfLists],
    ],
  ])('finds %j', (search, found) => {
    expect(shown('all', [], search)).toEqual(found)
  })
})

describe('sortRegistries', () => {
  const empty = registry({
    title: 'Empty',
    itemCount: 0,
    lastActivityAt: 900,
    createdAt: 1000,
  })
  const busy = registry({
    title: 'Busy',
    itemCount: 10,
    pendingCount: 5,
    disputeCount: 1,
    lastActivityAt: 100,
    createdAt: 50,
  })
  const stake = registry({
    title: 'Stake',
    kind: 'permanent',
    itemCount: 40,
    pendingCount: 40,
    disputeCount: 3,
    lastActivityAt: 300,
    createdAt: 300,
  })
  const quiet = registry({
    title: 'Alpha',
    itemCount: 2,
    lastActivityAt: 200,
    createdAt: 200,
  })
  const lists = [empty, busy, stake, quiet]
  const titles = (sort: BrowseSort) =>
    sortRegistries(lists, sort).map((list) => list.title)

  it.each([
    ['recent-submission', ['Stake', 'Alpha', 'Busy', 'Empty']],
    ['activity', ['Busy', 'Stake', 'Alpha', 'Empty']],
    ['items', ['Stake', 'Busy', 'Alpha', 'Empty']],
    ['disputes', ['Stake', 'Busy', 'Alpha', 'Empty']],
  ] as const)(
    'puts lists with no entry last when sorting by %s',
    (sort, order) => {
      expect(titles(sort)).toEqual(order)
    },
  )

  it('keeps the order the reader asked for by name or by creation', () => {
    expect(titles('name')).toEqual(['Alpha', 'Busy', 'Empty', 'Stake'])
    expect(titles('recent-creation')).toEqual([
      'Empty',
      'Stake',
      'Alpha',
      'Busy',
    ])
  })
})

describe('summarize', () => {
  it('counts the scope’s lists, entries and open requests', () => {
    const lists = [
      registry({ trustStatus: 'verified', itemCount: 3, pendingCount: 1 }),
      registry({
        address: LIST_OF_LISTS[ETHEREUM],
        trustStatus: 'verified',
        itemCount: 20,
      }),
      registry({
        chainId: GNOSIS,
        kind: 'permanent',
        itemCount: 5,
        pendingCount: 5,
      }),
      registry({ address: FORMER_GNOSIS, chainId: GNOSIS, itemCount: 6 }),
      registry({ chainId: GNOSIS, trustStatus: 'unknown', itemCount: 1 }),
      registry({ chainId: SEPOLIA, trustStatus: 'verified', itemCount: 100 }),
    ]
    expect(summarize(lists, [])).toEqual({
      verified: 1,
      community: 1,
      entries: 4 + 20 + 5 + 6 + 1,
      openRequests: 1,
    })
    expect(summarize(lists, [SEPOLIA])).toEqual({
      verified: 1,
      community: 0,
      entries: 100,
      openRequests: 0,
    })
  })
})

describe('verifiedShowcase', () => {
  it('shows the Verified lists in scope, most open requests first', () => {
    const few = registry({
      trustStatus: 'verified',
      pendingCount: 1,
      title: 'Few',
    })
    const many = registry({
      trustStatus: 'verified',
      pendingCount: 9,
      title: 'Many',
    })
    const lists = [
      few,
      registry({
        address: LIST_OF_LISTS[ETHEREUM],
        trustStatus: 'verified',
        pendingCount: 99,
      }),
      registry({ pendingCount: 50 }),
      many,
      registry({ chainId: SEPOLIA, trustStatus: 'verified', pendingCount: 70 }),
      registry({ chainId: GNOSIS, trustStatus: 'verified', title: 'Quiet' }),
    ]
    expect(verifiedShowcase(lists, [], 10).map((list) => list.title)).toEqual([
      'Many',
      'Few',
      'Quiet',
    ])
    expect(verifiedShowcase(lists, [], 1)).toEqual([many])
  })
})

describe('activityTone', () => {
  const activity = (
    overrides: Partial<DashboardActivity>,
  ): DashboardActivity => ({
    id: 'a',
    chainId: ETHEREUM,
    registryAddress: LIST_OF_LISTS[ETHEREUM],
    registryTitle: 'List',
    kind: 'submission',
    status: 'Submitted',
    timestamp: 0,
    href: '/',
    ...overrides,
  })

  it.each([
    [{ kind: 'submission' }, 'window'],
    [{ kind: 'removal' }, 'window'],
    [{ kind: 'challenge' }, 'contested'],
    [{ kind: 'resolution', outcome: 'registered' }, 'registered'],
    [{ kind: 'resolution', outcome: 'kept' }, 'registered'],
    [{ kind: 'resolution', outcome: 'removed' }, 'off'],
    [{ kind: 'resolution', outcome: 'rejected' }, 'off'],
    [{ kind: 'resolution', outcome: 'no-ruling' }, 'neutral'],
  ] as const)('tones %j as %s', (overrides, tone) => {
    expect(activityTone(activity(overrides))).toBe(tone)
  })
})
