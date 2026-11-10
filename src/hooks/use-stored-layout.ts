import { useCallback, useState } from 'react'

export type ListLayout = 'table' | 'cards' | 'rows'

const PREFIX = 'curatevision-layout:'

const isLayout = (value: unknown): value is ListLayout =>
  value === 'table' || value === 'cards' || value === 'rows'

/**
 * User-selectable list layout (DESIGN.md: table, cards or rows), remembered per
 * list key in localStorage.
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
