import { describe, expect, it, vi } from 'vitest'
import { readUsdPrices } from 'pages/dashboard/prices'
import { readTokens } from 'pages/dashboard/tokens'
import { totalInDollars, type Transit } from 'pages/dashboard/transit'
import type { DashboardData, RulingRow } from 'pages/dashboard/types'
import { landingMoney } from './money'

vi.mock('pages/dashboard/transit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('pages/dashboard/transit')>()),
  totalInDollars: vi.fn(),
}))
vi.mock('pages/dashboard/prices', async (importOriginal) => ({
  ...(await importOriginal<typeof import('pages/dashboard/prices')>()),
  readUsdPrices: vi.fn(),
}))
vi.mock('pages/dashboard/tokens', () => ({ readTokens: vi.fn() }))

const ETHEREUM = 1
const GNOSIS = 100
const ALL = [ETHEREUM, GNOSIS]
const SDAI = '0xaf204776c7245bf4147c2612bf6e5972ee483701'

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

const TOKENS = { [`100:${SDAI}`]: { symbol: 'sDAI', decimals: 18 } }

const load = (overrides: Partial<DashboardData> = {}) =>
  ({
    rulings: {
      [ETHEREUM]: [
        ruling({ bounty: '100' }),
        ruling({ kind: 'classic', registry: '', bounty: '40' }),
        ruling({ challengerWon: false, outcome: 'registered', bounty: '7' }),
        ruling({ kind: 'classic', registry: '' }),
      ],
      [GNOSIS]: [
        ruling({ chainId: GNOSIS, bounty: '30' }),
        ruling({
          chainId: GNOSIS,
          kind: 'permanent',
          token: SDAI,
          bounty: '5',
        }),
      ],
    },
    rulingsCapped: {},
    tokens: TOKENS,
    openDisputes: [],
    ...overrides,
  }) as unknown as DashboardData

const transit: Transit = {
  totals: {
    '1:native': { chainId: ETHEREUM, amount: 1000n },
    [`100:${SDAI}`]: { chainId: GNOSIS, token: SDAI, amount: 500n },
  },
  requests: 33_667,
}

/** A dollar per smallest unit, so the figures read as the amounts' sum. */
const atOneDollar = () =>
  vi
    .mocked(totalInDollars)
    .mockImplementation(async (coins) =>
      coins.reduce((sum, coin) => sum + Number(coin.amount), 0),
    )

