import React from 'react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from 'test/render'
import { RegistryToolbar } from './registry-toolbar'

const Toolbar = () => (
  <RegistryToolbar
    search=""
    onSearch={() => {}}
    placeholder="Search entries"
    chips={[{ key: 'registered', label: 'Registered', checked: false }]}
    onStatusChange={() => {}}
    sort="newest"
    onSortChange={() => {}}
    layout="table"
    onLayoutChange={() => {}}
    layoutOptions={[
      { value: 'table', label: 'Table' },
      { value: 'cards', label: 'Cards' },
    ]}
    nsfwFilter={false}
    onNsfwChange={() => {}}
  />
)

/** The window as wide or as narrow as the toolbar's three-line layout. */
const narrowWindow = (narrow: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: narrow && query.includes('max-width: 720px'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))

/** Each Tab stop, by its accessible name, from the start of the page. */
const tabOrder = async (stops: number) => {
  const user = userEvent.setup()
  const names: string[] = []
  for (let i = 0; i < stops; i++) {
    await user.tab()
    const el = document.activeElement as HTMLElement
    const labelledBy = el.getAttribute('aria-labelledby')
    names.push(
      el.getAttribute('aria-label') ??
        (labelledBy &&
          document.querySelector(`[id="${labelledBy}"]`)?.textContent) ??
        el.textContent ??
        '',
    )
  }
  return names.map((name) => name.trim())
}

describe('RegistryToolbar', () => {
  it('tabs in the drawn order on a wide screen: the switch before the sort', async () => {
    narrowWindow(false)
    renderWithProviders(<Toolbar />)
    expect(await tabOrder(5)).toEqual([
      'Search entries',
      expect.stringMatching(/^Status/),
      'Hide sensitive content',
      'Newest',
      'Table',
    ])
  })

  it('tabs line by line on a phone: the status menu and the sort, then the switch', async () => {
    // Narrow, the areas draw search / status, sort / switch, layout.
    narrowWindow(true)
    renderWithProviders(<Toolbar />)
    expect(await tabOrder(5)).toEqual([
      'Search entries',
      expect.stringMatching(/^Status/),
      'Newest',
      'Hide sensitive content',
      'Table',
    ])
  })
})
