import { useEffect, useState } from 'react'
import useStoredLayout, {
  LAYOUT_OPTIONS,
  type ListLayout,
} from 'hooks/use-stored-layout'
import type { SegmentOption } from './primitives'

/*
 * The registry pages' layout vocabulary. Rows were dropped at the design
 * review: the table and the cards carry the glass, the lit edges and the
 * reveals the rows had, so a third stacked layout only repeated them. Browse
 * and the address page narrow the same hook their own way, to cards and rows
 * (pages/browse/layout.ts, pages/address/view.ts), so the narrowing lives
 * here rather than in the shared hook, and the options are derived from it
 * so Table and Cards keep the same labels and glyphs everywhere.
 */

export type RegistryLayout = Exclude<ListLayout, 'rows'>

/** Phones open on cards; wider screens on the table. */
const defaultLayout = (): RegistryLayout =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(max-width: 720px)').matches
    ? 'cards'
    : 'table'

/** The layouts a registry page offers, in the shared hook's own order. */
const OFFERED: RegistryLayout[] = ['table', 'cards']

export const REGISTRY_LAYOUT_OPTIONS: SegmentOption<RegistryLayout>[] =
  OFFERED.flatMap((value) => {
    const option = LAYOUT_OPTIONS.find((candidate) => candidate.value === value)
    return option ? [{ ...option, value }] : []
  })

/**
 * A registry's entries layout: the visitor's remembered choice, else the
 * default for the viewport they arrived on (cards on a phone, the table
 * elsewhere), read once so a resize never switches it under them. A
 * remembered choice of the dropped Rows layout reads as that default and is
 * rewritten to it once: these keys are the registry pages' own ('entries',
 * 'registry-entries'), so nothing else reads them, and a visitor who last
 * chose Rows gets a remembered choice back instead of landing on the
 * viewport default on every visit for ever.
 */
export const useRegistryLayout = (key: string) => {
  const [fallback] = useState(defaultLayout)
  const [stored, setLayout] = useStoredLayout(key, fallback)
  useEffect(() => {
    if (stored === 'rows') setLayout(fallback)
  }, [stored, fallback, setLayout])
  return [stored === 'rows' ? fallback : stored, setLayout] as const
}
