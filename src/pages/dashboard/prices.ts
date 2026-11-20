import { ethers } from 'ethers'
import { NETWORKS } from 'config/networks'
import { getRpcUrls } from 'config/rpc'
import { formatDurationLong } from 'utils/time'
import { TESTNET_CHAIN_IDS } from './view'

/*
 * What a coin figure is worth in dollars, read on chain: one Chainlink
 * aggregator per asset, over the same raw-eth_call-over-Multicall3 pattern
 * challenge-windows.ts uses. No price API is called. Every request this makes
 * goes to an RPC endpoint the app already reads from, so no new third party
 * learns a visitor's address for the sake of a secondary label, and the price
 * comes from the same chain the amount lives on.
 *
 * Per coin, only the collateral behind the requests open for verification
 * carries a dollar value (DESIGN.md, Data rules). A figure somebody is about
 * to sign for never carries one — the coin amount is the obligation, and a
 * converted number beside it is not what the wallet will ask for. Two figures
 * are totals across coins, at today's prices (rounds 14 to 16): the bounties
 * challengers have won and what has passed through Curate (transit.ts,
 * totalInDollars). Every other figure stays per coin.
 *
 * A price nobody can read is simply absent from the map: the caller then
 * renders the coin figure alone, exactly as the page did before any of this
 * existed, which is what makes this unable to regress it. There is no "$—",
 * no error line and no skeleton — a skeleton promises a number, and this one
 * is allowed never to arrive.
 *
 * Every price carries the second it stops being current (`staleAfter`), not
 * only the second it was written. A price expires with nothing happening —
 * the answer simply gets old — so a gate applied here alone, where the read
 * happens, would let a tab left open keep painting an answer that has since
 * passed its feed's heartbeat. The bound travels with the value instead, and
 * use-usd-prices.ts takes a price out of the map the moment it passes it.
 */

/** Multicall3, deployed at the same address on Ethereum, Gnosis and Sepolia. */
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11'
const REQUEST_TIMEOUT_MS = 4_000

/**
 * How late a feed's answer may be past its own heartbeat before it is treated
 * as no price at all. A caveat on an optional secondary figure is noise, so an
 * old price is dropped rather than qualified.
 */
const STALE_SLACK_S = 15 * 60

/**
 * A vault share is believed to be worth between this much and this much of
 * its asset. A broken or hostile vault answering `convertToAssets` with a
 * wild number prints no dollar figure instead of a wild one.
 */
const RATE_MIN = 0.01
const RATE_MAX = 100

/** One Chainlink aggregator: what it answers, and how often it answers. */
interface Feed {
  /** The pair, as the aggregator's own `description()` spells it. */
  pair: string
  address: string
  /** Decimals of the aggregator's answer. */
  decimals: number
  /** Seconds between writes even when the price does not move. */
  heartbeat: number
  /** The asset the feed prices, and that asset's own decimals. */
  asset: string
  unit: number
}

/**
 * The aggregators, keyed the way view.ts keys a coin. Every entry below was
 * called and decoded on 2026-11-19 — `description()`, `decimals()` and
 * `latestRoundData()` — so this table states only what answered: ETH / USD
 * 1779.77, STETH / USD 1777.85, DAI / USD 0.99969831.
 *
 * Nothing here is ever derived from a token's symbol. A price appears only
 * for an asset somebody checked by address, which is why a Stake list paying
 * in a token this table does not name shows its coin figure alone.
 */
const FEEDS: Record<string, Feed> = {
  [`${NETWORKS.ethereum}:native`]: {
    pair: 'ETH / USD',
    address: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
    decimals: 8,
    heartbeat: 3_600,
    asset: 'ETH',
    unit: 18,
  },
  // stETH: what the Ethereum Stake lists pay in (tokens.ts).
  [`${NETWORKS.ethereum}:0xae7ab96520de3a18e5e111b5eaab095312d7fe84`]: {
    pair: 'STETH / USD',
    address: '0xCfE54B5cD566aB89272946F602D76Ea879CAb4a8',
    decimals: 8,
    heartbeat: 3_600,
    asset: 'stETH',
    unit: 18,
  },
  /*
   * xDAI is DAI, so the Gnosis coin's dollar value is the peg — read from
   * the feed rather than assumed to be a dollar, because the peg is a fact
   * the page can state honestly and today it reads 0.9997.
   */
  [`${NETWORKS.gnosis}:native`]: {
    pair: 'DAI / USD',
    address: '0x678df3415fc31947dA4324eC63212874be5a82f8',
    decimals: 8,
    heartbeat: 86_400,
    asset: 'xDAI',
    unit: 18,
  },
  // WXDAI: what sDAI converts to, and a stake token in its own right.
  [`${NETWORKS.gnosis}:0xe91d153e0b41518a2ce8dd3d7944fa863463a97d`]: {
    pair: 'DAI / USD',
    address: '0x678df3415fc31947dA4324eC63212874be5a82f8',
    decimals: 8,
    heartbeat: 86_400,
    asset: 'WXDAI',
    unit: 18,
  },
}

