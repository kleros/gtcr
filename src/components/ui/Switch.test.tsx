import React, { useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from 'test/render'
import Switch from './Switch'

describe('Switch', () => {
  it('is a switch named by its aria-label, off by default', () => {
    renderWithProviders(<Switch aria-label="Identifier" />)
    const control = screen.getByRole('switch', { name: 'Identifier' })
    expect(control).not.toBeChecked()
    expect(control).toHaveAttribute('aria-checked', 'false')
  })

  it('starts from defaultChecked and turns itself over on click when uncontrolled', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(
      <Switch aria-label="Notifications" defaultChecked onChange={onChange} />,
    )
    const control = screen.getByRole('switch', { name: 'Notifications' })
    expect(control).toBeChecked()
    await user.click(control)
    expect(control).not.toBeChecked()
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.lastCall?.[0]).toBe(false)
    await user.click(control)
    expect(control).toBeChecked()
    expect(onChange.mock.lastCall?.[0]).toBe(true)
  })

  it('follows `checked` when controlled, reporting the next state without taking it', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onClick = vi.fn()
    const { rerender } = renderWithProviders(
      <Switch
        aria-label="Identifier"
        checked={false}
        onChange={onChange}
        onClick={onClick}
      />,
    )
    const control = screen.getByRole('switch', { name: 'Identifier' })
    await user.click(control)
    expect(onChange.mock.lastCall?.[0]).toBe(true)
    expect(onClick.mock.lastCall?.[0]).toBe(true)
    // The parent has not taken the change: it is still off.
    expect(control).not.toBeChecked()

    rerender(<Switch aria-label="Identifier" checked onChange={onChange} />)
    expect(control).toBeChecked()
  })

  it('toggles from the keyboard with Space and Enter', async () => {
    const user = userEvent.setup()
    const Harness = () => {
      const [on, setOn] = useState(false)
      return <Switch aria-label="Identifier" checked={on} onChange={setOn} />
    }
    renderWithProviders(<Harness />)
    await user.tab()
    const control = screen.getByRole('switch', { name: 'Identifier' })
    expect(control).toHaveFocus()
    await user.keyboard(' ')
    expect(control).toBeChecked()
    await user.keyboard('{Enter}')
    expect(control).not.toBeChecked()
  })

  it('cannot be reached or turned over while disabled', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(
      <>
        <Switch aria-label="Identifier" disabled onChange={onChange} />
        <button type="button">Next</button>
      </>,
    )
    const control = screen.getByRole('switch', { name: 'Identifier' })
    expect(control).toBeDisabled()
    await user.click(control)
    expect(onChange).not.toHaveBeenCalled()
    expect(control).not.toBeChecked()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus()
  })

  it('shows its on and off text, and keeps its own name', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <Switch
        aria-label="Advanced mode"
        checkedChildren="On"
        unCheckedChildren="Off"
      />,
    )
    const control = screen.getByRole('switch', { name: 'Advanced mode' })
    expect(control).toHaveTextContent('Off')
    await user.click(control)
    expect(control).toHaveTextContent('On')
    expect(control).toHaveAccessibleName('Advanced mode')
  })

  it('is named by a <label> pointing at its id', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(
      <>
        <label htmlFor="identifier-switch">Identifier</label>
        <Switch id="identifier-switch" onChange={onChange} />
      </>,
    )
    const control = screen.getByRole('switch', { name: 'Identifier' })
    // A press on the label flips it, as on a native control.
    await user.click(screen.getByText('Identifier'))
    expect(onChange.mock.lastCall?.[0]).toBe(true)
    expect(control).toBeChecked()
  })
})
