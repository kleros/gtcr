import React, { createContext } from 'react'
import useTcrView from '../hooks/tcr-view'

const TCRViewContext = createContext<any>(undefined)
const TCRViewProvider = ({
  children,
  tcrAddress
}: {
  children: React.ReactNode
  tcrAddress: string
}) => (
  <TCRViewContext.Provider value={{ ...useTcrView(tcrAddress) }}>
    {children}
  </TCRViewContext.Provider>
)

export { TCRViewContext, TCRViewProvider }