/*
 * The vaults whose share price may be read, checked by address like the
 * feeds above, each with the asset it must answer. Any other token is never
 * asked: a token anyone can deploy could claim to be a vault over WXDAI and
 * give itself a dollar price.
 */
const VAULTS: Record<string, string> = {
  // sDAI, the Gnosis Stake lists' token (tokens.ts), over WXDAI.
  [`${NETWORKS.gnosis}:0xaf204776c7245bf4147c2612bf6e5972ee483701`]:
    '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d',
}

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
const LATEST_ROUND_CALL = aggregator.encodeFunctionData('latestRoundData')
const ASSET_CALL = vault.encodeFunctionData('asset')

/**
 * Which asset a vault token is a claim on, once asked: `null` for a token
 * that is not a vault, or whose asset no feed prices. A vault's asset never
 * changes, so this is kept for the session — the price itself never is.
 */
const vaultAssets = new Map<string, string | null>()

/**
 * Whether a coin has a way to a price here: its own feed, or a vault over an
 * asset with one. A total may leave out a coin with none (any ERC-20 a Stake
 * list takes) but not one whose price failed this time: that would be a
 * smaller number shown as the whole.
 */
export const hasPricePath = (key: string): boolean =>
  !!FEEDS[key] || !!VAULTS[key]

/** The key view.ts gives a coin: "<chainId>:native" or "<chainId>:<token>". */
export const coinKey = (chainId: number, token?: string): string =>
  `${chainId}:${token ? token.toLowerCase() : 'native'}`

/** One dollar price, as the chain answered it. */
export interface UsdPrice {
  /** Dollars for one whole coin. */
  usd: number
  /** When the aggregator last wrote this answer, in seconds. */
  updatedAt: number
  /**
   * The second after which this answer is no longer a current price: its
   * feed's heartbeat and the slack above, past `updatedAt`. It is carried on
   * the value because the value goes stale on its own, with nothing calling
   * back here to notice.
   */
  staleAfter: number
  /** The feed that answered, as it describes itself ("DAI / USD"). */
  pair: string
  /** The asset the price was reached through, when it took a vault ("WXDAI"). */
  via?: string
}

/** A coin a figure on screen is in, and so a coin worth asking a price for. */
export interface PricedCoin {
  /** Keyed as view.ts keys a BountyCoin: reuse that key, never rebuild it. */
  key: string
  chainId: number
  /** The coin's ERC-20, lowercase; absent for the chain's own coin. */
  token?: string
  /** The coin's own decimals: a vault's share price is asked in its unit. */
  decimals: number
}

const ethCall = async (
  url: string,
  to: string,
  data: string,
): Promise<string | null> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to, data }, 'latest'],
      }),
      signal: controller.signal,
    })
    if (!response.ok) return null
    const reply = (await response.json()) as { result?: string }
    return typeof reply.result === 'string' && reply.result.length > 2
      ? reply.result
      : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * One Multicall3 read: the calls' answers in order, with a call that reverted
 * or answered nothing as null. Null for the whole batch when no endpoint
 * answered. Walks the app's own endpoint order, so the next node answers when
 * one fails (challenge-windows.ts).
 */
const aggregate = async (
  chainId: number,
  calls: { target: string; callData: string }[],
): Promise<(string | null)[] | null> => {
  if (calls.length === 0) return []
  const data = multicall.encodeFunctionData('aggregate3', [
    calls.map((call) => ({ ...call, allowFailure: true })),
  ])
  for (const url of getRpcUrls(chainId)) {
    const result = await ethCall(url, MULTICALL3, data)
    if (!result) continue
    try {
      const [rows] = multicall.decodeFunctionResult('aggregate3', result) as [
        { success: boolean; returnData: string }[],
      ]
      return rows.map((row) =>
        row.success && row.returnData.length >= 66 ? row.returnData : null,
      )
    } catch {
      // A malformed answer: try the next node.
    }
  }
  return null
}

/**
 * The dollars one whole asset is worth, from an aggregator's answer. Nothing
 * when the feed answered zero or less (it has no price to give), or when its
 * answer is older than its heartbeat and the slack above: a price past its own
 * heartbeat is not a current price, and this figure is optional anyway. The
 * same bound is carried onto the price as `staleAfter`, so an answer that was
 * current when it was read is still dropped once it stops being.
 */
