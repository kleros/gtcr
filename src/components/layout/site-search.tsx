import React, { Suspense, lazy, useEffect, useState } from 'react'
import { CurateIcon } from 'components/curate/icons'
import useUrlChainId from 'hooks/use-url-chain-id'
import { BarIconButton } from './app-bar-controls'

/*
 * The app bar's search (the Scout review's lookup, options A and F as
 * Fortunato asked): a magnifier at the start of the bar's right group, and
 * ⌘K or Ctrl K anywhere, open a centred dialog that finds lists, entries on
 * every list and an address's profile. The dialog's code loads the first
 * time it opens.
 */

const SiteSearchDialog = lazy(() => import('./site-search-dialog'))

const isMac = () =>
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

const SiteSearch = () => {
  const [open, setOpen] = useState(false)
  // Mounted once opened, so closing keeps the last search for next time.
  const [loaded, setLoaded] = useState(false)
  const pageChainId = useUrlChainId()

  const show = () => {
    setLoaded(true)
    setOpen(true)
  }

  useEffect(() => {
    // ⌘K on a Mac (where Ctrl K deletes to the end of a line in any text
    // field), Ctrl K elsewhere. Autofill sends keydown events with no key.
    const mac = isMac()
    const onKey = (event: KeyboardEvent) => {
      if (
        typeof event.key === 'string' &&
        event.key.toLowerCase() === 'k' &&
        (mac
          ? event.metaKey && !event.ctrlKey
          : event.ctrlKey && !event.metaKey) &&
        !event.altKey &&
        !event.shiftKey
      ) {
        event.preventDefault()
        setLoaded(true)
        setOpen((was) => !was)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const shortcut = isMac() ? '⌘K' : 'Ctrl K'
  return (
    <>
      <BarIconButton
        type="button"
        aria-label="Search"
        aria-haspopup="dialog"
        aria-keyshortcuts={isMac() ? 'Meta+K' : 'Control+K'}
        title={`Search (${shortcut})`}
        onClick={show}
      >
        <CurateIcon name="search" size={19} />
      </BarIconButton>
      {loaded && (
        <Suspense fallback={null}>
          <SiteSearchDialog
            open={open}
            onClose={() => setOpen(false)}
            pageChainId={pageChainId}
          />
        </Suspense>
      )}
    </>
  )
}

export default SiteSearch
