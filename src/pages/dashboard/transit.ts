import { gql } from 'graphql-request'
import { request } from 'utils/indexer-request'
import { subgraphUrl, subgraphUrlPermanent } from 'config/tcr-addresses'
import { coinKey, hasPricePath, readUsdPrices } from './prices'
import { keptRead } from './saved-load'
import { readTokens } from './tokens'
import type { DashboardData, TokenInfo } from './types'
import { TESTNET_CHAIN_IDS, toAmount } from './view'

/*
 * What has passed through the Curate contracts, all time (round 15: "add
 * the appeals costs and challenge deposits to the count and put a label …
 * 'transiting value' … it passed from our contracts but not permanent"):
 * every amount paid in to a list, which the contracts hand back or pay out
 * and never keep.
 *   - Standard and Classic lists: both sides of every round of every
 *     request, submissions and removal requests alike. Round 0 holds the
 *     requester's deposit and, when challenged, the challenger's (each a
 *     base deposit and the arbitration cost); later rounds hold the appeal
 *     funding of both sides.
 *   - Stake lists: each submission's stake and arbitration deposit, each
 *     challenge's stake, and the appeal funding of both sides. The court fee
 *     a Stake challenger sends is not indexed, so it is left out (seven
 *     challenges when this was written).
 * Dollars are at today's prices (round 15: "calculate always at today's
 * price"), read on chain like the dashboard's other dollar figures
 * (prices.ts). A chain's own coin with no current price fails the total
 * (it is most of it); a Stake list's ERC-20 with no price or no decimals is
 * left out of it, since anyone can open a Stake list on any token. It is
 * shown in the dashboard's Self-sustaining mechanism and on the landing
 * page, the only totals across coins with the bounties (DESIGN.md, Data
 * rules).
 *
 * The coin totals are kept across page loads (saved-load.ts keptRead) and
 * priced again on every read, so the dollars stay at today's prices while
 * the pages are walked at most once an hour. Testnets are never read.
 */

const PAGE = 1000
/** Pages asked at once; the Envio ones go out as one batched request. */
const WAVE = 6
/**
 * Stake pages asked at once: one. The Stake indexer takes no batches, so
 * every page is a request of its own, and its tables are small (under a
 * page each when this was written): six at a time sent five empty pages
 * per table, beside the page's own Stake reads.
 */
const STAKE_WAVE = 1
/** Far past today's ~33 pages a chain: past it the read is not trusted. */
const MAX_PAGES = 200
const TOKEN_BUDGET_MS = 4000
/** How long the coin totals are kept across page loads. */
const TRANSIT_KEPT_MS = 60 * 60_000

/** One coin's total, in its smallest unit. */
export interface CoinTotal {
  chainId: number
  /** A Stake list's ERC-20, lowercase; absent for the chain's own coin. */
  token?: string
  amount: bigint
}

export interface Transit {
  /** Every coin's total, keyed by coinKey. */
  totals: Record<string, CoinTotal>
  /** Requests (submissions and removal requests) and Stake submissions. */
  requests: number
}

const requestRounds = (entity: 'LRequest' | 'Request') => gql`
  query TransitRequests($chainId: Int!, $offset: Int!) {
    rows: ${entity}(
      limit: ${PAGE}
      offset: $offset
      where: { chainId: { _eq: $chainId } }
      order_by: { id: asc }
    ) {
      rounds {
        amountPaidRequester
        amountPaidChallenger
      }
    }
  }
`

const STANDARD_ROUNDS = requestRounds('LRequest')
const CLASSIC_ROUNDS = requestRounds('Request')

const STAKE_SUBMISSIONS = gql`
  query TransitStakeSubmissions($skip: Int!) {
    rows: submissions(first: ${PAGE}, skip: $skip, orderBy: id) {
      initialStake
      arbitrationDeposit
      item {
        registry {
          token
        }
      }
    }
  }
`

