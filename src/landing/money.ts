import { gql } from 'graphql-request'
import { request } from 'utils/indexer-request'
import { subgraphUrl, subgraphUrlPermanent } from 'config/tcr-addresses'
import type { DashboardData, TokenInfo } from 'pages/dashboard/types'
import { coinKey, readUsdPrices, type PricedCoin } from 'pages/dashboard/prices'
import { readTokens } from 'pages/dashboard/tokens'
import { toAmount } from 'pages/dashboard/view'
import { ETH_USD_MONTHLY } from './eth-usd-monthly'

/*
 * The landing page's two dollar figures (round 14: "just put the cumulative
 * bounties + a number of the cumulative money locked over time … the number
 * of items x their own deposit"):
 *   - bounties: what challengers have won, all time: every winning ruling in
 *     the dashboard's ledger that carried an amount, the retired Classic
 *     lists included (the dashboard's "Bounties won");
 *   - deposits: what submitters have locked to submit an entry, all time. On
 *     Standard and Classic lists, the requester's payment in the request's
 *     first round, what the wallet sent: the base deposit and the
 *     arbitration cost. On Stake lists, the stake and the arbitration
 *     deposit. Removal requests and challenges are not submissions.
 * Every amount is valued in dollars at its own time, so a deposit made when
 * ETH was at $200 counts $200 an ETH: ETH at its month's average price
 * (eth-usd-monthly.ts; a month the table does not reach yet, at today's
 * price), xDAI as one dollar (it is bridged DAI), a Stake list's token at
 * today's price (prices.ts: its vault rate over DAI). An amount nothing can
 * price fails the read, so the page keeps its dated snapshot rather than
 * print a total with a coin left out.
 */

/** Rows per indexer page; both indexers serve up to 1,000. */
const PAGE = 1000
/** Pages asked at once (the Envio ones go out as one batched request). */
const WAVE = 6
/** Far past today's ~33 pages a chain: past it the read is not trusted. */
const MAX_PAGES = 200
/** Budget for a Stake token's symbol and decimals. */
const TOKEN_BUDGET_MS = 4000

const ETHEREUM = 1
const GNOSIS = 100

export interface LandingMoney {
  /** Bounties challengers have won, all time, in dollars at each ruling. */
  bounties: number
  /** The winning rulings those dollars add up (each carried an amount). */
  bountiesPaid: number
  /** The rulings ledger stopped at its page limit: a lower bound. */
  bountiesCapped: boolean
  /** Deposits submitters have locked, all time, in dollars at each. */
  deposits: number
  /** The submissions those deposits came with. */
  submissions: number
}

/** One amount someone paid, in a coin's smallest unit, and when. */
interface Payment {
  chainId: number
  /** A Stake list's ERC-20, lowercase; absent for the chain's own coin. */
  token?: string
  amount: bigint
  /** Unix seconds. */
  at: number
}

const requestDeposits = (entity: 'LRequest' | 'Request') => gql`
  query LandingDeposits($chainId: Int!, $offset: Int!) {
    rows: ${entity}(
      limit: ${PAGE}
      offset: $offset
      where: {
        chainId: { _eq: $chainId }
        requestType: { _eq: "RegistrationRequested" }
      }
      order_by: { id: asc }
    ) {
      submissionTime
      rounds(limit: 1, order_by: { creationTime: asc }) {
        amountPaidRequester
      }
    }
  }
`

const STANDARD_DEPOSITS = requestDeposits('LRequest')
const CLASSIC_DEPOSITS = requestDeposits('Request')

