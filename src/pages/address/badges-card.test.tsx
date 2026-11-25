import React from 'react'
import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from 'test/render'
import { BadgesCard } from './activity'
import { buildBadges, emptyStats, type AddressStats } from './data'

// The wagmi config reads window.location when it loads; the card signs
// nothing.
vi.mock('config/wagmi', () => ({ wagmiConfig: {} }))

const renderCard = (stats: Partial<AddressStats>) =>
  renderWithProviders(
    <BadgesCard
      badges={buildBadges({ ...emptyStats(), ...stats })}
      scope="All chains"
    />,
  )

/** A badge's row: the hairline-parted block that holds its name. */
const row = (name: string) => {
  const title = screen.getByText(name, { selector: 'strong' })
  const block = title.closest('[data-name]')?.parentElement
  if (!(block instanceof HTMLElement)) throw new Error(`no row for ${name}`)
  return within(block)
}

describe('the Badges card past level 5', () => {
  it('keeps climbing where five levels stopped: 6,009 submissions are level 8', () => {
    renderCard({ submissions: 6_009, challenges: 150, removals: 364 })

    const librarian = row('Librarian')
    expect(librarian.getByText('Level 8')).toBeInTheDocument()
    expect(
      librarian.getByText('Level 9 at 10,000 submissions'),
    ).toBeInTheDocument()
    expect(
      librarian.getByLabelText('6,009 of 10,000 submissions'),
    ).toBeInTheDocument()
    expect(
      librarian.getByRole('img', {
        name: 'Librarian: 6,009 of 10,000 to level 9',
      }),
    ).toBeInTheDocument()

    expect(row('Sheriff').getByText('Level 6')).toBeInTheDocument()
    expect(
      row('Sheriff').getByText('Level 7 at 250 challenges'),
    ).toBeInTheDocument()
    expect(row('Maintainer').getByText('Level 6')).toBeInTheDocument()
    expect(
      row('Maintainer').getByText('Level 7 at 500 removals'),
    ).toBeInTheDocument()
  })

  it('says "Top level" at level 10, with the count alone and 10 on the medal', () => {
    const { container } = renderCard({ submissions: 25_000 })

    const librarian = row('Librarian')
    expect(librarian.getByText('Level 10')).toBeInTheDocument()
    expect(
      librarian.getByText('Top level · 25,000+ submissions'),
    ).toBeInTheDocument()
    expect(librarian.getByLabelText('25,000 submissions')).toBeInTheDocument()
    expect(
      librarian.getByRole('img', { name: 'Librarian: top level' }),
    ).toBeInTheDocument()
    // The medal's pip, hidden from assistive tech (the tag names the level).
    const pip = [...container.querySelectorAll('[aria-hidden="true"] span')]
      .map((node) => node.textContent)
      .filter((text) => text === '10')
    expect(pip).toHaveLength(1)
  })
})
