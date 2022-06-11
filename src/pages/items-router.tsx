import React from 'react'
import { TCRViewProvider } from 'contexts/tcr-view-context'
import loadable from '@loadable/component'
import Loading from 'components/loading'
import useTcrNetwork from 'hooks/use-tcr-network'
import { NETWORK_STATUS } from 'config/networks'
import useCheckLightCurate from 'hooks/use-check-light-curate'
import useTcrParams from 'hooks/use-tcr-params'
import { LightTCRViewProvider } from 'contexts/light-tcr-view-context'

const LightItems = loadable(
  () => import(/* webpackPrefetch: true */ './light-items-new/index'),
  {
    fallback: <Loading />
  }
)

const Items = loadable(
  () => import(/* webpackPrefetch: true */ './items/index'),
  {
    fallback: <Loading />
  }
)

const ItemsRouter = () => {
  const { tcrAddress } = useTcrParams()
  const { isLightCurate, checking } = useCheckLightCurate()
  const { networkStatus } = useTcrNetwork()

  if (checking || networkStatus !== NETWORK_STATUS.supported) return <Loading />

  if (isLightCurate)
    return (
      <LightTCRViewProvider tcrAddress={tcrAddress}>
        <LightItems />
      </LightTCRViewProvider>
    )

  return (
    <TCRViewProvider tcrAddress={tcrAddress}>
      <Items />
    </TCRViewProvider>
  )
}

export default ItemsRouter
