import React, { useEffect, useState } from 'react'
import { TCRViewProvider } from 'contexts/tcr-view-context'
import { LightTCRViewProvider } from 'contexts/light-tcr-view-context'
import loadable from '@loadable/component'
import _gtcr from '../assets/abis/GeneralizedTCR.json'
import { useWeb3Context } from 'web3-react'
import { ethers } from 'ethers'
import { useParams } from 'react-router'
import Loading from 'components/loading'
import useTcrNetwork from 'hooks/use-tcr-network'
import { NETWORK_STATUS } from 'config/networks'

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
  const { tcrAddress } = useParams()
  const [isLightCurate, setIsLightCurate] = useState()
  const { library, active } = useWeb3Context()
  const { networkStatus } = useTcrNetwork()

  useEffect(() => {
    ;(async () => {
      try {
        if (!active) return
        const tcr = new ethers.Contract(tcrAddress, _gtcr, library)

        // Call a function only available on GTCR Classic. If
        // it throws, its not a light curate instance.
        await tcr.itemCount()
        setIsLightCurate(false)
        // eslint-disable-next-line no-unused-vars
      } catch (err) {
        console.info(
          `Contract call used to verify if this is a Light Curate instance. Ignore exception.`
        )
        setIsLightCurate(true)
      }
    })()
  }, [active, library, tcrAddress])

  if (
    typeof isLightCurate === 'undefined' ||
    networkStatus !== NETWORK_STATUS.supported
  )
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
