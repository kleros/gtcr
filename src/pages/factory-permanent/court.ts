import { useMemo } from 'react'
import { ethers } from 'ethers'
import { useEthersProvider } from 'hooks/ethers-adapters'
import useCourtPolicies from 'hooks/use-court-policies'
import { klerosAddresses } from 'config/tcr-addresses'
import { readExtraData } from './format'

/*
 * The court a draft Stake list points at, named the same way in the preview
 * and the review: the court's policy name when the arbitrator is the chain's
 * Kleros arbitrator ("Court N" while the policies load) and the juror count
 * from the extra data.
 */

const { getAddress } = ethers.utils

export type CourtSummary = {
  isKleros: boolean
  courtName?: string
  jurors?: number
  /** "xDai Curation · 3 jurors", or undefined when there is nothing to name. */
  text?: string
}

export const useCourtSummary = (
  chainId: number | undefined,
  arbitratorAddress: string | undefined,
  extraData: string | undefined,
): CourtSummary => {
  const library = useEthersProvider({ chainId })
  const { arbitrator: klerosAddress, policy: policyAddress } =
    (chainId !== undefined && klerosAddresses[chainId]) || {}
  let isKleros = false
  try {
    isKleros =
      getAddress(arbitratorAddress ?? '') === getAddress(klerosAddress ?? '')
  } catch {
    isKleros = false
  }
  const { data: courts = [] } = useCourtPolicies(
    isKleros ? policyAddress : undefined,
    library,
  )
  const extra = useMemo(
    () =>
      extraData && extraData.length >= 130 ? readExtraData(extraData) : null,
    [extraData],
  )

  if (!isKleros || !extra) return { isKleros }
  const courtName =
    courts.find((court) => court.courtID === extra.courtID)?.name ??
    `Court ${extra.courtID}`
  const jurors = extra.numberOfJurors
  return {
    isKleros,
    courtName,
    jurors,
    text: `${courtName} · ${jurors} ${jurors === 1 ? 'juror' : 'jurors'}`,
  }
}
