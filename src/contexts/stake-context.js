import React, { createContext, useState } from 'react'
import PropTypes from 'prop-types'

const StakeContext = createContext()

const StakeProvider = ({ children }) => {
  const [isPermanent, setIsPermanent] = useState(false)

  return (
    <StakeContext.Provider value={{ isPermanent, setIsPermanent }}>
      {children}
    </StakeContext.Provider>
  )
}

StakeProvider.propTypes = {
  children: PropTypes.node.isRequired
}

export { StakeContext, StakeProvider }
