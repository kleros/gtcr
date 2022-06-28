import React, { createContext } from 'react'
import useLightTcrContext, {
  LightTcrContext
} from 'hooks/use-light-tcr-context'

type Props = {
  tcrAddress: string
  children: React.ReactNode
}

const LightTCRViewContext = createContext<LightTcrContext>({
  loading: false,
  items: [],
  metaEvidence: undefined,
  tcrAddress: '',
  regData: undefined,
  error: undefined
})
const LightTCRViewProvider: React.FC<Props> = ({ children }) => (
  <LightTCRViewContext.Provider value={useLightTcrContext()}>
    {children}
  </LightTCRViewContext.Provider>
)

export { LightTCRViewContext, LightTCRViewProvider }
