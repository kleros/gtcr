import React from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from 'test/render'
import { LoadStatePill, loadState, type LoadState } from './live-pill'

const base = {
  loaded: true,
  failed: false,
  unanswered: false,
  partial: false,
  live: true,
}

describe('loadState', () => {
  it('calls nothing live before the first load', () => {
    expect(loadState({ ...base, loaded: false, live: false })).toBe(
      'connecting',
    )
  })

  it('says the indexers are down when the first read failed', () => {
    expect(
      loadState({ ...base, loaded: false, failed: true, live: false }),
    ).toBe('down')
    expect(loadState({ ...base, unanswered: true })).toBe('down')
  })

  it('is live only for a recent load whose last read worked', () => {
    expect(loadState(base)).toBe('live')
    expect(loadState({ ...base, live: false })).toBe('aged')
    // A refresh failed: the figures shown are the older load's.
    expect(loadState({ ...base, failed: true })).toBe('aged')
  })

  it('says partial when some chain did not answer', () => {
    expect(loadState({ ...base, partial: true })).toBe('partial')
  })
})

const pill = () => screen.getByRole('status').parentElement as HTMLElement

describe('LoadStatePill', () => {
  it('reads "Connecting", never "Live", while the first load runs', () => {
    renderWithProviders(<LoadStatePill state="connecting" />)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Connecting to the indexers',
    )
    expect(pill()).not.toHaveTextContent(/live/i)
    // The dot pulses only for a live load (the pill's data-state).
    expect(pill()).toHaveAttribute('data-state', 'connecting')
  })

  it('says the indexers are not answering when nothing loaded', () => {
    renderWithProviders(<LoadStatePill state="down" />)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Indexers not answering',
    )
    expect(pill()).not.toHaveTextContent(/live/i)
  })

  it.each<[LoadState, boolean, string]>([
    ['live', false, 'Live'],
    ['aged', false, 'Not live'],
    ['aged', true, 'Refreshing'],
  ])(
    'a %s load (refreshing: %s) reads "%s" with its age after the state',
    (state, refreshing, word) => {
      renderWithProviders(
        <LoadStatePill
          state={state}
          refreshing={refreshing}
          updated="Updated 2 min ago"
        />,
      )
      expect(screen.getByRole('status')).toHaveTextContent(word)
      // The age is outside the live region, so it is not read out each minute.
      expect(screen.getByRole('status')).not.toHaveTextContent('Updated')
      expect(pill()).toHaveTextContent('Updated 2 min ago')
      expect(pill()).toHaveAttribute('data-state', state)
    },
  )

  it('names the chains a partial load is missing', () => {
    renderWithProviders(<LoadStatePill state="partial" partialNames="Gnosis" />)
    expect(screen.getByRole('status')).toHaveTextContent(
      'PartialSome Gnosis data did not load; figures may be incomplete',
    )
  })
})
