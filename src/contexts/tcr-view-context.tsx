import React, { createContext, useMemo } from 'react'
import useTcrView from '../hooks/tcr-view'

const TCRViewContext = createContext<Record<string, unknown> | undefined>(
  undefined,
)
const TCRViewProvider = ({
  children,
  tcrAddress,
}: {
  children: React.ReactNode
  tcrAddress: string
}) => {
  const ctx = useTcrView(tcrAddress)
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
    ],
  )
  return (
    <TCRViewContext.Provider value={value}>{children}</TCRViewContext.Provider>
  )
}

export { TCRViewContext, TCRViewProvider }
