import React, { createContext } from 'react'
import PropTypes from 'prop-types'
import useTcrView from '../hooks/tcr-view'

const TCRViewContext = createContext()
const TCRViewProvider = ({ children, tcrAddress }) => (
  <TCRViewContext.Provider value={{ ...useTcrView(tcrAddress) }}>
    {children}
  </TCRViewContext.Provider>
)

TCRViewProvider.propTypes = {
  children: PropTypes.node.isRequired,
  tcrAddress: PropTypes.string.isRequired
}

export { TCRViewContext, TCRViewProvider }
