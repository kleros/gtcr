import { useCallback, useState } from 'react'

export type ListLayout = 'table' | 'cards' | 'rows'

const PREFIX = 'curatevision-layout:'

const isLayout = (value: unknown): value is ListLayout =>
  value === 'table' || value === 'cards' || value === 'rows'

/**
 * User-selectable list layout, remembered per list key in localStorage. The
 * hook knows all three (table, cards, rows); each page offers its own pair
 * and narrows a stored value it dropped: the registry pages table and cards
 * (components/curate/registry-shared-layout.ts), Browse and the address page
 * cards and rows (pages/browse/layout.ts, pages/address/view.ts).
 */
const useStoredLayout = (key: string, fallback: ListLayout = 'table') => {
  const [layout, setLayoutState] = useState<ListLayout>(() => {
    try {
      const saved = localStorage.getItem(PREFIX + key)
      if (isLayout(saved)) return saved
    } catch {
      // Storage can be blocked; use the fallback.
    }
    return fallback
  })
  const setLayout = useCallback(
    (next: ListLayout) => {
      setLayoutState(next)
      try {
        localStorage.setItem(PREFIX + key, next)
      } catch {
        // Storage can be blocked; the choice then lasts for the session.
      }
    },
    [key],
  )
  return [layout, setLayout] as const
}

export const LAYOUT_OPTIONS: {
  value: ListLayout
  label: string
  icon: 'list' | 'grid' | 'menu'
}[] = [
  { value: 'table', label: 'Table', icon: 'list' },
  { value: 'cards', label: 'Cards', icon: 'grid' },
  { value: 'rows', label: 'Rows', icon: 'menu' },
]

export default useStoredLayout
