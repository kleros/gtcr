import React, { useEffect, useState } from 'react'
import { TCRViewProvider } from 'contexts/tcr-view-context'
import { LightTCRViewProvider } from 'contexts/light-tcr-view-context'
import loadable from '@loadable/component'
import { useWeb3Context } from 'web3-react'
import _gtcr from '../assets/abis/LightGeneralizedTCR.json'
import { ethers } from 'ethers'
import { useHistory, useParams } from 'react-router'
import Loading from 'components/loading'
import useTcrNetwork from 'hooks/use-tcr-network'
import { NETWORK_STATUS } from 'config/networks'

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
  const { tcrAddress, itemID } = useParams()
  const { networkStatus } = useTcrNetwork()
  const history = useHistory()
  const search = window.location.search
  const [isLightCurate, setIsLightCurate] = useState()
  const { library, active } = useWeb3Context()

  useEffect(() => {
    ;(async () => {
      try {
        if (!active) return
        const tcr = new ethers.Contract(tcrAddress, _gtcr, library)

        // Call a function only available on light TCR. If
        // it throws, its not a light curate instance.
        await tcr.relayerContract()
        setIsLightCurate(true)
        // eslint-disable-next-line no-unused-vars
      } catch (err) {
        console.info(
          `Contract call used to verify if this is a Light Curate instance. Ignore exception.`
        )
        setIsLightCurate(false)
      }
    })()
  }, [active, library, tcrAddress])

  if (isLightCurate === undefined || networkStatus !== NETWORK_STATUS.supported)
    return <Loading />

  if (isLightCurate)
    return (
      <LightTCRViewProvider tcrAddress={tcrAddress}>
        <LightItemDetails search={search} history={history} itemID={itemID} />
      </LightTCRViewProvider>
    )

  return (
    <TCRViewProvider tcrAddress={tcrAddress}>
      <ItemDetails search={search} history={history} itemID={itemID} />
    </TCRViewProvider>
  )
}

export default ItemDetailsRouter
