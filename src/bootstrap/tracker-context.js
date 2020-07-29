import React, { createContext, useState, useEffect, useCallback } from 'react'
import localforage from 'localforage'
import PropTypes from 'prop-types'
import { hotjar } from 'react-hotjar'
import { initialize, pageview } from 'react-ga'

const TRACKERS_ENABLED = 'TRACKERS_ENABLED'
const TRACKERS_MODAL_DISMISSED = 'TRACKERS_MODAL_DISMISSED'

const useTrackerContext = () => {
  const [trackersConsentDismissed, setTrackersConsentDismissed] = useState(
    false
  )
  const [trackersAllowed, setTrackersAllowed] = useState(false)

  useEffect(() => {
    ;(async () => {
      setTrackersAllowed((await localforage.getItem(TRACKERS_ENABLED)) || false)
      setTrackersConsentDismissed(
        (await localforage.getItem(TRACKERS_MODAL_DISMISSED)) || false
      )
    })()
  }, [])

  const allowTrackers = useCallback(() => {
    setTrackersConsentDismissed(true)
    setTrackersAllowed(true)
    localforage.setItem(TRACKERS_ENABLED, true)
    localforage.setItem(TRACKERS_MODAL_DISMISSED, true)

    // Init hojar.
    hotjar.initialize(process.env.REACT_APP_HJID, process.env.REACT_APP_HJSV)

    // Init google anaylitics.
    initialize(process.env.REACT_APP_GA_UID)
    pageview(window.location.pathname + window.location.search)
  }, [])

  const denyTrackers = useCallback(() => {
    setTrackersConsentDismissed(true)
    setTrackersAllowed(false)
    localforage.setItem(TRACKERS_ENABLED, false)
    localforage.setItem(TRACKERS_MODAL_DISMISSED, true)
  }, [])

  return {
    trackersAllowed,
    trackersConsentDismissed,
    denyTrackers,
    allowTrackers
  }
}

const TrackerContext = createContext()
const TrackerProvider = ({ children }) => (
  <TrackerContext.Provider value={{ ...useTrackerContext() }}>
    {children}
  </TrackerContext.Provider>
)

TrackerProvider.propTypes = {
  children: PropTypes.node.isRequired
}

export { TrackerContext, TrackerProvider }
