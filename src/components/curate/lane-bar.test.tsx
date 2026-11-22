import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LANE_SPEED, LaneBar, type LaneRun, laneDuration } from './lane-bar'

const VOTES: LaneRun[] = [
  { key: 'yes', weight: 2, hue: 'var(--viz-1)' },
  { key: 'no', weight: 1, hue: 'var(--viz-2)' },
]

/**
 * What the bar paints: the innermost pieces, a run's lit units and the
 * head's light. The boxes around them only place and clip them.
 */
const parts = (bar: Element) =>
  [...bar.querySelectorAll('*')].filter((node) => node.children.length === 0)

describe('LaneBar', () => {
  it('is hidden from assistive technology: the caller says what it shows', () => {
    const { container } = render(<LaneBar armed runs={VOTES} head />)
    const bar = container.firstElementChild
    expect(bar).toHaveAttribute('aria-hidden', 'true')
    expect(bar).toHaveTextContent('')
  })

  it('paints nothing, neither a run nor the head, until it is armed', () => {
    const { container, rerender } = render(
      <LaneBar armed={false} runs={VOTES} head />,
    )
    const bar = container.firstElementChild as Element
    expect(parts(bar).length).toBeGreaterThan(0)
    for (const part of parts(bar)) expect(part).not.toBeVisible()

    rerender(<LaneBar armed runs={VOTES} />)
    expect(parts(bar).length).toBeGreaterThan(0)
    for (const part of parts(bar)) expect(part).toBeVisible()
  })
})

describe('laneDuration', () => {
  it('takes the full sweep for the full width and a share of it for part', () => {
    expect(laneDuration()).toBe(LANE_SPEED)
    expect(laneDuration(1)).toBe(LANE_SPEED)
    expect(laneDuration(0.5)).toBe(LANE_SPEED / 2)
    expect(laneDuration(0.5, 2000)).toBe(1000)
    expect(laneDuration(1 / 3, 1000)).toBe(333)
  })

  it('keeps the share between none and the full width', () => {
    expect(laneDuration(2)).toBe(LANE_SPEED)
    // Never below 1ms, so a caller waiting on it always gets a timer.
    expect(laneDuration(0)).toBe(1)
    expect(laneDuration(-1)).toBe(1)
    expect(laneDuration(1, -500)).toBe(1)
  })

  it('falls back to the defaults for a value that is not a number', () => {
    expect(laneDuration(Number.NaN)).toBe(LANE_SPEED)
    expect(laneDuration(1, Number.NaN)).toBe(LANE_SPEED)
    expect(laneDuration(Number.POSITIVE_INFINITY)).toBe(LANE_SPEED)
  })
})
