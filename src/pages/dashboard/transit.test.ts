import { beforeEach, describe, expect, it, vi } from 'vitest'
import { request } from 'utils/indexer-request'
import { readUsdPrices, type UsdPrice } from './prices'
import { keptRead } from './saved-load'
import { readTokens } from './tokens'
import {
  bountyTotals,
  readTransit,
  totalInDollars,
  type CoinTotal,
} from './transit'
import type { DashboardData, RulingRow, TokenInfo } from './types'

vi.mock('utils/indexer-request', () => ({ request: vi.fn() }))
vi.mock('./saved-load', () => ({ keptRead: vi.fn() }))
vi.mock('./tokens', () => ({ readTokens: vi.fn() }))
vi.mock('./prices', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./prices')>()),
  readUsdPrices: vi.fn(),
}))

const ETHEREUM = 1
const GNOSIS = 100
const SEPOLIA = 11_155_111
const ETH = 10n ** 18n

const STETH = '0xae7ab96520de3a18e5e111b5eaab095312d7fe84'
const SDAI = '0xaf204776c7245bf4147c2612bf6e5972ee483701'
const WXDAI = '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d'
const ANY_TOKEN = '0x1111111111111111111111111111111111111111'

/* ---------- The indexers ---------- */

type Round = { amountPaidRequester: string; amountPaidChallenger: string }
type Rows = {
  standard?: { rounds: Round[] }[]
  classic?: { rounds: Round[] }[]
  submissions?: {
    initialStake: string
    arbitrationDeposit: string | null
    item: { registry: { token: string } | null } | null
  }[]
  challenges?: {
    challengerStake: string
    rounds: Round[]
    item: { registry: { token: string } | null } | null
  }[]
}

const round = (requester: string, challenger = '0'): Round => ({
  amountPaidRequester: requester,
  amountPaidChallenger: challenger,
})

const listOf = (token: string) => ({ registry: { token } })

const STANDARD = (chainId: number) => `https://standard.indexer.test/${chainId}`
const STAKE = (chainId: number) => `https://stake.indexer.test/${chainId}`

const readOf = (document: string): keyof Rows => {
  if (document.includes('rows: LRequest(')) return 'standard'
  if (document.includes('rows: Request(')) return 'classic'
  if (document.includes('rows: submissions(')) return 'submissions'
  if (document.includes('rows: challenges(')) return 'challenges'
  throw new Error(`unexpected query: ${document}`)
}

/** A call to request(), in either of its forms. */
interface Asked {
  url: string
  document: string
  variables: { offset?: number; skip?: number }
  lane?: string
}

const askedIn = (args: unknown[]): Asked =>
  typeof args[0] === 'string'
    ? {
        url: args[0],
        document: args[1] as string,
        variables: args[2] as Asked['variables'],
      }
    : (args[0] as Asked)

/** Both indexers of every chain, served a page of 1,000 rows at a time. */
const indexers = (
  byChain: Record<number, Rows>,
  fail?: (call: { url: string; read: keyof Rows; first: number }) => boolean,
) =>
  vi.mocked(request).mockImplementation((async (...args: unknown[]) => {
    const { url, document, variables } = askedIn(args)
    const chainId = Number(url.split('/').pop())
    const read = readOf(document)
    const standardRead = read === 'standard' || read === 'classic'
    expect(url).toBe(standardRead ? STANDARD(chainId) : STAKE(chainId))
    const first = variables.offset ?? variables.skip ?? 0
    if (fail?.({ url, read, first })) throw new Error('indexer down')
    const rows = byChain[chainId]?.[read] ?? []
    return { rows: rows.slice(first, first + 1000) }
  }) as never)

const calls = () =>
  vi.mocked(request).mock.calls.map((args) => {
    const { url, document, variables } = askedIn(args)
    return {
      url,
      read: readOf(document),
      first: variables.offset ?? variables.skip,
    }
  })

beforeEach(() => {
  vi.mocked(keptRead).mockImplementation((_name, _maxAgeMs, read) => read())
})

