import React from 'react'
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from 'test/render'
import Tooltip from './Tooltip'

/*
 * The tip waits (0.1s by default) before it opens and before it closes.
 * user-event needs the clock to keep moving (shouldAdvanceTime) or Testing
 * Library's own wait between steps never ends; the delays themselves are
 * stepped by hand.
 */
const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

const setup = () =>
  userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) })

const trigger = () => screen.getByRole('button', { name: 'Juror fee' })

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens on hover after its delay and describes the trigger while it shows', async () => {
    const user = setup()
    renderWithProviders(
      <Tooltip title="Paid to each juror drawn for the case">
        <button type="button">Juror fee</button>
      </Tooltip>,
    )
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    expect(trigger()).not.toHaveAttribute('aria-describedby')

    await user.hover(trigger())
    wait(100)
    const tip = screen.getByRole('tooltip')
    expect(tip).toHaveTextContent('Paid to each juror drawn for the case')
    expect(trigger()).toHaveAttribute('aria-describedby', tip.id)
    expect(trigger()).toHaveAccessibleDescription(
      'Paid to each juror drawn for the case',
    )

    await user.unhover(trigger())
    wait(100)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    expect(trigger()).not.toHaveAttribute('aria-describedby')
  })

  it('does not open for a pointer that only passes over', async () => {
    const user = setup()
    renderWithProviders(
      <Tooltip title="Paid to each juror" mouseEnterDelay={1}>
        <button type="button">Juror fee</button>
      </Tooltip>,
    )
    await user.hover(trigger())
    await user.unhover(trigger())
    wait(2000)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('opens on keyboard focus and closes when the focus leaves', async () => {
    const user = setup()
    renderWithProviders(
      <>
        <Tooltip title="Paid to each juror">
          <button type="button">Juror fee</button>
        </Tooltip>
        <button type="button">Next</button>
      </>,
    )
    await user.tab()
    expect(trigger()).toHaveFocus()
    wait(100)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Paid to each juror')
    expect(trigger()).toHaveAccessibleDescription('Paid to each juror')

    await user.tab()
    wait(100)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('closes on Escape and leaves the focus where it was', async () => {
    const user = setup()
    renderWithProviders(
      <Tooltip title="Paid to each juror">
        <button type="button">Juror fee</button>
      </Tooltip>,
    )
    await user.tab()
    wait(100)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    expect(trigger()).toHaveFocus()
    expect(trigger()).not.toHaveAttribute('aria-describedby')
  })

  it("adds itself to the trigger's own description", async () => {
    const user = setup()
    renderWithProviders(
      <>
        <p id="fee-hint">Paid in xDAI.</p>
        <Tooltip title="Paid to each juror">
          <button type="button" aria-describedby="fee-hint">
            Juror fee
          </button>
        </Tooltip>
      </>,
    )
    expect(trigger()).toHaveAccessibleDescription('Paid in xDAI.')
    await user.hover(trigger())
    wait(100)
    expect(trigger()).toHaveAccessibleDescription(
      'Paid in xDAI. Paid to each juror',
    )
    await user.unhover(trigger())
    wait(100)
    expect(trigger()).toHaveAccessibleDescription('Paid in xDAI.')
  })

  it('renders only its child when there is no title', async () => {
    const user = setup()
    renderWithProviders(
      <Tooltip title="">
        <button type="button">Juror fee</button>
      </Tooltip>,
    )
    await user.hover(trigger())
    wait(500)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  // Regression: the bubble was drawn with `pointer-events: none`, so the pointer cannot rest on the tip: moving
  // onto it leaves the trigger and the tip closes 0.1s later. WCAG 1.4.13
  // (the criterion the Escape handler cites) also asks hover content to be
  // hoverable, e.g. for a screen magnifier user reading a long tip. The tip
  // is portalled but stays a React child of the trigger's wrapper, so
  // without that rule moving onto it would keep it open.
  it('stays open while the pointer rests on the tip (WCAG 1.4.13)', async () => {
    const user = setup()
    renderWithProviders(
      <Tooltip title="Paid to each juror drawn for the case">
        <button type="button">Juror fee</button>
      </Tooltip>,
    )
    await user.hover(trigger())
    wait(100)
    await user.hover(screen.getByRole('tooltip'))
    wait(500)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
  })
})
