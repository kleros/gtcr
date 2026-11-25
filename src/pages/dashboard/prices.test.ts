import { ethers } from 'ethers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { coinKey, hasPricePath, priceSource, type PricedCoin } from './prices'

vi.mock('config/rpc', () => ({
  getRpcUrls: (chainId: number) => [
    `https://node-a.test/${chainId}`,
    `https://node-b.test/${chainId}`,
  ],
}))

const ETHEREUM = 1
const GNOSIS = 100
const SEPOLIA = 11_155_111

const STETH = '0xae7ab96520de3a18e5e111b5eaab095312d7fe84'
const WXDAI = '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d'
const SDAI = '0xaf204776c7245bf4147c2612bf6e5972ee483701'
const ANY_TOKEN = '0x1111111111111111111111111111111111111111'

const MULTICALL3 = '0xca11bde05977b3631167028862be2a173976ca11'
const FEED = {
  ethUsd: '0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419',
  stethUsd: '0xcfe54b5cd566ab89272946f602d76ea879cab4a8',
  daiUsd: '0x678df3415fc31947da4324ec63212874be5a82f8',
}
const HEARTBEAT = { hour: 3600, day: 86_400 }
const SLACK = 15 * 60

const NOW_MS = Date.UTC(2026, 10, 22, 12)
const NOW = NOW_MS / 1000

/* ---------- A chain, as Multicall3 answers it ---------- */

const multicall = new ethers.utils.Interface([
  'function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[] returnData)',
])
const aggregator = new ethers.utils.Interface([
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
])
const vault = new ethers.utils.Interface([
  'function asset() view returns (address)',
  'function convertToAssets(uint256 shares) view returns (uint256)',
])

interface Chain {
  /** Feed address → its answer (dollars) and when it was written. */
  feeds?: Record<string, { usd: string; updatedAt: number }>
  /** Vault token → the asset its asset() names. */
  assets?: Record<string, string>
  /** Vault token → assets one share converts to. */
  rates?: Record<string, string>
}

type Call = { url: string; chainId: number; target: string; callData: string }

let chains: Record<number, Chain> = {}
let nodeDown: (url: string) => 'down' | 'refused' | 'garbled' | false
let seen: Call[][] = []

const answer = (chain: Chain, target: string, callData: string) => {
  const selector = callData.slice(0, 10)
  if (selector === aggregator.getSighash('latestRoundData')) {
    const feed = chain.feeds?.[target]
    if (!feed) return null
    return aggregator.encodeFunctionResult('latestRoundData', [
      7,
      ethers.utils.parseUnits(feed.usd, 8),
      feed.updatedAt,
      feed.updatedAt,
      7,
    ])
  }
  if (selector === vault.getSighash('asset')) {
    const asset = chain.assets?.[target]
    return asset ? vault.encodeFunctionResult('asset', [asset]) : null
  }
  if (selector === vault.getSighash('convertToAssets')) {
    const rate = chain.rates?.[target]
    if (!rate) return null
    const [shares] = vault.decodeFunctionData('convertToAssets', callData)
    const assets = (shares as ethers.BigNumber)
      .mul(ethers.utils.parseUnits(rate, 18))
      .div(ethers.constants.WeiPerEther)
    return vault.encodeFunctionResult('convertToAssets', [assets])
  }
  return null
}

const node = vi.fn(async (url: string, init: { body: string }) => {
  const body = JSON.parse(init.body)
  const [{ to, data }] = body.params as [{ to: string; data: string }]
  const chainId = Number(url.split('/').pop())
  expect(to.toLowerCase()).toBe(MULTICALL3)
  const [calls] = multicall.decodeFunctionData(
    'aggregate3',
    data,
  ) as unknown as [
    { target: string; allowFailure: boolean; callData: string }[],
  ]
  seen.push(
    calls.map(({ target, callData }) => ({
      url,
      chainId,
      target: target.toLowerCase(),
      callData,
    })),
  )
  const down = nodeDown(url)
  if (down === 'down') throw new TypeError('Failed to fetch')
  if (down === 'refused') return { ok: false, json: async () => ({}) }
  const result =
    down === 'garbled'
      ? '0xdeadbeef'
      : multicall.encodeFunctionResult('aggregate3', [
          calls.map(({ allowFailure, target, callData }) => {
            expect(allowFailure).toBe(true)
            const returnData = answer(
              chains[chainId] ?? {},
              target.toLowerCase(),
              callData,
            )
            return returnData ? [true, returnData] : [false, '0x']
          }),
        ])
  return { ok: true, json: async () => ({ jsonrpc: '2.0', id: 1, result }) }
})

