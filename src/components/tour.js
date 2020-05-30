import React, { useState, useEffect, useCallback } from 'react'
import Tour from 'reactour'
import localforage from 'localforage'
import PropTypes from 'prop-types'
import { disableBodyScroll, enableBodyScroll } from 'body-scroll-lock'
import { WELCOME_MODAL_DISMISSED } from '../utils/shared-keys'

const AppTour = ({ steps, dismissedKey }) => {
  const [dismissed, setDismissed] = useState(true)
  const [welcomeModal, setWelcomeModalDismissed] = useState(false)
  const disableBody = target => disableBodyScroll(target)
  const enableBody = target => enableBodyScroll(target)

  useEffect(() => {
    ;(async () => {
      const wasDismissed =
        (await localforage.getItem(WELCOME_MODAL_DISMISSED)) || false
      setWelcomeModalDismissed(wasDismissed)
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      const wasDismissed = (await localforage.getItem(dismissedKey)) || false
      setDismissed(wasDismissed)
    })()
  }, [dismissedKey])

  const dontShowAgain = useCallback(() => {
    setDismissed(true)
    // localforage.setItem(dismissedKey, true)
  }, [])

  return (
    <Tour
      steps={steps}
      isOpen={welcomeModal && !dismissed}
      onRequestClose={dontShowAgain}
      accentColor="#4004a3"
      onAfterOpen={disableBody}
      onBeforeClose={enableBody}
      inViewThreshold={200}
      scrollDuration={300}
    />
  )
}

AppTour.propTypes = {
  dismissedKey: PropTypes.string.isRequired,
  steps: PropTypes.arrayOf(
    PropTypes.shape({
      selector: PropTypes.string,
      content: PropTypes.oneOfType([
        PropTypes.node,
        PropTypes.element,
        PropTypes.func
      ]).isRequired,
      position: PropTypes.oneOfType([
        PropTypes.arrayOf(PropTypes.number),
        PropTypes.oneOf(['top', 'right', 'bottom', 'left', 'center'])
      ]),
      action: PropTypes.func,
      style: PropTypes.object,
      stepInteraction: PropTypes.bool,
      navDotAriaLabel: PropTypes.string
    })
  ).isRequired
}

export default AppTour
