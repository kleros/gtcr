import type { DashboardData } from 'pages/dashboard/types'
import {
  bountyTotals,
  readTransit,
  totalInDollars,
  type Transit,
} from 'pages/dashboard/transit'
import { scopedBounties } from 'pages/dashboard/view'

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

type BountyFigure = Pick<
  LandingMoney,
  'bounties' | 'bountiesPaid' | 'bountiesCapped'
>
type TransitFigure = Pick<LandingMoney, 'transit' | 'requests'>

/**
 * The two figures, each on its own: one that cannot be read or priced is
 * left out (the caller keeps the snapshot's), and never takes the other
 * down with it.
 */
export const landingMoney = async (
  data: DashboardData,
  chains: number[],
  transit: Promise<Transit>,
): Promise<Partial<LandingMoney>> => {
  const bountyFigure = async (): Promise<BountyFigure> => {
    // A chain whose rulings ledger did not load would leave its bounties out.
    if (scopedBounties(data, chains).missing.length > 0)
      throw new Error('A rulings ledger did not load')
    const bounties = bountyTotals(data, chains)
    return {
      bounties: await totalInDollars(
        Object.values(bounties.totals),
        data.tokens,
      ),
      bountiesPaid: bounties.paid,
      bountiesCapped: chains.some((chainId) => data.rulingsCapped?.[chainId]),
    }
  }
  const transitFigure = async (): Promise<TransitFigure> => {
    const read = await transit
    return {
      transit: await totalInDollars(Object.values(read.totals), data.tokens),
      requests: read.requests,
    }
  }
  const [bounties, transitTotal] = await Promise.allSettled([
    bountyFigure(),
    transitFigure(),
  ])
  return {
    ...(bounties.status === 'fulfilled' ? bounties.value : {}),
    ...(transitTotal.status === 'fulfilled' ? transitTotal.value : {}),
  }
}
