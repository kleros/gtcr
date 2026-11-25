import { useCallback, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { buildInitialValues } from './form'

/*
 * An entry that left its list (rejected, removed, withdrawn) is resubmitted
 * on the submit page, like any new entry: same fields, checks and deposit
 * panel. Its values ride in the query string in column order, as an
 * ?action= link carries them, so the form opens filled in. Once the
 * resubmission is confirmed the page opens the entry: a changed value makes
 * it a new entry, unchanged data the same one.
 */

/** The submit page for a resubmission, its fields filled with `values`. */
export const resubmitPath = (
  chainId: string | number,
  tcrAddress: string,
  columns: Column[] | undefined,
  values: unknown[] | undefined,
): string => {
  // With the columns, each value gets the submit page's defaults (a value
  // the entry lacks starts as its column's default, never as "undefined").
  const filled =
    columns && columns.length > 0
      ? (() => {
          const byLabel = buildInitialValues(columns, values)
          return columns.map((column) => {
            const value = byLabel[column.label]
            return typeof value === 'string' ? value : ''
          })
        })()
      : (values ?? []).map((value) =>
          value === undefined || value === null ? '' : String(value),
        )
  // The keys are free (values map to columns by position); these are
  // never one of the keys a link drops (the theme, filters, tracking tags).
  const query = new URLSearchParams(
    filled.map((value, index) => [`v${index}`, value]),
  ).toString()
  return `/tcr/${chainId}/${tcrAddress}/submit${query ? `?${query}` : ''}`
}

/**
 * Opens the submit page for the entry page's own entry: pushed from its
 * button, so Back returns to the entry; replacing the page for an ?action=
 * link, so Back does not land on the link and open it again.
 */
export const useResubmit = () => {
  const navigate = useNavigate()
  // The entry page's route: /tcr/:chainId/:tcrAddress/:itemID.
  const { chainId, tcrAddress } = useParams<{
    chainId: string
    tcrAddress: string
  }>()
  return useCallback(
    (
      columns: Column[] | undefined,
      values: unknown[] | undefined,
      options?: { replace?: boolean },
    ) => {
      if (!chainId || !tcrAddress) return
      navigate(resubmitPath(chainId, tcrAddress, columns, values), {
        replace: !!options?.replace,
      })
    },
    [chainId, navigate, tcrAddress],
  )
}

/**
 * Where an entry page's ?action= link lands when the entry's one action is
 * a resubmission: the page opens its action as a dialog, and this one is
 * the submit page, so the link is sent there instead.
 */
export const ResubmitRedirect = ({
  open,
  ready = true,
  columns,
  values,
  onClose,
}: {
  open: boolean
  /** False while the entry's own values are still being read: it waits. */
  ready?: boolean
  columns?: Column[]
  values?: unknown[]
  onClose: () => void
}) => {
  const resubmit = useResubmit()
  const sent = useRef(false)
  useEffect(() => {
    if (!open) {
      sent.current = false
      return
    }
    if (sent.current || !ready) return
    sent.current = true
    onClose()
    resubmit(columns, values, { replace: true })
  }, [open, ready, columns, values, onClose, resubmit])
  return null
}