const STAKE_CHALLENGES = gql`
  query TransitStakeChallenges($skip: Int!) {
    rows: challenges(first: ${PAGE}, skip: $skip, orderBy: id) {
      challengerStake
      rounds {
        amountPaidRequester
        amountPaidChallenger
      }
      item {
        registry {
          token
        }
      }
    }
  }
`

type Rounds = { amountPaidRequester: string; amountPaidChallenger: string }[]
type Token = { item: { registry: { token: string } | null } | null }

/** Every page of a read, a wave at a time, until one comes back short. */
const pageAll = async <T>(
  read: (page: number) => Promise<T[]>,
  wave = WAVE,
) => {
  const rows: T[] = []
  for (let first = 0; first < MAX_PAGES; first += wave) {
    // A page that fails is asked once more on its own: retrying the whole
    // read would walk every page again on the shared limit.
    const pages = await Promise.all(
      Array.from({ length: wave }, (_, index) =>
        read(first + index).catch(() => read(first + index)),
      ),
    )
    for (const page of pages) rows.push(...page)
    if (pages.some((page) => page.length < PAGE)) return rows
  }
  throw new Error('The transit read ran past its page limit')
}

const paid = (rounds: Rounds) =>
  rounds.reduce(
    (sum, round) =>
      sum +
      toAmount(round.amountPaidRequester) +
      toAmount(round.amountPaidChallenger),
    0n,
  )

const listToken = (row: Token) => {
  const token = row.item?.registry?.token?.toLowerCase()
  if (!token) throw new Error('A Stake row without its list token')
  return token
}

/** Adds an amount to its coin's total. */
const add = (
  totals: Record<string, CoinTotal>,
  chainId: number,
  amount: bigint,
  token?: string,
) => {
  if (amount <= 0n) return
  const key = coinKey(chainId, token)
  const total = totals[key] ?? { chainId, token, amount: 0n }
  total.amount += amount
  totals[key] = total
}

const chainTransit = async (chainId: number, totals: Transit['totals']) => {
  const envio = subgraphUrl[chainId]
  if (!envio) throw new Error(`No Standard indexer for chain ${chainId}`)
  const stake = subgraphUrlPermanent[chainId]
  // Read alongside a page's first reads, never in their requests
  // (utils/indexer-request.ts: the background lane).
  const requests = (document: typeof STANDARD_ROUNDS) =>
    pageAll((page) =>
      request<{ rows: { rounds: Rounds }[] }>({
        url: envio,
        document,
        variables: { chainId, offset: page * PAGE },
        lane: 'background',
      }).then((answer) => answer.rows),
    )
  const stakeRows = <T>(document: typeof STAKE_SUBMISSIONS) =>
    stake
      ? pageAll(
          (page) =>
            request<{ rows: T[] }>({
              url: stake,
              document,
              variables: { skip: page * PAGE },
              lane: 'background',
            }).then((answer) => answer.rows),
          STAKE_WAVE,
        )
      : Promise.resolve([] as T[])
  const [standard, classic, submissions, challenges] = await Promise.all([
    requests(STANDARD_ROUNDS),
    requests(CLASSIC_ROUNDS),
    stakeRows<
      Token & { initialStake: string; arbitrationDeposit: string | null }
    >(STAKE_SUBMISSIONS),
    stakeRows<Token & { challengerStake: string; rounds: Rounds }>(
      STAKE_CHALLENGES,
    ),
  ])
  for (const row of [...standard, ...classic])
    add(totals, chainId, paid(row.rounds))
  for (const row of submissions) {
    add(totals, chainId, toAmount(row.initialStake), listToken(row))
    add(totals, chainId, toAmount(row.arbitrationDeposit))
  }
  for (const row of challenges) {
    add(totals, chainId, toAmount(row.challengerStake), listToken(row))
    add(totals, chainId, paid(row.rounds))
  }
  return standard.length + classic.length + submissions.length
}

/** Every chain's totals; throws if any chain's read fails. */
const fetchTransit = async (chains: number[]): Promise<Transit> => {
  const totals: Transit['totals'] = {}
  const counts = await Promise.all(
    chains.map((chainId) => chainTransit(chainId, totals)),
  )
  return { totals, requests: counts.reduce((sum, count) => sum + count, 0) }
}

