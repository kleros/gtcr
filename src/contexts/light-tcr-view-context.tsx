import React, { createContext } from 'react'
import useLightTcrContext from 'hooks/use-light-tcr-context'

type Props = {
  tcrAddress: string
  children: React.ReactNode
}

const LightTCRViewContext = createContext({})
const LightTCRViewProvider: React.FC<Props> = ({ tcrAddress, children }) => (
  <LightTCRViewContext.Provider value={useLightTcrContext(tcrAddress)}>
    {children}
  </LightTCRViewContext.Provider>
)

export { LightTCRViewContext, LightTCRViewProvider }
