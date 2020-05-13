import { useMemo } from 'react'
import { PARTY } from '../utils/item-status'

const useRequiredFees = ({
  side,
  sharedStakeMultiplier,
  winnerStakeMultiplier,
  loserStakeMultiplier,
  currentRuling,
  item,
  MULTIPLIER_DIVISOR
}) =>
  useMemo(() => {
    if (
      side === PARTY.NONE ||
      !sharedStakeMultiplier ||
      !winnerStakeMultiplier ||
      !loserStakeMultiplier ||
      !MULTIPLIER_DIVISOR ||
      typeof currentRuling === 'undefined' ||
      !item ||
      item.resolved
    )
      return {}

    const isFundingWinner =
      currentRuling !== PARTY.NONE
        ? null // Ignore if arbitrator did not give a decisive ruling.
        : currentRuling === PARTY.REQUESTER
        ? side === PARTY.REQUESTER
        : side === PARTY.CHALLENGER

    // Calculate the fee stake multiplier.
    // The fee stake is the reward shared among parties that crowdfunded
    // the appeal of the party that wins the dispute.
    const feeStakeMultiplier =
      currentRuling === PARTY.NONE
        ? sharedStakeMultiplier
        : isFundingWinner
        ? winnerStakeMultiplier
        : loserStakeMultiplier

    // Calculate full cost to fund the side.
    // Full appeal cost = appeal cost + appeal cost * fee stake multiplier.
    const { appealCost } = item
    const requiredForSide = appealCost.add(
      appealCost.mul(feeStakeMultiplier).div(MULTIPLIER_DIVISOR)
    )

    if (requiredForSide.isZero()) return {} // No fees required.

    // Calculate amount still required to fully fund the side.
    const amountStillRequired = requiredForSide.sub(item.amountPaid[side])

    // Calculate the max reward the user can earn by contributing fees.
    // Potential reward = appeal cost * opponent fee stake multiplier * share available for contribution.
    const opponentFeeStakeMultiplier =
      currentRuling === PARTY.NONE
        ? sharedStakeMultiplier
        : isFundingWinner
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
    currentRuling,
    item,
    loserStakeMultiplier,
    sharedStakeMultiplier,
    side,
    winnerStakeMultiplier
  ])

export default useRequiredFees
