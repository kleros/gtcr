import React, { createContext } from 'react'
import useLightTcrContext, {
  ItemsWhere,
  LightTcrContext
} from 'hooks/use-light-tcr-context'
import { OrderDir } from 'types/schema'

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
  error: undefined,
  page: 0,
  setPage: (page: number) => {},
  itemsWhere: { registry: '' },
  setItemsWhere: (wh: ItemsWhere) => {},
  orderDir: OrderDir.asc,
  setOrderDir: (dir: OrderDir) => {}
})
const LightTCRViewProvider: React.FC<Props> = ({ tcrAddress, children }) => (
  <LightTCRViewContext.Provider value={useLightTcrContext(tcrAddress)}>
    {children}
  </LightTCRViewContext.Provider>
)

export { LightTCRViewContext, LightTCRViewProvider }
