import { useState } from 'react'
import useStoredLayout, { type ListLayout } from 'hooks/use-stored-layout'

/** Phones open on stacked rows; wider screens on the table. */
export const defaultLayout = (): ListLayout =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(max-width: 720px)').matches
    ? 'rows'
    : 'table'

/**
 * A registry's entries layout: the visitor's remembered choice, else the
 * default for the viewport they arrived on (rows on a phone, the table
 * elsewhere), read once so a resize never switches it under them.
 */
export const useRegistryLayout = (key: string) => {
  const [fallback] = useState(defaultLayout)
  return useStoredLayout(key, fallback)
}