const STAKE_DEPOSITS = gql`
  query LandingStakeDeposits($skip: Int!) {
    rows: submissions(
      first: ${PAGE}
      skip: $skip
      orderBy: id
      orderDirection: asc
    ) {
      createdAt
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

/** Every page of a read, a wave at a time, until one comes back short. */
const pageAll = async <T>(read: (page: number) => Promise<T[]>) => {
  const rows: T[] = []
  for (let first = 0; first < MAX_PAGES; first += WAVE) {
    const pages = await Promise.all(
      Array.from({ length: WAVE }, (_, index) => read(first + index)),
    )
    for (const page of pages) rows.push(...page)
    if (pages.some((page) => page.length < PAGE)) return rows
  }
  throw new Error('The deposits ran past the page limit')
}

type RequestRow = {
  submissionTime: string
  rounds: { amountPaidRequester: string }[]
}

type StakeRow = {
  createdAt: string
  initialStake: string
  arbitrationDeposit: string | null
  item: { registry: { token: string } | null } | null
}

/** What submitters paid on one chain: Standard, Classic and Stake lists. */
const chainDeposits = async (
  chainId: number,
): Promise<{ payments: Payment[]; submissions: number }> => {
  const envio = subgraphUrl[chainId]
  if (!envio) throw new Error(`No Standard indexer for chain ${chainId}`)
  const requestRows = (document: typeof STANDARD_DEPOSITS) =>
    pageAll((page) =>
      request<{ rows: RequestRow[] }>(envio, document, {
        chainId,
        offset: page * PAGE,
      }).then((answer) => answer.rows),
    )
  const stake = subgraphUrlPermanent[chainId]
  const [standard, classic, staked] = await Promise.all([
    requestRows(STANDARD_DEPOSITS),
    requestRows(CLASSIC_DEPOSITS),
    stake
      ? pageAll((page) =>
          request<{ rows: StakeRow[] }>(stake, STAKE_DEPOSITS, {
            skip: page * PAGE,
          }).then((answer) => answer.rows),
        )
      : Promise.resolve([] as StakeRow[]),
  ])
  const payments: Payment[] = [...standard, ...classic].map((row) => ({
    chainId,
    amount: toAmount(row.rounds[0]?.amountPaidRequester),
    at: Number(row.submissionTime),
  }))
  for (const row of staked) {
    const token = row.item?.registry?.token?.toLowerCase()
    if (!token) throw new Error('A Stake submission without its list token')
    const at = Number(row.createdAt)
    payments.push(
      { chainId, token, amount: toAmount(row.initialStake), at },
      { chainId, amount: toAmount(row.arbitrationDeposit), at },
    )
  }
  return {
    payments: payments.filter((payment) => payment.amount > 0n),
    submissions: standard.length + classic.length + staked.length,
  }
}

/** Every chain's submission deposits; throws if any chain's read fails. */
export const readDeposits = async (chains: number[]) => {
  const perChain = await Promise.all(chains.map(chainDeposits))
  return {
    payments: perChain.flatMap((chain) => chain.payments),
    submissions: perChain.reduce((sum, chain) => sum + chain.submissions, 0),
  }
}

/**
 * The two figures, from the dashboard load (its rulings ledger) and the
 * deposits read. Throws when an amount cannot be priced.
 */
export const landingMoney = async (
  data: DashboardData,
  chains: number[],
  { payments: deposits, submissions }: Awaited<ReturnType<typeof readDeposits>>,
): Promise<LandingMoney> => {
  const bounties: Payment[] = []
  for (const chainId of chains)
    for (const row of data.rulings?.[chainId] ?? []) {
      const amount = toAmount(row.bounty)
      if (!row.challengerWon || amount === 0n) continue
      const stake = row.kind === 'permanent'
      if (stake && !row.token)
        throw new Error('A Stake bounty without its list token')
      bounties.push({
        chainId,
        token: stake ? row.token?.toLowerCase() : undefined,
        amount,
        at: row.resolvedAt,
      })
    }

  // Decimals of every Stake token paid in, read when the load lacks them.
  const payments = [...bounties, ...deposits]
  const tokenKeys = new Map<string, { chainId: number; token: string }>()
  for (const { chainId, token } of payments)
    if (token) tokenKeys.set(coinKey(chainId, token), { chainId, token })
  const known: Record<string, TokenInfo> = {}
  const unread: { chainId: number; token: string }[] = []
  for (const [key, coin] of tokenKeys) {
    const info = data.tokens?.[key]
    if (info) known[key] = info
    else unread.push(coin)
  }
  const tokens = {
    ...known,
    ...(unread.length > 0 ? await readTokens(unread, TOKEN_BUDGET_MS) : {}),
  }

  // Today's prices: ETH for a month past the table, every Stake token.
  const priced: PricedCoin[] = [
    { key: coinKey(ETHEREUM), chainId: ETHEREUM, decimals: 18 },
  ]
  for (const [key, { chainId, token }] of tokenKeys) {
    const decimals = tokens[key]?.decimals
    if (decimals === undefined)
      throw new Error(`No decimals for the Stake token ${key}`)
    priced.push({ key, chainId, token, decimals })
  }
  const today = await readUsdPrices(priced)

  const dollars = (payment: Payment): number => {
    const { chainId, token, amount, at } = payment
    if (token) {
      const key = coinKey(chainId, token)
      const decimals = tokens[key]?.decimals
      const usd = today[key]?.usd
      if (decimals === undefined || usd === undefined)
        throw new Error(`No dollar price for ${key}`)
      return (Number(amount) / 10 ** decimals) * usd
    }
    const coins = Number(amount) / 1e18
    if (chainId === GNOSIS) return coins
    if (chainId === ETHEREUM) {
      const month = new Date(at * 1000).toISOString().slice(0, 7)
      const usd = ETH_USD_MONTHLY[month] ?? today[coinKey(ETHEREUM)]?.usd
      if (usd === undefined) throw new Error(`No ETH price for ${month}`)
      return coins * usd
    }
    throw new Error(`No dollar price for chain ${chainId}'s coin`)
  }

  const sum = (list: Payment[]) =>
    list.reduce((total, payment) => total + dollars(payment), 0)
  return {
    bounties: sum(bounties),
    bountiesPaid: bounties.length,
    bountiesCapped: chains.some((chainId) => data.rulingsCapped?.[chainId]),
    deposits: sum(deposits),
    submissions,
  }
}
