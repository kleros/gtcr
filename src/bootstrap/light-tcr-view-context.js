import React, { createContext } from 'react'
import PropTypes from 'prop-types'
import useLightTcrView from '../hooks/light-tcr-view'

const LightTCRViewContext = createContext()
const LightTCRViewProvider = ({ children, tcrAddress }) => (
  <LightTCRViewContext.Provider value={{ ...useLightTcrView(tcrAddress) }}>
    {children}
  </LightTCRViewContext.Provider>
)

LightTCRViewProvider.propTypes = {
  children: PropTypes.node.isRequired,
  tcrAddress: PropTypes.string.isRequired
}

export { LightTCRViewContext, LightTCRViewProvider }
