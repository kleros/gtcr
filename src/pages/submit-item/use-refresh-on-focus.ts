import { useEffect } from 'react'

/**
 * While `active`, runs `refresh` each time the window regains focus. A
 * balance is read when the page loads; while it is what blocks the
 * submission, the user may be topping up in another tab or in the wallet.
 */
export const useRefreshOnFocus = (active: boolean, refresh: () => unknown) => {
  useEffect(() => {
    if (!active) return undefined
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [active, refresh])
}