describe('landingMoney', () => {
  it('reads both figures, the Classic lists’ bounties included', async () => {
    atOneDollar()
    const money = await landingMoney(load(), ALL, Promise.resolve(transit))
    expect(money).toEqual({
      bounties: 100 + 40 + 30 + 5,
      bountiesPaid: 4,
      bountiesCapped: false,
      transit: 1500,
      requests: 33_667,
    })
  })

  it('prices each coin on its own, with the load’s tokens', async () => {
    atOneDollar()
    await landingMoney(load(), ALL, Promise.resolve(transit))
    const [bounties, passed] = vi.mocked(totalInDollars).mock.calls
    // Per coin: never added across coins before they are priced.
    expect(bounties[0]).toHaveLength(3)
    expect(bounties[0]).toEqual(
      expect.arrayContaining([
        { chainId: ETHEREUM, amount: 140n },
        { chainId: GNOSIS, amount: 30n },
        { chainId: GNOSIS, token: SDAI, amount: 5n },
      ]),
    )
    expect(bounties[1]).toBe(TOKENS)
    expect(passed[0]).toEqual(Object.values(transit.totals))
  })

  it('leaves the bounties out when a chain’s rulings ledger did not load', async () => {
    atOneDollar()
    const partial = load({ rulings: { [ETHEREUM]: [ruling({ bounty: '1' })] } })
    const money = await landingMoney(partial, ALL, Promise.resolve(transit))
    expect(money).toEqual({ transit: 1500, requests: 33_667 })
  })

  it('leaves the transit out when its read fails, and keeps the bounties', async () => {
    atOneDollar()
    const money = await landingMoney(
      load(),
      ALL,
      Promise.reject(new Error('indexer down')),
    )
    expect(money).toEqual({
      bounties: 175,
      bountiesPaid: 4,
      bountiesCapped: false,
    })
  })

  it('leaves out a figure whose coins cannot all be priced, and only that one', async () => {
    vi.mocked(totalInDollars).mockImplementation(async (coins) => {
      if (coins.some((coin) => coin.token === SDAI && coin.amount === 5n))
        throw new Error('No dollar price for sDAI')
      return 1
    })
    const money = await landingMoney(load(), ALL, Promise.resolve(transit))
    expect(money).toEqual({ transit: 1, requests: 33_667 })
  })

  it('says when a ledger in scope stopped at its page limit', async () => {
    atOneDollar()
    const capped = await landingMoney(
      load({ rulingsCapped: { [GNOSIS]: true } }),
      ALL,
      Promise.resolve(transit),
    )
    expect(capped.bountiesCapped).toBe(true)
    const elsewhere = await landingMoney(
      load({ rulingsCapped: { [GNOSIS]: true } }),
      [ETHEREUM],
      Promise.resolve(transit),
    )
    expect(elsewhere.bountiesCapped).toBe(false)
  })

  /*
   * The same figure as the dashboard's hero, which draws no dollar total
   * when any coin has no current price or a token's decimals never answered
   * (DESIGN.md, Dashboard → The money in the hero; bounties.tsx bountyTotal).
   * Here the real totalInDollars prices the coins, over today's feeds.
   */
  describe('with no honest total', () => {
    const ANY_TOKEN = '0x1111111111111111111111111111111111111111'
    const priced = async () => {
      const actual = await vi.importActual<
        typeof import('pages/dashboard/transit')
      >('pages/dashboard/transit')
      vi.mocked(totalInDollars).mockImplementation(actual.totalInDollars)
      vi.mocked(readTokens).mockResolvedValue({})
      vi.mocked(readUsdPrices).mockImplementation(async (coins) =>
        Object.fromEntries(
          coins
            .filter((coin) => !coin.token)
            .map((coin) => [
              coin.key,
              { usd: 1, updatedAt: 0, staleAfter: Infinity, pair: 'DAI / USD' },
            ]),
        ),
      )
    }
    const paidIn = (token: string, tokens: DashboardData['tokens']) =>
      load({
        rulings: {
          [ETHEREUM]: [],
          [GNOSIS]: [
            ruling({ chainId: GNOSIS, bounty: String(10n ** 18n) }),
            ruling({
              chainId: GNOSIS,
              kind: 'permanent',
              token,
              bounty: String(500n * 10n ** 18n),
            }),
          ],
        },
        tokens,
      })

    it('still adds the coins it can price', async () => {
      await priced()
      const money = await landingMoney(
        load({
          rulings: {
            [ETHEREUM]: [],
            [GNOSIS]: [ruling({ chainId: GNOSIS, bounty: String(10n ** 18n) })],
          },
        }),
        ALL,
        Promise.resolve(transit),
      )
      expect(money.bounties).toBe(1)
    })

    // Regression: landingMoney totalled the bounties with totalInDollars,
    // which leaves out a token no feed or vault prices (transit.ts:305), a
    // rule meant for the transit total. The dashboard's hero draws no total
    // then (bounties.tsx:283), so the landing shows $1 as the bounties won
    // where 500 tokens more were won, and keeps it rather than its snapshot.
    it('leaves the bounties out when a coin they were paid in has no price', async () => {
      await priced()
      const money = await landingMoney(
        paidIn(ANY_TOKEN, {
          [`100:${ANY_TOKEN}`]: { symbol: 'ANY', decimals: 18 },
        }),
        ALL,
        Promise.resolve(transit),
      )
      expect(money.bounties).toBeUndefined()
    })

    // Regression: the same for a token whose decimals never answered: the hero has
    // no honest total (bounties.tsx:290), the landing drops the token
    // (transit.ts:291) and shows the rest as the whole.
    it('leaves the bounties out when a token’s decimals never answered', async () => {
      await priced()
      const money = await landingMoney(
        paidIn(ANY_TOKEN, {}),
        ALL,
        Promise.resolve(transit),
      )
      expect(money.bounties).toBeUndefined()
    })
  })
})
