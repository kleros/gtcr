import { describe, expect, it } from 'vitest'
import { LAYOUT_OPTIONS } from 'hooks/use-stored-layout'
import { BROWSE_LAYOUT_OPTIONS, browseLayout, layoutFromView } from './layout'

describe('browseLayout', () => {
  it.each([
    ['table', 'rows'],
    ['rows', 'rows'],
    ['cards', 'cards'],
  ] as const)('opens a stored %s as %s', (stored, layout) => {
    expect(browseLayout(stored)).toBe(layout)
  })
})

describe('BROWSE_LAYOUT_OPTIONS', () => {
  it('offers cards and rows, never the table', () => {
    expect(BROWSE_LAYOUT_OPTIONS.map((option) => option.value)).toEqual([
      'cards',
      'rows',
    ])
  })

  it('keeps the labels and glyphs the registry pages use', () => {
    for (const option of BROWSE_LAYOUT_OPTIONS)
      expect(option).toEqual(
        LAYOUT_OPTIONS.find((shared) => shared.value === option.value),
      )
  })
})

describe('layoutFromView', () => {
  it.each([
    ['cards', 'cards'],
    ['list', 'rows'],
    ['rows', 'rows'],
    ['table', 'rows'],
  ])('opens an old ?view=%s link as %s', (view, layout) => {
    expect(layoutFromView(view)).toBe(layout)
  })

  it.each(['', 'grid', 'Cards'])(
    'leaves the remembered choice alone for ?view=%j',
    (view) => {
      expect(layoutFromView(view)).toBeNull()
    },
  )
})
