import React, { useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from 'test/render'
import { SegmentedControl } from './primitives'

type Range = '30d' | '6m' | '1y' | '3y'
const OPTIONS: { value: Range; label: string }[] = [
  { value: '30d', label: '30D' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: '3y', label: '3Y' },
]

const Harness = ({ onChange }: { onChange?: (value: Range) => void }) => {
  const [value, setValue] = useState<Range>('6m')
  return (
    <SegmentedControl
      ariaLabel="Range"
      value={value}
      options={OPTIONS}
      onChange={(next) => {
        setValue(next)
        onChange?.(next)
      }}
    />
  )
}

describe('SegmentedControl', () => {
  it('is a radio group that marks the chosen option', () => {
    renderWithProviders(<Harness />)
    const group = screen.getByRole('radiogroup', { name: 'Range' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '6M' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('radio', { name: '30D' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  it('picks an option on click', async () => {
    const onChange = vi.fn()
    renderWithProviders(<Harness onChange={onChange} />)
    await userEvent.click(screen.getByRole('radio', { name: '1Y' }))
    expect(onChange).toHaveBeenCalledWith('1y')
    expect(screen.getByRole('radio', { name: '1Y' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('moves with the arrow keys, Home and End', async () => {
    const onChange = vi.fn()
    renderWithProviders(<Harness onChange={onChange} />)
    screen.getByRole('radio', { name: '6M' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('1y')
    await userEvent.keyboard('{End}')
    expect(onChange).toHaveBeenLastCalledWith('3y')
    await userEvent.keyboard('{Home}')
    expect(onChange).toHaveBeenLastCalledWith('30d')
    await userEvent.keyboard('{ArrowLeft}')
    // Wraps from the first to the last, or stays: either way never off the
    // ends, and the chosen option keeps the focus.
    const last = onChange.mock.lastCall?.[0]
    expect(['30d', '3y']).toContain(last)
    expect(screen.getByRole('radio', { checked: true })).toHaveFocus()
  })
})
