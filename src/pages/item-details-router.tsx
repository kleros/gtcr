import React, { useContext, useEffect } from 'react'
import { TCRViewProvider } from 'contexts/tcr-view-context'
import { LightTCRViewProvider } from 'contexts/light-tcr-view-context'
import loadable from '@loadable/component'
import { useParams } from 'react-router'
import useTcrNetwork from 'hooks/use-tcr-network'
import { NETWORK_STATUS } from 'config/networks'
import useCheckLightCurate from 'hooks/use-check-light-curate'
import Loading from 'components/loading'
import { StakeContext } from 'contexts/stake-context'

const PermanentItemDetails = loadable(
  () => import(/* webpackPrefetch: true */ './permanent-item-details/index'),
  {
    fallback: <Loading />
  }
)

const LightItemDetails = loadable(
  () => import(/* webpackPrefetch: true */ './light-item-details/index'),
  {
    fallback: <Loading />
  }
)

const ItemDetails = loadable(
  () => import(/* webpackPrefetch: true */ './item-details/index'),
  {
    fallback: <Loading />
  }
)

const ItemDetailsRouter = () => {
  const { tcrAddress, itemID } = useParams<{
    tcrAddress: string
    itemID: string
  }>()
  const { networkStatus } = useTcrNetwork()
  const search = window.location.search
  const {
    isLightCurate,
    isClassicCurate,
    isPermanentCurate,
    checking
  } = useCheckLightCurate()
  const { setIsPermanent } = useContext(StakeContext)

  useEffect(() => {
    setIsPermanent(isPermanentCurate)
    return () => setIsPermanent(false)
  }, [isPermanentCurate, setIsPermanent])

  if (checking || networkStatus !== NETWORK_STATUS.supported) return <Loading />

  if (isLightCurate)
    return (
      <LightTCRViewProvider tcrAddress={tcrAddress}>
        <LightItemDetails search={search} itemID={itemID} />
      </LightTCRViewProvider>
    )
  if (isClassicCurate)
    return (
      <TCRViewProvider tcrAddress={tcrAddress}>
        <ItemDetails search={search} itemID={itemID} />
      </TCRViewProvider>
    )
  if (isPermanentCurate)
    return <PermanentItemDetails search={search} itemID={itemID} />

  return <Loading />
}

export default ItemDetailsRouter
