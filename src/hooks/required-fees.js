import { useMemo } from 'react'
import { PARTY, SUBGRAPH_RULING } from '../utils/item-status'

const useRequiredFees = ({
  side,
  sharedStakeMultiplier,
  winnerStakeMultiplier,
  loserStakeMultiplier,
  item,
  MULTIPLIER_DIVISOR,
  appealCost
}) =>
  useMemo(() => {
    if (
      !sharedStakeMultiplier ||
      !winnerStakeMultiplier ||
      !loserStakeMultiplier ||
      !MULTIPLIER_DIVISOR ||
      !item ||
      item.resolved ||
      !appealCost
    )
      return {}

    const round = item.requests[0].rounds[0]
    const {
      ruling: currentRuling,
      amountPaidRequester,
      amountPaidChallenger
    } = round

    // Calculate the fee stake multiplier.
    // The fee stake is the reward shared among parties that crowdfunded
    // the appeal of the party that wins the dispute.
    const sideIsWinner =
      currentRuling === SUBGRAPH_RULING.NONE
        ? null
        : (currentRuling === SUBGRAPH_RULING.ACCEPT &&
            side === PARTY.REQUESTER) ||
          (currentRuling === SUBGRAPH_RULING.REJECT &&
            side === PARTY.CHALLENGER)
    const feeStakeMultiplier =
      sideIsWinner === null
        ? sharedStakeMultiplier
        : sideIsWinner
        ? winnerStakeMultiplier
        : loserStakeMultiplier

    // Calculate full cost to fund the side.
    // Full appeal cost = appeal cost + appeal cost * fee stake multiplier.
    const requiredForSide = appealCost.add(
      appealCost.mul(feeStakeMultiplier).div(MULTIPLIER_DIVISOR)
    )

    if (requiredForSide.isZero()) return {} // No fees required.

    const amountPaid = side === 1 ? amountPaidRequester : amountPaidChallenger
    // Calculate amount still required to fully fund the side.
    const amountStillRequired = requiredForSide.sub(amountPaid)

    // Calculate the max reward the user can earn by contributing fees.
    // Potential reward = appeal cost * opponent fee stake multiplier * share available for contribution.
    const opponentFeeStakeMultiplier =
      sideIsWinner === null
        ? sharedStakeMultiplier
        : sideIsWinner
        ? loserStakeMultiplier
        : winnerStakeMultiplier

    // This is the total potential reward if the user contributed 100% of the fees.
    const totalReward = appealCost
      .mul(opponentFeeStakeMultiplier)
      .div(MULTIPLIER_DIVISOR)

    // Available reward = opponent fee stake * % contributions pending.
    const potentialReward = amountStillRequired
      .mul(MULTIPLIER_DIVISOR)
      .div(requiredForSide)
      .mul(totalReward)
      .div(MULTIPLIER_DIVISOR)

    return { requiredForSide, amountStillRequired, potentialReward, appealCost }
  }, [
    MULTIPLIER_DIVISOR,
    item,
    loserStakeMultiplier,
    sharedStakeMultiplier,
    side,
    winnerStakeMultiplier,
    appealCost
  ])

export default useRequiredFees
