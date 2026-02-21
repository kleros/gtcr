import React, { createContext } from 'react'
import useLightTcrView from 'hooks/light-tcr-view'

const LightTCRViewContext = createContext<any>(undefined)
const LightTCRViewProvider = ({
  children,
  tcrAddress
}: {
  children: React.ReactNode
  tcrAddress: string
}) => (
  <LightTCRViewContext.Provider value={{ ...useLightTcrView(tcrAddress) }}>
    {children}
  </LightTCRViewContext.Provider>
)

export { LightTCRViewContext, LightTCRViewProvider }
