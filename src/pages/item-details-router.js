import React, { useEffect, useState } from 'react'
import { TCRViewProvider } from '../bootstrap/tcr-view-context'
import { LightTCRViewProvider } from '../bootstrap/light-tcr-view-context'
import loadable from '@loadable/component'
import styled from 'styled-components'
import { Layout, Spin } from 'antd'
import PropTypes from 'prop-types'
import { useWeb3Context } from 'web3-react'
import _gtcr from '../assets/abis/LightGeneralizedTCR.json'
import { ethers } from 'ethers'

const StyledLayoutContent = styled(Layout.Content)`
  padding: 42px 9.375vw 42px;
`

const StyledSpin = styled(Spin)`
  left: 50%;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
`

const LightItemDetails = loadable(
  () => import(/* webpackPrefetch: true */ './light-item-details/index'),
  {
    fallback: (
      <StyledLayoutContent>
        <StyledSpin />
      </StyledLayoutContent>
    )
  }
)

const ItemDetails = loadable(
  () => import(/* webpackPrefetch: true */ './item-details/index'),
  {
    fallback: (
      <StyledLayoutContent>
        <StyledSpin />
      </StyledLayoutContent>
    )
  }
)

const ItemDetailsRouter = ({ search, tcrAddress, history, itemID }) => {
  const [isLightCurate, setIsLightCurate] = useState()
  const { library, active } = useWeb3Context()

  useEffect(() => {
    ;(async () => {
      try {
        if (!active) return
        const tcr = new ethers.Contract(tcrAddress, _gtcr, library)

        // Call a function only available on light TCR. If
        // it throws, its not a light curate instance.
        await tcr.relayContract()
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

  if (typeof isLightCurate === 'undefined') return null // Loading...

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

ItemDetailsRouter.propTypes = {
  search: PropTypes.string.isRequired,
  tcrAddress: PropTypes.string.isRequired,
  history: PropTypes.shape({}).isRequired
}

export default ItemDetailsRouter