const decodeFeed = (
  returnData: string,
  feed: Feed,
  now: number,
): { usd: number; updatedAt: number } | null => {
  try {
    const round = aggregator.decodeFunctionResult(
      'latestRoundData',
      returnData,
    ) as unknown as {
      answer: ethers.BigNumber
      updatedAt: ethers.BigNumber
    }
    if (round.answer.lte(0)) return null
    const updatedAt = round.updatedAt.toNumber()
    if (updatedAt <= 0) return null
    if (now - updatedAt > feed.heartbeat + STALE_SLACK_S) return null
    const usd = Number(ethers.utils.formatUnits(round.answer, feed.decimals))
    return Number.isFinite(usd) && usd > 0 ? { usd, updatedAt } : null
  } catch {
    return null
  }
}

/** How many of its asset one vault share converts to, or nothing. */
const decodeRate = (returnData: string, feed: Feed): number | null => {
  try {
    const [assets] = vault.decodeFunctionResult(
      'convertToAssets',
      returnData,
    ) as [ethers.BigNumber]
    const rate = Number(ethers.utils.formatUnits(assets, feed.unit))
    return Number.isFinite(rate) && rate >= RATE_MIN && rate <= RATE_MAX
      ? rate
      : null
  } catch {
    return null
  }
}

const decodeAddress = (returnData: string): string | null => {
  try {
    const [address] = vault.decodeFunctionResult('asset', returnData) as [
      string,
    ]
    return address.toLowerCase()
  } catch {
    return null
  }
}

/** Every feed this chain has: one or two, so reading them all costs nothing. */
const chainFeeds = (chainId: number): Feed[] => {
  const seen = new Map<string, Feed>()
  for (const [key, feed] of Object.entries(FEEDS))
    if (key.startsWith(`${chainId}:`)) seen.set(feed.address, feed)
  return [...seen.values()]
}

/*
 * A coin with a feed configured and no price is the one failure silence
 * hides: on screen it is indistinguishable from a coin nobody prices, so a
 * wrong table entry or a dead endpoint would look like "no price yet"
 * forever. In development it says so (rpc.ts warns about its missing key the
 * same way); in the browser it stays silent, as it must.
 */
const warnUnpriced = (
  wanted: { coin: PricedCoin; feed: Feed }[],
  prices: Record<string, UsdPrice>,
) => {
  if (!import.meta.env.DEV) return
  for (const { coin, feed } of wanted)
    if (!prices[coin.key])
      console.warn(
        `No USD price for ${coin.key}: the ${feed.pair} feed did not answer, or its answer is past its heartbeat.`,
      )
}

/** One `convertToAssets(1 share)` call against a vault token. */
const rateCall = (coin: PricedCoin) => ({
  target: coin.token as string,
  callData: vault.encodeFunctionData('convertToAssets', [
    ethers.BigNumber.from(10).pow(coin.decimals),
  ]),
})

/**
 * The prices one chain can answer for the coins on screen.
 *
 * One Multicall3 read does nearly all of it: a `latestRoundData` per feed, an
 * `asset()` probe for each token with no feed of its own, and a
 * `convertToAssets` for every vault this session has already placed. A token
 * that is not a vault reverts on `asset()`, which `allowFailure` turns into a
 * null row at no cost. A vault first met in that read takes one follow-up call
 * for its share price — once per session, since what a vault is a claim on
 * never changes.
 */
