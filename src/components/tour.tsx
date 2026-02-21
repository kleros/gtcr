import React, { useState, useEffect, useCallback, useContext } from 'react'
import Tour from 'reactour'
import localforage from 'localforage'
// Simple body scroll lock helpers (replacing body-scroll-lock package)
const disableBodyScroll = () => { document.body.style.overflow = 'hidden' }
const enableBodyScroll = () => { document.body.style.overflow = '' }
import { TourContext } from '../contexts/tour-context'
import { ThemeContext } from '../contexts/theme-context'

interface AppTourProps {
  steps: any[]
  dismissedKey: string
}

const AppTour = ({ steps, dismissedKey }: AppTourProps) => {
  const [dismissed, setDismissed] = useState(true)
  const { welcomeModalDismissed } = useContext(TourContext)
  const { theme } = useContext(ThemeContext)

  const disableBody = () => disableBodyScroll()
  const enableBody = () => enableBodyScroll()

  useEffect(() => {
    ;(async () => {
      const wasDismissed = (await localforage.getItem(dismissedKey)) || false
      setDismissed(wasDismissed)
    })()
  }, [dismissedKey])

  const dontShowAgain = useCallback(() => {
    setDismissed(true)
    localforage.setItem(dismissedKey, true)
  }, [dismissedKey])

  return (
    <Tour
      steps={steps}
      isOpen={welcomeModalDismissed && !dismissed}
      onRequestClose={dontShowAgain}
      accentColor={theme?.tourAccentColor || '#4004a3'}
      onAfterOpen={disableBody}
      onBeforeClose={enableBody}
      inViewThreshold={200}
    />
  )
}

export default AppTour
