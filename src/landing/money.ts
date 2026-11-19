import type { DashboardData } from 'pages/dashboard/types'
import {
  bountyTotals,
  readTransit,
  totalInDollars,
  type Transit,
} from 'pages/dashboard/transit'

/*
 * The landing page's two dollar figures, all time, at today's prices
 * (rounds 14 and 15; pages/dashboard/transit.ts says what each counts):
 *   - bounties: what challengers have won, every winning ruling that
 *     carried an amount, the retired Classic lists included;
 *   - transit: what has passed through the contracts: deposits,
 *     challenges and appeals, on every list.
 */

export interface LandingMoney {
  /** Bounties challengers have won, all time, in dollars. */
  bounties: number
  /** The winning rulings those dollars add up (each carried an amount). */
  bountiesPaid: number
  /** The rulings ledger stopped at its page limit: a lower bound. */
  bountiesCapped: boolean
  /** Everything paid in to a list, all time, in dollars. */
  transit: number
  /** Requests (submissions and removal requests) and Stake submissions. */
  requests: number
}

export { readTransit }

/** The two figures; throws when an amount cannot be priced. */
export const landingMoney = async (
  data: DashboardData,
  chains: number[],
  transit: Transit,
): Promise<LandingMoney> => {
  const bounties = bountyTotals(data, chains)
  const [bountyDollars, transitDollars] = await Promise.all([
    totalInDollars(Object.values(bounties.totals), data.tokens),
    totalInDollars(Object.values(transit.totals), data.tokens),
  ])
  return {
    bounties: bountyDollars,
    bountiesPaid: bounties.paid,
    bountiesCapped: chains.some((chainId) => data.rulingsCapped?.[chainId]),
    transit: transitDollars,
    requests: transit.requests,
  }
}