describe('readTransit', () => {
  it('adds both sides of every round of every request, Classic lists too', async () => {
    indexers({
      [ETHEREUM]: {
        standard: [
          { rounds: [round('100', '50'), round('7', '3')] },
          { rounds: [round('10')] },
        ],
        classic: [{ rounds: [round('1000', '1000')] }],
      },
    })
    const transit = await readTransit([ETHEREUM])
    expect(transit.totals).toEqual({
      '1:native': { chainId: ETHEREUM, amount: 2170n },
    })
    // Two Standard requests and a Classic one.
    expect(transit.requests).toBe(3)
  })

  it('adds a Stake list’s stakes in its token, and what the court takes in the chain’s coin', async () => {
    indexers({
      [GNOSIS]: {
        standard: [{ rounds: [round('1')] }],
        submissions: [
          {
            initialStake: '500',
            arbitrationDeposit: '20',
            item: listOf(SDAI.toUpperCase().replace('0X', '0x')),
          },
          { initialStake: '300', arbitrationDeposit: null, item: listOf(SDAI) },
        ],
        challenges: [
          {
            challengerStake: '400',
            rounds: [round('9', '11')],
            item: listOf(ANY_TOKEN),
          },
        ],
      },
    })
    const transit = await readTransit([GNOSIS])
    expect(transit.totals).toEqual({
      '100:native': { chainId: GNOSIS, amount: 1n + 20n + 9n + 11n },
      [`100:${SDAI}`]: { chainId: GNOSIS, token: SDAI, amount: 800n },
      [`100:${ANY_TOKEN}`]: { chainId: GNOSIS, token: ANY_TOKEN, amount: 400n },
    })
    // A Standard request and two Stake submissions; challenges are not requests.
    expect(transit.requests).toBe(3)
  })

  it('keeps each chain’s coins apart', async () => {
    indexers({
      [ETHEREUM]: { standard: [{ rounds: [round('5')] }] },
      [GNOSIS]: { standard: [{ rounds: [round('7')] }] },
    })
    const transit = await readTransit([ETHEREUM, GNOSIS])
    expect(transit.totals).toEqual({
      '1:native': { chainId: ETHEREUM, amount: 5n },
      '100:native': { chainId: GNOSIS, amount: 7n },
    })
  })

  it('never reads a testnet', async () => {
    indexers({})
    await readTransit([ETHEREUM, GNOSIS, SEPOLIA])
    expect(calls().some(({ url }) => url.includes(String(SEPOLIA)))).toBe(false)
    expect(keptRead).toHaveBeenCalledWith(
      'transit:1,100',
      60 * 60_000,
      expect.any(Function),
    )
  })

  it("walks its pages in the indexer's background lane", async () => {
    indexers({ [GNOSIS]: { standard: [{ rounds: [round('1')] }] } })
    await readTransit([GNOSIS])
    const lanes = vi
      .mocked(request)
      .mock.calls.map((args) => askedIn(args).lane)
    expect(lanes.length).toBeGreaterThan(0)
    expect(new Set(lanes)).toEqual(new Set(['background']))
  })

  it('reads every page until one comes back short', async () => {
    const standard = Array.from({ length: 6001 }, () => ({
      rounds: [round('2')],
    }))
    indexers({ [ETHEREUM]: { standard } })
    const transit = await readTransit([ETHEREUM])
    expect(transit.requests).toBe(6001)
    expect(transit.totals['1:native'].amount).toBe(12_002n)
    const firsts = calls()
      .filter(({ read }) => read === 'standard')
      .map(({ first }) => first)
    expect(firsts).toContain(6000)
  })

  it('reads a Stake table a page at a time: it takes no batches', async () => {
    const submissions = Array.from({ length: 1500 }, () => ({
      initialStake: '1',
      arbitrationDeposit: null,
      item: listOf(SDAI),
    }))
    indexers({ [GNOSIS]: { submissions } })
    const transit = await readTransit([GNOSIS])
    expect(transit.totals[`100:${SDAI}`].amount).toBe(1500n)
    const asked = (read: string) =>
      calls()
        .filter((call) => call.read === read)
        .map(({ first }) => first)
    expect(asked('submissions')).toEqual([0, 1000])
    expect(asked('challenges')).toEqual([0])
  })

  it('asks a page that failed once more, on its own', async () => {
    let failed = false
    indexers(
      { [ETHEREUM]: { standard: [{ rounds: [round('5')] }] } },
      ({ read, first }) => {
        if (read !== 'standard' || first !== 0 || failed) return false
        failed = true
        return true
      },
    )
    const transit = await readTransit([ETHEREUM])
    expect(transit.totals['1:native'].amount).toBe(5n)
    const firstPage = calls().filter(
      ({ read, first }) => read === 'standard' && first === 0,
    )
    expect(firstPage).toHaveLength(2)
    // Only that page: the rest of the read is not walked again.
    const secondPage = calls().filter(
      ({ read, first }) => read === 'standard' && first === 1000,
    )
    expect(secondPage).toHaveLength(1)
  })

  it('fails when a page fails twice: part of the total is not the whole', async () => {
    indexers(
      { [GNOSIS]: { standard: [{ rounds: [round('5')] }] } },
      ({ read, first }) => read === 'challenges' && first === 0,
    )
    await expect(readTransit([ETHEREUM, GNOSIS])).rejects.toThrow(
      'indexer down',
    )
  })

  it('fails on a Stake row that does not name its list’s token', async () => {
    indexers({
      [GNOSIS]: {
        submissions: [
          {
            initialStake: '5',
            arbitrationDeposit: '1',
            item: { registry: null },
          },
        ],
      },
    })
    await expect(readTransit([GNOSIS])).rejects.toThrow(/list token/)
  })

  it('counts an amount the indexer sent unreadably as none', async () => {
    indexers({
      [ETHEREUM]: {
        standard: [{ rounds: [round('1e+21', '2.5'), round('-3')] }],
      },
    })
    const transit = await readTransit([ETHEREUM])
    expect(transit.totals).toEqual({})
    expect(transit.requests).toBe(1)
  })

  it('keeps the totals as decimal strings, and reads them back as bigints', async () => {
    indexers({ [ETHEREUM]: { standard: [{ rounds: [round('123')] }] } })
    let kept: unknown
    vi.mocked(keptRead).mockImplementation(async (_name, _maxAgeMs, read) => {
      kept = await read()
      return kept as never
    })
    const transit = await readTransit([ETHEREUM])
    expect(JSON.parse(JSON.stringify(kept))).toEqual({
      requests: 1,
      totals: { '1:native': { chainId: ETHEREUM, amount: '123' } },
    })
    expect(transit.totals['1:native'].amount).toBe(123n)
  })

  it('prices a kept read again without walking the pages', async () => {
    vi.mocked(keptRead).mockResolvedValue({
      requests: 33_667,
      totals: {
        '1:native': {
          chainId: ETHEREUM,
          amount: '123456789012345678901234567890',
        },
      },
    } as never)
    const transit = await readTransit([ETHEREUM, GNOSIS])
    expect(request).not.toHaveBeenCalled()
    expect(transit).toEqual({
      requests: 33_667,
      totals: {
        '1:native': {
          chainId: ETHEREUM,
          amount: 123_456_789_012_345_678_901_234_567_890n,
        },
      },
    })
  })
})

