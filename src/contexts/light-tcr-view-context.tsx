import React, { createContext, useMemo } from 'react'
import useLightTcrView from 'hooks/light-tcr-view'

const LightTCRViewContext = createContext<Record<string, unknown> | undefined>(undefined)
const LightTCRViewProvider = ({
  children,
  tcrAddress
}: {
  children: React.ReactNode
  tcrAddress: string
}) => {
  const ctx = useLightTcrView(tcrAddress)
  const value = useMemo(() => ctx, [
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
    ctx.connectedTCRAddr
  ])
  return (
    <LightTCRViewContext.Provider value={value}>
      {children}
    </LightTCRViewContext.Provider>
  )
}

export { LightTCRViewContext, LightTCRViewProvider }