const readChain = async (
  chainId: number,
  coins: PricedCoin[],
  now: number,
): Promise<Record<string, UsdPrice>> => {
  const prices: Record<string, UsdPrice> = {}
  /** A coin its own feed prices, a coin priced through a vault's asset, and
      a token nobody has asked yet whether it is a vault at all. */
  const direct: { coin: PricedCoin; feed: Feed }[] = []
  const through: { coin: PricedCoin; feed: Feed }[] = []
  const probes: PricedCoin[] = []
  for (const coin of coins) {
    const own = FEEDS[coin.key]
    if (own) {
      direct.push({ coin, feed: own })
      continue
    }
    // Only a token can be a vault over something else; the chain's own coin
    // either has a feed above or has no price.
    if (!coin.token || !VAULTS[coin.key]) continue
    const asset = vaultAssets.get(coin.key)
    if (asset === undefined) {
      probes.push(coin)
      continue
    }
    const feed = asset ? FEEDS[coinKey(chainId, asset)] : undefined
    if (feed) through.push({ coin, feed })
  }
  if (direct.length + through.length + probes.length === 0) return prices

  /*
   * Which feeds to read: the ones these coins need — and, when a probe may
   * yet discover a vault, every feed the chain has, because there are only
   * ever one or two of them and guessing wrong would cost a round trip.
   */
  const feeds = new Map<string, Feed>()
  for (const { feed } of [...direct, ...through]) feeds.set(feed.address, feed)
  if (probes.length > 0)
    for (const feed of chainFeeds(chainId)) feeds.set(feed.address, feed)
  const addresses = [...feeds.keys()]

  const answers = await aggregate(chainId, [
    ...addresses.map((target) => ({ target, callData: LATEST_ROUND_CALL })),
    ...probes.map((coin) => ({
      target: coin.token as string,
      callData: ASSET_CALL,
    })),
    ...through.map(({ coin }) => rateCall(coin)),
  ])
  if (!answers) {
    warnUnpriced([...direct, ...through], prices)
    return prices
  }

  /** What each feed answered, once, however many coins read it. */
  const answered = new Map<string, { usd: number; updatedAt: number }>()
  addresses.forEach((address, index) => {
    const row = answers[index]
    const feed = feeds.get(address)
    if (!row || !feed) return
    const value = decodeFeed(row, feed, now)
    if (value) answered.set(address, value)
  })

  /** A coin's price, from its feed's answer and an optional vault rate. */
  const priced = (coin: PricedCoin, feed: Feed, rate?: number) => {
    const value = answered.get(feed.address)
    if (!value) return
    prices[coin.key] = {
      usd: rate === undefined ? value.usd : value.usd * rate,
      updatedAt: value.updatedAt,
      staleAfter: value.updatedAt + feed.heartbeat + STALE_SLACK_S,
      pair: feed.pair,
      via: rate === undefined ? undefined : feed.asset,
    }
  }

  for (const { coin, feed } of direct) priced(coin, feed)
  through.forEach(({ coin, feed }, index) => {
    const row = answers[addresses.length + probes.length + index]
    const rate = row ? decodeRate(row, feed) : null
    if (rate !== null) priced(coin, feed, rate)
  })

  /*
   * What the probes found. A token whose `asset()` answers an address this
   * table prices is a vault worth a second call; anything else is recorded as
   * not a vault, so it is never probed again this session.
   */
  const found: { coin: PricedCoin; feed: Feed }[] = []
  probes.forEach((coin, index) => {
    const row = answers[addresses.length + index]
    const answered = row ? decodeAddress(row) : null
    // Only the asset the allowlist names for this vault.
    const asset =
      answered && answered.toLowerCase() === VAULTS[coin.key] ? answered : null
    const feed = asset ? FEEDS[coinKey(chainId, asset)] : undefined
    vaultAssets.set(coin.key, feed && asset ? asset : null)
    if (feed) found.push({ coin, feed })
  })
  if (found.length > 0) {
    const rates = await aggregate(
      chainId,
      found.map(({ coin }) => rateCall(coin)),
    )
    found.forEach(({ coin, feed }, index) => {
      const row = rates?.[index]
      const rate = row ? decodeRate(row, feed) : null
      if (rate !== null) priced(coin, feed, rate)
    })
  }

  warnUnpriced([...direct, ...through, ...found], prices)
  return prices
}

/**
 * Dollars per whole coin, for the coins given, keyed by `PricedCoin.key`. A
 * coin whose price could not be read is missing from the result rather than
 * present with a zero.
 *
 * Sepolia is left out entirely: testnet ETH is not ETH, and a dollar figure
 * beside it would be the one figure on the page that means nothing.
 */
export const readUsdPrices = async (
  coins: PricedCoin[],
): Promise<Record<string, UsdPrice>> => {
  const now = Math.floor(Date.now() / 1000)
  const byChain = new Map<number, PricedCoin[]>()
  for (const coin of coins) {
    if (TESTNET_CHAIN_IDS.includes(coin.chainId)) continue
    const list = byChain.get(coin.chainId) ?? []
    if (!list.some((seen) => seen.key === coin.key)) list.push(coin)
    byChain.set(coin.chainId, list)
  }
  const reads = await Promise.all(
    [...byChain].map(([chainId, list]) => readChain(chainId, list, now)),
  )
  return Object.assign({}, ...reads) as Record<string, UsdPrice>
}

/** "the DAI / USD feed, read 3 hours 58 min ago" */
export const priceSource = (price: UsdPrice, now?: number): string => {
  const age = (now ?? Math.floor(Date.now() / 1000)) - price.updatedAt
  const read =
    age < 60 ? 'read just now' : `read ${formatDurationLong(age)} ago`
  const through = price.via ? ` through ${price.via}` : ''
  return `the ${price.pair} feed${through}, ${read}`
}
