import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Hook to open an attachment (evidence file or policy document) in the
 * in-app viewer via URL params. The return button restores the previous
 * page by clearing these params.
 *
 * @returns A function that sets `?attachment=<url>` and, for policies,
 *   `?isPolicy=true` so the header shows the "Previous Policies" button.
 */
export const useAttachment = () => {
  const [, setSearchParams] = useSearchParams()

  return useCallback(
    (url: string, isPolicy?: boolean) => {
      setSearchParams(
        (prev) => {
          const newParams = new URLSearchParams(prev)
          newParams.set('attachment', url)
          newParams.delete('policyTx')
          if (isPolicy) newParams.set('isPolicy', 'true')
          else newParams.delete('isPolicy')
          return newParams
        },
        { replace: true },
      )
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [setSearchParams],
  )
}
