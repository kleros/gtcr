import React from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from 'test/render'
import { HeroMoney } from './bounties'

type Props = React.ComponentProps<typeof HeroMoney>

/** A ledger with no ruling yet: Bounties won says so, in words. */
const RECORD = {
  capped: false,
  missing: [],
  loaded: [100],
  rulings: 0,
  listedRulings: 0,
  listedWon: 0,
  challenged: 0,
  challengedPartial: false,
  coins: [],
} as unknown as NonNullable<Props['record']>

const hero = (props: Partial<Props>) =>
  renderWithProviders(
    <HeroMoney
      record={RECORD}
      pricesSettled
      transit={2_690_000}
      transitFailed={false}
      grabs={{ expected: false, refreshing: false }}
      grabsHref="#open-for-verification"
      {...props}
    />,
  )

describe('HeroMoney: up for grabs now', () => {
  it('is a third figure, a link down to the requests it stands for', () => {
    const { container } = hero({
      grabs: { usd: 5_610, expected: false, refreshing: false },
    })
    expect(container.querySelectorAll('[data-money]')).toHaveLength(3)
    expect(screen.getByText('Up for grabs now')).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: '$5.61K up for grabs now: see the requests open to challenge',
      }),
    ).toHaveAttribute('href', '#open-for-verification')
  })

  it('holds its place while the hero loads, when it is likely to open', () => {
    const { container } = hero({
      record: undefined,
      pricesSettled: false,
      grabs: { expected: true, refreshing: false },
    })
    expect(container.querySelectorAll('[data-money]')).toHaveLength(3)
    expect(container.querySelector('[data-three]')).not.toBeNull()
    expect(screen.queryByText('Up for grabs now')).not.toBeInTheDocument()
  })

  it("holds its place while an earlier visit's load waits for its refresh", () => {
    const { container } = hero({ grabs: { expected: true, refreshing: true } })
    expect(container.querySelectorAll('[data-money]')).toHaveLength(3)
    expect(screen.queryByText('Up for grabs now')).not.toBeInTheDocument()
  })

  it('draws nothing when the gate is closed', () => {
    const { container } = hero({
      grabs: { expected: false, refreshing: false },
    })
    expect(container.querySelectorAll('[data-money]')).toHaveLength(2)
    expect(container.querySelector('[data-three]')).toBeNull()
    expect(screen.queryByText('Up for grabs now')).not.toBeInTheDocument()
  })
})
