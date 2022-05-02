import React, { createContext, useState, useEffect, useCallback } from 'react'
import localforage from 'localforage'
import PropTypes from 'prop-types'

const WELCOME_MODAL_DISMISSED = 'WELCOME_MODAL_DISMISSED'
const NOTIFICATION_TOUR_DISMISSED = 'NOTIFICATION_TOUR_DISMISSED'

const useTourContext = () => {
  const [welcomeModalDismissed, setWelcomeModalDismissed] = useState(true)
  const [notificationTourDismissed, setNotificationTourDismissed] = useState(
    false
  )
  const [userSubscribed, setUserSubscribed] = useState(false)

  useEffect(() => {
    ;(async () => {
      setWelcomeModalDismissed(
        (await localforage.getItem(WELCOME_MODAL_DISMISSED)) || false
      )
      setNotificationTourDismissed(
        (await localforage.getItem(NOTIFICATION_TOUR_DISMISSED)) || false
      )
    })()
  }, [])

  const dismissWelcomeModal = useCallback(() => {
    setWelcomeModalDismissed(true)
    localforage.setItem(WELCOME_MODAL_DISMISSED, true)
  }, [])

  const dismissNotificationsTour = useCallback(() => {
    setNotificationTourDismissed(true)
    localforage.setItem(NOTIFICATION_TOUR_DISMISSED, true)
  }, [])

  return {
    welcomeModalDismissed,
    dismissWelcomeModal,
    notificationTourDismissed,
    setUserSubscribed,
    dismissNotificationsTour,
    userSubscribed
  }
}

const TourContext = createContext()
const TourProvider = ({ children }) => (
  <TourContext.Provider value={{ ...useTourContext() }}>
    {children}
  </TourContext.Provider>
)

TourProvider.propTypes = {
  children: PropTypes.node.isRequired
}

export { TourContext, TourProvider }
