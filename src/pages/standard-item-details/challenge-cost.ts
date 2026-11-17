import type { BigNumber } from 'ethers'
import useArbitrationCost from 'hooks/arbitration-cost'
import { useEthersProvider } from 'hooks/ethers-adapters'
import useUrlChainId from 'hooks/use-url-chain-id'

/*
 * What challenging the latest request costs. Both list contracts charge the
 * list's current challenge base deposit plus the arbitration cost of the
 * arbitrator and extra data the request was made with (challengeRequest in
 * GeneralizedTCR and LightGeneralizedTCR), not the list's current ones. The
 * two only differ when the governor changed them while the request was
 * open; otherwise the list's own figures are used, with no extra read.
 */

interface ListChallengeFigures {
  arbitrator?: string
  arbitratorExtraData?: string
  arbitrationCost?: BigNumber
  submissionChallengeBaseDeposit?: BigNumber
  removalChallengeBaseDeposit?: BigNumber
  submissionChallengeDeposit?: BigNumber
  removalChallengeDeposit?: BigNumber
}

export interface ChallengeCost {
  /** The list's challenge base deposit. */
  base?: BigNumber
  /** The arbitration cost of the request's own arbitrator and extra data. */
  arbitrationCost?: BigNumber
  /** What the challenge sends: the base deposit plus the arbitration cost. */
  total?: BigNumber
}

const sameHex = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

export const useChallengeCost = ({
  request,
  isRemoval,
  list,
}: {
  request?: { arbitrator?: string; arbitratorExtraData?: string }
  isRemoval: boolean
  list?: ListChallengeFigures
}): ChallengeCost => {
  const chainId = useUrlChainId()
  const library = useEthersProvider({ chainId: chainId ?? undefined })
  const base = isRemoval
    ? list?.removalChallengeBaseDeposit
    : list?.submissionChallengeBaseDeposit
  // Only a request whose settings are known and differ from the list's
  // needs a read of its own.
  const changed =
    !!request?.arbitrator &&
    request.arbitratorExtraData !== undefined &&
    !!list?.arbitrator &&
    list.arbitratorExtraData !== undefined &&
    (!sameHex(request.arbitrator, list.arbitrator) ||
      !sameHex(request.arbitratorExtraData, list.arbitratorExtraData))
  const { arbitrationCost: requestCost } = useArbitrationCost({
    address: changed ? request?.arbitrator : undefined,
    arbitratorExtraData: changed ? request?.arbitratorExtraData : undefined,
    library,
  })

  if (!changed)
    return {
      base,
      arbitrationCost: list?.arbitrationCost,
      total: isRemoval
        ? list?.removalChallengeDeposit
        : list?.submissionChallengeDeposit,
    }
  return {
    base,
    arbitrationCost: requestCost,
    total: base && requestCost ? base.add(requestCost) : undefined,
  }
}
