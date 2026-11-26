import React from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from 'test/render'
import DisplaySelector from './display-selector'

describe('DisplaySelector', () => {
  it('shows a value of a type it does not know as written', () => {
    renderWithProviders(<DisplaySelector type="date" value="2026-11-26" />)
    const value = screen.getByText('2026-11-26')
    expect(value).toHaveAttribute(
      'title',
      'Shown as written: Curate has no "date" field',
    )
    expect(screen.queryByText(/Unsupported/)).toBeNull()
  })

  it('says when such a value is missing', () => {
    renderWithProviders(<DisplaySelector type="date" value="" />)
    expect(screen.getByText('No value')).toBeInTheDocument()
  })

  it('shows a known type as before', () => {
    renderWithProviders(<DisplaySelector type="text" value="Kleros" />)
    expect(screen.getByText('Kleros')).not.toHaveAttribute('title')
  })
})
