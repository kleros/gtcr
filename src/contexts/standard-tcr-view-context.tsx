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
  // Memoized on the fields readers use, by hand. The governor is one of
  // them on its own account: the list page shows its governor a control
  // and hides it once a transfer is read, which must not depend on a
  // refetch happening to rebuild the deposits too.
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
      ctx.metaEvidenceFailed,
      ctx.paramsFailed,
      ctx.governor,
    ],
  )
  return (
    <StandardTCRViewContext.Provider value={value}>
      {children}
    </StandardTCRViewContext.Provider>
  )
}

export { StandardTCRViewContext, StandardTCRViewProvider }