/** Transit as it is kept: amounts as decimal strings (no bigint stored). */
interface KeptTransit {
  totals: Record<string, Omit<CoinTotal, 'amount'> & { amount: string }>
  requests: number
}

/**
 * Every mainnet chain's totals, kept across page loads for an hour and
 * shared by the dashboard and the landing page. Testnets are left out:
 * their coins have no price. Throws if any chain's read fails.
 */
export const readTransit = async (chains: number[]): Promise<Transit> => {
  const mainnets = chains.filter((id) => !TESTNET_CHAIN_IDS.includes(id))
  const kept = await keptRead<KeptTransit>(
    `transit:${mainnets.join(',')}`,
    TRANSIT_KEPT_MS,
    async () => {
      const read = await fetchTransit(mainnets)
      return {
        requests: read.requests,
        totals: Object.fromEntries(
          Object.entries(read.totals).map(([key, total]) => [
            key,
            { ...total, amount: total.amount.toString() },
          ]),
        ),
      }
    },
  )
  return {
    requests: kept.requests,
    totals: Object.fromEntries(
      Object.entries(kept.totals).map(([key, total]) => [
        key,
        { ...total, amount: BigInt(total.amount) },
      ]),
    ),
  }
}

/** The bounties challengers have won, per coin, from the rulings ledger. */
export const bountyTotals = (data: DashboardData, chains: number[]) => {
  const totals: Record<string, CoinTotal> = {}
  let paidOut = 0
  for (const chainId of chains)
    for (const row of data.rulings?.[chainId] ?? []) {
      const amount = toAmount(row.bounty)
      if (!row.challengerWon || amount === 0n) continue
      const stake = row.kind === 'permanent'
      if (stake && !row.token)
        throw new Error('A Stake bounty without its list token')
      add(totals, chainId, amount, stake ? row.token?.toLowerCase() : undefined)
      paidOut += 1
    }
  return { totals, paid: paidOut }
}

/**
 * Coin totals in dollars at today's prices. A token's decimals come from
 * the load when it has them, else they are read. A token with no decimals
 * or no way to a price is left out (Stake lists take any ERC-20); a chain's
 * own coin, or a token that has a feed or a priced vault, with no current
 * price throws: leaving it out would show part of the total as the whole.
 *
 * `everyCoin` is the bounties' rule (DESIGN.md: where any coin has no
 * current price, or a token's decimals never answered, there is no honest
 * total): any coin that cannot be priced throws, none is left out.
 */
export const totalInDollars = async (
  coins: CoinTotal[],
  known: Record<string, TokenInfo> = {},
  { everyCoin = false }: { everyCoin?: boolean } = {},
): Promise<number> => {
  const unread = coins.filter(
    (coin) => coin.token && !known[coinKey(coin.chainId, coin.token)],
  ) as { chainId: number; token: string }[]
  const tokens = {
    ...known,
    ...(unread.length > 0 ? await readTokens(unread, TOKEN_BUDGET_MS) : {}),
  }
  const priced = coins.flatMap((coin) => {
    const key = coinKey(coin.chainId, coin.token)
    const decimals = coin.token ? tokens[key]?.decimals : 18
    if (decimals === undefined) {
      if (everyCoin) throw new Error(`No decimals for ${key}`)
      return []
    }
    return [
      {
        key,
        chainId: coin.chainId,
        token: coin.token,
        decimals,
        amount: coin.amount,
      },
    ]
  })
  const prices = await readUsdPrices(priced)
  return priced.reduce((sum, coin) => {
    const usd = prices[coin.key]?.usd
    if (usd === undefined) {
      if (everyCoin || !coin.token || hasPricePath(coin.key))
        throw new Error(`No dollar price for ${coin.key}`)
      return sum
    }
    return sum + (Number(coin.amount) / 10 ** coin.decimals) * usd
  }, 0)
}
