import React, { useEffect, useState } from 'react'
import { TCRViewProvider } from '../bootstrap/tcr-view-context'
import { LightTCRViewProvider } from '../bootstrap/light-tcr-view-context'
import loadable from '@loadable/component'
import styled from 'styled-components'
import { Layout, Spin } from 'antd'
import PropTypes from 'prop-types'
import _gtcr from '../assets/abis/GeneralizedTCR.json'
import { useWeb3Context } from 'web3-react'
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

const LightItems = loadable(
  () => import(/* webpackPrefetch: true */ './light-items/index'),
  {
    fallback: (
      <StyledLayoutContent>
        <StyledSpin />
      </StyledLayoutContent>
    )
  }
)

const Items = loadable(
  () => import(/* webpackPrefetch: true */ './items/index'),
  {
    fallback: (
      <StyledLayoutContent>
        <StyledSpin />
      </StyledLayoutContent>
    )
  }
)

const ItemsRouter = ({ search, tcrAddress, history }) => {
  const [isLightCurate, setIsLightCurate] = useState()
  const { library, active } = useWeb3Context()

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

  if (typeof isLightCurate === 'undefined') return <StyledSpin />

  if (isLightCurate)
    return (
      <LightTCRViewProvider tcrAddress={tcrAddress}>
        <LightItems search={search} history={history} />
      </LightTCRViewProvider>
    )

  return (
    <TCRViewProvider tcrAddress={tcrAddress}>
      <Items search={search} history={history} />
    </TCRViewProvider>
  )
}

ItemsRouter.propTypes = {
  search: PropTypes.string.isRequired,
  tcrAddress: PropTypes.string.isRequired,
  history: PropTypes.shape({}).isRequired
}

export default ItemsRouter
