import React, { createContext, useMemo } from 'react'
import useStandardTcrView from 'hooks/standard-tcr-view'

export type StandardTCRViewContextValue = ReturnType<typeof useStandardTcrView>

const StandardTCRViewContext = createContext<
  StandardTCRViewContextValue | undefined
>(undefined)
const StandardTCRViewProvider = ({
  children,
  tcrAddress,
}: {
  children: React.ReactNode
  tcrAddress: string
}) => {
  const ctx = useStandardTcrView(tcrAddress)
  const value = useMemo(
    () => ctx,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      ctx.gtcr,
      ctx.metaEvidence,
      ctx.tcrError,
      ctx.arbitrationCost,
      ctx.submissionDeposit,
      ctx.submissionChallengeDeposit,
      ctx.removalDeposit,
      ctx.removalChallengeDeposit,
      ctx.tcrAddress,
      ctx.gtcrView,
      ctx.latestBlock,
      ctx.connectedTCRAddr,
      ctx.metaEvidenceFailed,
      ctx.paramsFailed,
    ],
  )
  return (
    <StandardTCRViewContext.Provider value={value}>
      {children}
    </StandardTCRViewContext.Provider>
  )
}

export { StandardTCRViewContext, StandardTCRViewProvider }