/** Every call the read made, by what it asked. */
const asked = (selector: string) =>
  seen.flat().filter((call) => call.callData.startsWith(selector))

const coin = (chainId: number, token?: string, decimals = 18): PricedCoin => ({
  key: coinKey(chainId, token),
  chainId,
  token,
  decimals,
})

// A fresh module each time: which tokens are vaults is kept for the session.
let readUsdPrices: typeof import('./prices').readUsdPrices

beforeEach(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW_MS)
  chains = {}
  seen = []
  nodeDown = () => false
  node.mockClear()
  vi.stubGlobal('fetch', node)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.resetModules()
  ;({ readUsdPrices } = await import('./prices'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('coinKey', () => {
  it.each([
    [ETHEREUM, undefined, '1:native'],
    [GNOSIS, '', '100:native'],
    [GNOSIS, SDAI.toUpperCase().replace('0X', '0x'), `100:${SDAI}`],
  ])('keys chain %i’s coin %j as %s', (chainId, token, key) => {
    expect(coinKey(chainId, token)).toBe(key)
  })
})

describe('hasPricePath', () => {
  it.each([
    ['ETH', coinKey(ETHEREUM)],
    ['stETH', coinKey(ETHEREUM, STETH)],
    ['xDAI', coinKey(GNOSIS)],
    ['WXDAI', coinKey(GNOSIS, WXDAI)],
    ['sDAI, the allowlisted vault', coinKey(GNOSIS, SDAI)],
  ])('has a way to a price for %s', (_name, key) => {
    expect(hasPricePath(key)).toBe(true)
  })

  it.each([
    ['Sepolia’s coin', coinKey(SEPOLIA)],
    ['any other ERC-20', coinKey(GNOSIS, ANY_TOKEN)],
    ['sDAI’s address on another chain', coinKey(ETHEREUM, SDAI)],
    ['stETH’s address on another chain', coinKey(GNOSIS, STETH)],
  ])('has none for %s', (_name, key) => {
    expect(hasPricePath(key)).toBe(false)
  })
})

describe('priceSource', () => {
  const price = { usd: 1, pair: 'DAI / USD', staleAfter: NOW + 1 }

  it.each([
    [NOW - 30, undefined, 'the DAI / USD feed, read just now'],
    [
      NOW - (3 * 3600 + 58 * 60),
      undefined,
      'the DAI / USD feed, read 3 hours 58 min ago',
    ],
    [
      NOW - (26 * 3600 + 5 * 60),
      'WXDAI',
      'the DAI / USD feed through WXDAI, read 1 day 2 hours ago',
    ],
  ])('describes an answer written at %i', (updatedAt, via, text) => {
    expect(priceSource({ ...price, updatedAt, via }, NOW)).toBe(text)
  })

  it('reads the age from the clock when no time is given', () => {
    expect(priceSource({ ...price, updatedAt: NOW - 120 })).toBe(
      'the DAI / USD feed, read 2 min ago',
    )
  })
})

describe('readUsdPrices', () => {
  it('reads a coin’s price from its own chain’s feed', async () => {
    chains[ETHEREUM] = {
      feeds: { [FEED.ethUsd]: { usd: '1779.77', updatedAt: NOW - 60 } },
    }
    const prices = await readUsdPrices([coin(ETHEREUM)])
    expect(prices).toEqual({
      '1:native': {
        usd: 1779.77,
        updatedAt: NOW - 60,
        staleAfter: NOW - 60 + HEARTBEAT.hour + SLACK,
        pair: 'ETH / USD',
      },
    })
    expect(seen.flat().every((call) => call.chainId === ETHEREUM)).toBe(true)
  })

  it('prices xDAI at the DAI peg, not at a dollar', async () => {
    chains[GNOSIS] = {
      feeds: { [FEED.daiUsd]: { usd: '0.99969831', updatedAt: NOW - 3600 } },
    }
    const prices = await readUsdPrices([coin(GNOSIS)])
    expect(prices['100:native']).toMatchObject({
      usd: 0.999_698_31,
      pair: 'DAI / USD',
      staleAfter: NOW - 3600 + HEARTBEAT.day + SLACK,
    })
  })

  it.each([
    ['ETH', ETHEREUM, FEED.ethUsd, HEARTBEAT.hour],
    ['xDAI', GNOSIS, FEED.daiUsd, HEARTBEAT.day],
  ])(
    'keeps %s’s answer up to its heartbeat and the slack, and drops it after',
    async (_name, chainId, feed, heartbeat) => {
      chains[chainId] = {
        feeds: { [feed]: { usd: '2', updatedAt: NOW - heartbeat - SLACK } },
      }
      expect(
        (await readUsdPrices([coin(chainId)]))[coinKey(chainId)],
      ).toBeDefined()
      chains[chainId] = {
        feeds: { [feed]: { usd: '2', updatedAt: NOW - heartbeat - SLACK - 1 } },
      }
      expect(await readUsdPrices([coin(chainId)])).toEqual({})
    },
  )

  it.each([
    ['zero', '0', NOW],
    ['less than zero', '-1', NOW],
    ['an answer that was never written', '1', 0],
  ])('has no price when the feed answers %s', async (_name, usd, updatedAt) => {
    chains[ETHEREUM] = { feeds: { [FEED.ethUsd]: { usd, updatedAt } } }
    expect(await readUsdPrices([coin(ETHEREUM)])).toEqual({})
  })

  it('never prices a testnet coin, and asks no node', async () => {
    expect(await readUsdPrices([coin(SEPOLIA)])).toEqual({})
    expect(node).not.toHaveBeenCalled()
  })

  it('asks no node for a token no feed or vault names', async () => {
    expect(await readUsdPrices([coin(GNOSIS, ANY_TOKEN)])).toEqual({})
    expect(node).not.toHaveBeenCalled()
  })

  it('prices a token with a feed of its own', async () => {
    chains[ETHEREUM] = {
      feeds: { [FEED.stethUsd]: { usd: '1777.85', updatedAt: NOW } },
    }
    const prices = await readUsdPrices([coin(ETHEREUM, STETH)])
    expect(prices[`1:${STETH}`]).toMatchObject({
      usd: 1777.85,
      pair: 'STETH / USD',
    })
  })

  it('reads a feed once however many coins it prices', async () => {
    chains[GNOSIS] = {
      feeds: { [FEED.daiUsd]: { usd: '1', updatedAt: NOW } },
    }
    const prices = await readUsdPrices([
      coin(GNOSIS),
      coin(GNOSIS, WXDAI),
      coin(GNOSIS),
    ])
    expect(Object.keys(prices).sort()).toEqual(
      [`100:${WXDAI}`, '100:native'].sort(),
    )
    expect(node).toHaveBeenCalledTimes(1)
    expect(asked(aggregator.getSighash('latestRoundData'))).toHaveLength(1)
  })

  it('reads each chain on its own nodes', async () => {
    chains[ETHEREUM] = {
      feeds: { [FEED.ethUsd]: { usd: '2000', updatedAt: NOW } },
    }
    chains[GNOSIS] = { feeds: { [FEED.daiUsd]: { usd: '1', updatedAt: NOW } } }
    const prices = await readUsdPrices([coin(ETHEREUM), coin(GNOSIS)])
    expect(prices['1:native'].usd).toBe(2000)
    expect(prices['100:native'].usd).toBe(1)
    const nodeOf = (feed: string) =>
      seen.flat().find((call) => call.target === feed)?.url
    expect(nodeOf(FEED.ethUsd)).toBe('https://node-a.test/1')
    expect(nodeOf(FEED.daiUsd)).toBe('https://node-a.test/100')
  })

  describe('sDAI, a vault over WXDAI', () => {
    beforeEach(() => {
      chains[GNOSIS] = {
        feeds: { [FEED.daiUsd]: { usd: '0.9997', updatedAt: NOW } },
        assets: { [SDAI]: WXDAI },
        rates: { [SDAI]: '1.2' },
      }
    })

    it('is priced through its asset, at its share price', async () => {
      const prices = await readUsdPrices([coin(GNOSIS, SDAI)])
      expect(prices[`100:${SDAI}`]).toMatchObject({
        pair: 'DAI / USD',
        via: 'WXDAI',
        staleAfter: NOW + HEARTBEAT.day + SLACK,
      })
      expect(prices[`100:${SDAI}`].usd).toBeCloseTo(0.9997 * 1.2, 12)
    })

    it('asks which asset it holds once a session; the share price on every read', async () => {
      await readUsdPrices([coin(GNOSIS, SDAI)])
      chains[GNOSIS].rates = { [SDAI]: '1.25' }
      const prices = await readUsdPrices([coin(GNOSIS, SDAI)])
      expect(prices[`100:${SDAI}`].usd).toBeCloseTo(0.9997 * 1.25, 12)
      expect(asked(vault.getSighash('asset'))).toHaveLength(1)
      expect(asked(vault.getSighash('convertToAssets'))).toHaveLength(2)
    })

    it('is not priced when it claims another asset, nor asked again', async () => {
      chains[GNOSIS].assets = { [SDAI]: ANY_TOKEN }
      expect(await readUsdPrices([coin(GNOSIS, SDAI)])).toEqual({})
      const calls = node.mock.calls.length
      expect(await readUsdPrices([coin(GNOSIS, SDAI)])).toEqual({})
      expect(node.mock.calls.length).toBe(calls)
    })

    it.each([
      ['1000', false],
      ['0.001', false],
      ['100', true],
      ['0.01', true],
    ])('trusts a share price of %s: %s', async (rate, priced) => {
      chains[GNOSIS].rates = { [SDAI]: rate }
      const prices = await readUsdPrices([coin(GNOSIS, SDAI)])
      expect(`100:${SDAI}` in prices).toBe(priced)
    })

    it('asks the vault in its own unit', async () => {
      await readUsdPrices([coin(GNOSIS, SDAI, 6)])
      const [rate] = asked(vault.getSighash('convertToAssets'))
      const [shares] = vault.decodeFunctionData(
        'convertToAssets',
        rate.callData,
      )
      expect((shares as ethers.BigNumber).toString()).toBe('1000000')
    })
  })

  it('never asks a token outside the allowlist whether it is a vault', async () => {
    chains[GNOSIS] = {
      feeds: { [FEED.daiUsd]: { usd: '1', updatedAt: NOW } },
      assets: { [ANY_TOKEN]: WXDAI },
      rates: { [ANY_TOKEN]: '1' },
    }
    const prices = await readUsdPrices([coin(GNOSIS), coin(GNOSIS, ANY_TOKEN)])
    expect(Object.keys(prices)).toEqual(['100:native'])
    expect(seen.flat().some((call) => call.target === ANY_TOKEN)).toBe(false)
  })

  it.each(['down', 'refused', 'garbled'] as const)(
    'asks the next node when the first is %s',
    async (failure) => {
      chains[ETHEREUM] = {
        feeds: { [FEED.ethUsd]: { usd: '2000', updatedAt: NOW } },
      }
      nodeDown = (url) => (url.includes('node-a') ? failure : false)
      const prices = await readUsdPrices([coin(ETHEREUM)])
      expect(prices['1:native'].usd).toBe(2000)
      expect(node.mock.calls.map(([url]) => url)).toEqual([
        'https://node-a.test/1',
        'https://node-b.test/1',
      ])
    },
  )

  it('answers no price, and throws nothing, when no node answers', async () => {
    nodeDown = () => 'down'
    await expect(
      readUsdPrices([coin(ETHEREUM), coin(GNOSIS)]),
    ).resolves.toEqual({})
  })

  it('says in development which configured feed did not answer', async () => {
    chains[ETHEREUM] = {}
    await readUsdPrices([coin(ETHEREUM)])
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(/No USD price for 1:native: the ETH \/ USD feed/),
    )
  })
})
