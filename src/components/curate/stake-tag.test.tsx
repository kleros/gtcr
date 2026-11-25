import React from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from 'test/render'
import { KindTag, StakeTag } from './stake-tag'

describe('StakeTag', () => {
  it('sets its word at the label size, in rows as in a list header', () => {
    renderWithProviders(
      <>
        <StakeTag />
        <StakeTag size="md" />
      </>,
    )
    const words = screen.getAllByText('Stake')
    expect(words).toHaveLength(2)
    // DESIGN.md, Typography: labels are 11px; the row tag was 9.5px.
    for (const word of words)
      expect(getComputedStyle(word).fontSize).toBe('var(--fs-label)')
  })

  it('marks Stake lists only', () => {
    renderWithProviders(
      <>
        <KindTag kind="standard" />
        <KindTag kind="permanent" />
      </>,
    )
    expect(screen.getAllByText('Stake')).toHaveLength(1)
  })
})
