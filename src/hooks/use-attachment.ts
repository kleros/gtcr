import { useCallback, useLayoutEffect, useRef } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { getAllowedAttachmentUrl } from 'utils/url-validation'

/** Marks a history entry whose viewer was opened from the page under it. */
const OPENED_HERE = 'attachmentOpenedHere'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

/**
 * Whether the viewer in this history entry was opened from the page under
 * it, so that stepping back closes it. A viewer reached by a link has no
 * page of its own to step back to.
 */
export const isOpenedHere = (state: unknown): boolean =>
  isRecord(state) && state[OPENED_HERE] === true

/**
 * Hook to open an attachment (evidence file or policy document) in the
 * in-app viewer via URL params. It opens in a history entry of its own, so
 * the browser's Back closes it, as its Return button does.
 *
 * @returns A function that sets `?attachment=<url>` and, for policies,
 *   `?isPolicy=true` so the header shows the "Previous Policies" button.
 */
export const useAttachment = () => {
  const [, setSearchParams] = useSearchParams()
  const { state } = useLocation()

  return useCallback(
    (url: string, isPolicy?: boolean) => {
      // A file the viewer cannot show (not on the IPFS gateway) is not
      // opened: the page would stay as it is, behind an entry Back undoes.
      if (!getAllowedAttachmentUrl(url)) return
      setSearchParams(
        (prev) => {
          const newParams = new URLSearchParams(prev)
          newParams.set('attachment', url)
          newParams.delete('policyTx')
          if (isPolicy) newParams.set('isPolicy', 'true')
          else newParams.delete('isPolicy')
          return newParams
        },
        // The page under the viewer keeps reading its own state (an entry
        // submitted a moment ago, say).
        { state: { ...(isRecord(state) ? state : {}), [OPENED_HERE]: true } },
      )
    },
    [setSearchParams, state],
  )
}

/**
 * For a page that shows the viewer in its place, kept mounted and hidden
 * under it: the viewer opens at the top, and closing it (Return or Back)
 * puts the reader back where they were on the page. The page's place is
 * followed while it shows; once it is hidden the shorter document clamps
 * the scroll, so it is not read again until the viewer closes.
 */
export const useAttachmentPlace = (open: boolean) => {
  const place = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (open) {
      window.scrollTo(0, 0)
      return undefined
    }
    if (place.current !== null) window.scrollTo(0, place.current)
    const keep = () => {
      place.current = window.scrollY
    }
    keep()
    window.addEventListener('scroll', keep, { passive: true })
    return () => window.removeEventListener('scroll', keep)
  }, [open])
}
