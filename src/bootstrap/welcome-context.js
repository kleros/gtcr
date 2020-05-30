import React, { createContext, useState, useEffect, useCallback } from 'react'
import localforage from 'localforage'
import PropTypes from 'prop-types'

const WELCOME_MODAL_DISMISSED = 'WELCOME_MODAL_DISMISSED'

const useWelcomeContext = () => {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    ;(async () => {
      const wasDismissed =
        (await localforage.getItem(WELCOME_MODAL_DISMISSED)) || false
      setDismissed(wasDismissed)
    })()
  }, [])

  const dontShowAgain = useCallback(() => {
    setDismissed(true)
    localforage.setItem(WELCOME_MODAL_DISMISSED, true)
  }, [setDismissed])

  return {
    dismissed,
    dontShowAgain
  }
}

const WelcomeContext = createContext()
const WelcomeProvider = ({ children }) => (
  <WelcomeContext.Provider value={{ ...useWelcomeContext() }}>
    {children}
  </WelcomeContext.Provider>
)

WelcomeProvider.propTypes = {
  children: PropTypes.node.isRequired
}

export { WelcomeContext, WelcomeProvider }
