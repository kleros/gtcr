import { LAYOUT_OPTIONS, type ListLayout } from 'hooks/use-stored-layout'

/*
 * Browse's layout vocabulary. The table was dropped at the design review:
 * the rows carry every figure it held (entries, open requests or listed, in
 * court, the chain), and a row of names reads faster than a grid of cells.
 * The registry and address pages still offer it, so the narrowing lives
 * here instead of in the shared hook, and the options are derived from it so
 * Cards and Rows keep the same labels and glyphs as those pages.
 */

export type BrowseLayout = Exclude<ListLayout, 'table'>

/** Every way into the layout passes through here, so none can pick the table. */
export const browseLayout = (layout: ListLayout): BrowseLayout =>
  layout === 'table' ? 'rows' : layout

export const BROWSE_LAYOUT_OPTIONS = LAYOUT_OPTIONS.flatMap((option) =>
  option.value === 'table'
    ? []
    : [{ ...option, value: browseLayout(option.value) }],
)

/**
 * Old ?view= links: `list` and the dropped `table` open rows, `cards` opens
 * cards, and anything else leaves the remembered choice alone.
 */
export const layoutFromView = (view: string): BrowseLayout | null => {
  if (view === 'cards') return 'cards'
  if (view === 'list' || view === 'rows' || view === 'table') return 'rows'
  return null
}