/* ---------- Bounties ---------- */

const ruling = (overrides: Partial<RulingRow> = {}): RulingRow => ({
  id: 'standard-1',
  chainId: ETHEREUM,
  kind: 'standard',
  registry: '0x00000000000000000000000000000000000000aa',
  resolvedAt: 1000,
  outcome: 'rejected',
  challengerWon: true,
  bounty: '0',
  ...overrides,
})

const withRulings = (
  rulings: Record<number, RulingRow[]>,
  overrides: Partial<DashboardData> = {},
) => ({ rulings, tokens: {}, ...overrides }) as unknown as DashboardData

describe('bountyTotals', () => {
  const data = withRulings({
    [ETHEREUM]: [
      ruling({ bounty: String(ETH) }),
      ruling({
        challengerWon: false,
        outcome: 'registered',
        bounty: String(ETH),
      }),
      ruling({ kind: 'classic', registry: '', bounty: String(ETH / 2n) }),
      ruling({
        kind: 'permanent',
        token: STETH.toUpperCase().replace('0X', '0x'),
        bounty: '7',
      }),
      ruling({ kind: 'permanent', token: STETH, bounty: '3' }),
      ruling({ kind: 'permanent', token: STETH, bounty: '0' }),
    ],
    [GNOSIS]: [
      ruling({ chainId: GNOSIS, bounty: String(30n * ETH) }),
      ruling({ chainId: GNOSIS, bounty: '1e+21' }),
    ],
    [SEPOLIA]: [ruling({ chainId: SEPOLIA, bounty: '999' })],
  })

  it('adds what challengers won per coin, the Classic lists included', () => {
    expect(bountyTotals(data, [ETHEREUM, GNOSIS]).totals).toEqual({
      '1:native': { chainId: ETHEREUM, amount: ETH + ETH / 2n },
      [`1:${STETH}`]: { chainId: ETHEREUM, token: STETH, amount: 10n },
      '100:native': { chainId: GNOSIS, amount: 30n * ETH },
    })
  })

  it('counts the winning rulings that carried an amount', () => {
    expect(bountyTotals(data, [ETHEREUM, GNOSIS]).paid).toBe(5)
  })

  it('reads only the chains asked for', () => {
    expect(bountyTotals(data, [SEPOLIA])).toEqual({
      totals: { '11155111:native': { chainId: SEPOLIA, amount: 999n } },
      paid: 1,
    })
    expect(bountyTotals(withRulings({}), [ETHEREUM])).toEqual({
      totals: {},
      paid: 0,
    })
  })

  it('fails on a Stake bounty whose token did not load, rather than add it to the chain’s coin', () => {
    const data = withRulings({
      [GNOSIS]: [ruling({ chainId: GNOSIS, kind: 'permanent', bounty: '5' })],
    })
    expect(() => bountyTotals(data, [GNOSIS])).toThrow(/list token/)
  })

  it('minds no missing token on a Stake ruling that paid nothing', () => {
    const data = withRulings({
      [GNOSIS]: [
        ruling({ chainId: GNOSIS, kind: 'permanent', bounty: '0' }),
        ruling({
          chainId: GNOSIS,
          kind: 'permanent',
          challengerWon: false,
          outcome: 'kept',
          bounty: '5',
        }),
      ],
    })
    expect(bountyTotals(data, [GNOSIS])).toEqual({ totals: {}, paid: 0 })
  })
})

