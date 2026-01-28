import React, { useContext, useEffect } from 'react'
import { TCRViewProvider } from 'contexts/tcr-view-context'
import { LightTCRViewProvider } from 'contexts/light-tcr-view-context'
import loadable from '@loadable/component'
import { useParams } from 'react-router'
import Loading from 'components/loading'
import useTcrNetwork from 'hooks/use-tcr-network'
import { NETWORK_STATUS } from 'config/networks'
import useCheckLightCurate from 'hooks/use-check-light-curate'
import { StakeContext } from 'contexts/stake-context'

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

const PermanentItems = loadable(
  () => import(/* webpackPrefetch: true */ './permanent-items/index'),
  {
    fallback: <Loading />
  }
)

const ItemsRouter = () => {
  const { tcrAddress } = useParams<{ tcrAddress: string }>()
  const { isLightCurate, isClassicCurate, checking } = useCheckLightCurate()
  const { networkStatus } = useTcrNetwork()
  const { setIsPermanent } = useContext(StakeContext)

  const isPermanent = !checking && !isLightCurate && !isClassicCurate
  useEffect(() => {
    setIsPermanent(isPermanent)
    return () => setIsPermanent(false)
  }, [isPermanent, setIsPermanent])

  if (checking || networkStatus !== NETWORK_STATUS.supported) return <Loading />

  if (isLightCurate)
    return (
      <LightTCRViewProvider tcrAddress={tcrAddress}>
        <LightItems />
      </LightTCRViewProvider>
    )
  else if (isClassicCurate)
    return (
      <TCRViewProvider tcrAddress={tcrAddress}>
        <Items />
      </TCRViewProvider>
    )
  else return <PermanentItems />
}

export default ItemsRouter
