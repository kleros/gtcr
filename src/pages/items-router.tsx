import React from 'react'
import { TCRViewProvider } from 'contexts/tcr-view-context'
import { LightTCRViewProvider } from 'contexts/light-tcr-view-context'
import loadable from '@loadable/component'
import { useParams } from 'react-router'
import Loading from 'components/loading'
import useTcrNetwork from 'hooks/use-tcr-network'
import { NETWORK_STATUS } from 'config/networks'
import useCheckLightCurate from 'hooks/use-check-light-curate'

const LightItems = loadable(
  () => import(/* webpackPrefetch: true */ './light-items/index'),
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
  const { tcrAddress } = useParams<{ tcrAddress: string }>()
  const [isLightCurate, checkingLightCurate] = useCheckLightCurate()
  const { networkStatus } = useTcrNetwork()

  if (checkingLightCurate || networkStatus !== NETWORK_STATUS.supported)
    return <Loading />

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