/* ---------- Dollars ---------- */

const price = (usd: number): UsdPrice => ({
  usd,
  updatedAt: 0,
  staleAfter: Number.MAX_SAFE_INTEGER,
  pair: 'X / USD',
})

/** Today's prices, as readUsdPrices answers them: a coin with none is absent. */
const prices = (byKey: Record<string, number>) =>
  vi
    .mocked(readUsdPrices)
    .mockImplementation(async (coins) =>
      Object.fromEntries(
        coins
          .filter((coin) => byKey[coin.key] !== undefined)
          .map((coin) => [coin.key, price(byKey[coin.key])]),
      ),
    )

const tokensRead = (byKey: Record<string, TokenInfo>) =>
  vi.mocked(readTokens).mockImplementation(async (tokens) =>
    Object.fromEntries(
      tokens
        .map(({ chainId, token }) => `${chainId}:${token}`)
        .filter((key) => byKey[key])
        .map((key) => [key, byKey[key]]),
    ),
  )

const coin = (chainId: number, amount: bigint, token?: string): CoinTotal => ({
  chainId,
  token,
  amount,
})

describe('totalInDollars', () => {
  it('adds every coin at today’s price', async () => {
    prices({ '1:native': 2000, '100:native': 0.9997 })
    await expect(
      totalInDollars([coin(ETHEREUM, ETH + ETH / 2n), coin(GNOSIS, 30n * ETH)]),
    ).resolves.toBeCloseTo(3000 + 29.991, 6)
  })

  it('is zero with nothing to add', async () => {
    prices({})
    await expect(totalInDollars([])).resolves.toBe(0)
  })

  it('reads a token’s decimals from the load when it has them, else from the chain', async () => {
    prices({ [`1:${STETH}`]: 2000, [`100:${SDAI}`]: 1.2 })
    tokensRead({ [`100:${SDAI}`]: { symbol: 'sDAI', decimals: 18 } })
    const total = await totalInDollars(
      [coin(ETHEREUM, ETH, STETH), coin(GNOSIS, 10n * ETH, SDAI)],
      { [`1:${STETH}`]: { symbol: 'stETH', decimals: 18 } },
    )
    expect(total).toBeCloseTo(2012, 6)
    expect(readTokens).toHaveBeenCalledTimes(1)
    expect(vi.mocked(readTokens).mock.calls[0][0]).toEqual([
      expect.objectContaining({ chainId: GNOSIS, token: SDAI }),
    ])
  })

  it('asks the chain for nothing when the load knows every token', async () => {
    prices({ '1:native': 1 })
    await totalInDollars([coin(ETHEREUM, ETH)])
    expect(readTokens).not.toHaveBeenCalled()
  })

  it('reads an amount in its token’s own decimals', async () => {
    prices({ [`100:${WXDAI}`]: 1 })
    const total = await totalInDollars([coin(GNOSIS, 5_000_000n, WXDAI)], {
      [`100:${WXDAI}`]: { symbol: 'WXDAI', decimals: 6 },
    })
    expect(total).toBeCloseTo(5, 10)
  })

  it('leaves out a token no feed or vault prices', async () => {
    prices({ '100:native': 1 })
    const total = await totalInDollars(
      [coin(GNOSIS, ETH), coin(GNOSIS, 1000n * ETH, ANY_TOKEN)],
      { [`100:${ANY_TOKEN}`]: { symbol: 'ANY', decimals: 18 } },
    )
    expect(total).toBe(1)
  })

  it('leaves out a token whose decimals never answered', async () => {
    prices({ '100:native': 1, [`100:${WXDAI}`]: 1 })
    tokensRead({})
    const total = await totalInDollars([
      coin(GNOSIS, ETH),
      coin(GNOSIS, 1000n * ETH, WXDAI),
    ])
    expect(total).toBe(1)
    const asked = vi.mocked(readUsdPrices).mock.calls[0][0].map((c) => c.key)
    expect(asked).toEqual(['100:native'])
  })

  it.each([
    ['the chain’s own coin', coin(ETHEREUM, ETH)],
    ['a token with a feed (stETH)', coin(ETHEREUM, ETH, STETH)],
    ['the allowlisted vault (sDAI)', coin(GNOSIS, ETH, SDAI)],
    ['a token with a feed (WXDAI)', coin(GNOSIS, ETH, WXDAI)],
  ])('fails when %s has no current price', async (_name, unpriced) => {
    prices({ '100:native': 1 })
    const known = {
      [`1:${STETH}`]: { symbol: 'stETH', decimals: 18 },
      [`100:${SDAI}`]: { symbol: 'sDAI', decimals: 18 },
      [`100:${WXDAI}`]: { symbol: 'WXDAI', decimals: 18 },
    }
    await expect(
      totalInDollars([coin(GNOSIS, ETH), unpriced], known),
    ).rejects.toThrow(/No dollar price/)
  })

  it('asks the prices of exactly the coins it can count', async () => {
    prices({ '1:native': 1 })
    await totalInDollars([coin(ETHEREUM, 2n)])
    expect(vi.mocked(readUsdPrices).mock.calls[0][0]).toEqual([
      expect.objectContaining({
        key: '1:native',
        chainId: ETHEREUM,
        decimals: 18,
      }),
    ])
  })
})
