import type React from 'react'

/*
 * Keeps Tab inside a modal panel (the pattern of the Stake item dialogs):
 * put `onKeyDown={trapTab}` on the element with role="dialog". Tab wraps
 * from the last control to the first; Shift+Tab from the first control,
 * from the panel itself or from anything outside it goes to the last.
 * Hidden controls (no layout boxes) are skipped.
 */

export const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export const trapTab = (event: React.KeyboardEvent<HTMLElement>) => {
  const dialog = event.currentTarget
  if (event.key !== 'Tab') return
  const nodes = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (node) => node.getClientRects().length > 0,
  )
  if (nodes.length === 0) {
    event.preventDefault()
    return
  }
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  const active = document.activeElement
  if (event.shiftKey) {
    if (active === first || active === dialog || !dialog.contains(active)) {
      event.preventDefault()
      last.focus()
    }
  } else if (active === last || !dialog.contains(active)) {
    event.preventDefault()
    first.focus()
  }
}

export default trapTab
