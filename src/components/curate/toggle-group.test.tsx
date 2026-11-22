import React, { useState } from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from 'test/render'
import { ToggleGroup, type ToggleOption } from './primitives'

type Kind = 'standard' | 'light' | 'stake'

const OPTIONS: ToggleOption<Kind>[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'light', label: 'Light' },
  { value: 'stake', label: 'Stake' },
]

const Harness = ({
  initial = ['stake'],
  options = OPTIONS,
  onChange,
}: {
  initial?: Kind[]
  options?: ToggleOption<Kind>[]
  onChange?: (value: Kind[]) => void
}) => {
  const [value, setValue] = useState<Kind[]>(initial)
  return (
    <ToggleGroup
      ariaLabel="List type"
      value={value}
      options={options}
      onChange={(next) => {
        setValue(next)
        onChange?.(next)
      }}
    />
  )
}

const toggle = (name: string) =>
  screen.getByRole('button', { name: new RegExp(`^${name}`) })

describe('ToggleGroup', () => {
  it('is a named group of toggle buttons, each pressed or not', () => {
    renderWithProviders(<Harness initial={['standard', 'stake']} />)
    const group = screen.getByRole('group', { name: 'List type' })
    expect(within(group).getAllByRole('button')).toHaveLength(3)
    expect(toggle('Standard')).toHaveAttribute('aria-pressed', 'true')
    expect(toggle('Light')).toHaveAttribute('aria-pressed', 'false')
    expect(toggle('Stake')).toHaveAttribute('aria-pressed', 'true')
  })

  it('flips the clicked option and reports the pressed values in option order', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(<Harness initial={['stake']} onChange={onChange} />)

    await user.click(toggle('Standard'))
    // Option order, not the order they were pressed in.
    expect(onChange).toHaveBeenLastCalledWith(['standard', 'stake'])
    expect(toggle('Standard')).toHaveAttribute('aria-pressed', 'true')

    await user.click(toggle('Stake'))
    expect(onChange).toHaveBeenLastCalledWith(['standard'])
    expect(toggle('Stake')).toHaveAttribute('aria-pressed', 'false')

    await user.click(toggle('Standard'))
    expect(onChange).toHaveBeenLastCalledWith([])
    expect(onChange).toHaveBeenCalledTimes(3)
  })

  it('gives every option its own tab stop, and Space or Enter flips the focused one', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(<Harness initial={[]} onChange={onChange} />)

    await user.tab()
    expect(toggle('Standard')).toHaveFocus()
    await user.tab()
    expect(toggle('Light')).toHaveFocus()
    await user.keyboard(' ')
    expect(onChange).toHaveBeenLastCalledWith(['light'])

    await user.tab()
    expect(toggle('Stake')).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenLastCalledWith(['light', 'stake'])
    expect(toggle('Stake')).toHaveAttribute('aria-pressed', 'true')
  })

  it('names an icon-only option by its label', () => {
    renderWithProviders(
      <Harness
        options={[
          { value: 'standard', label: 'Standard', icon: 'registry' },
          { value: 'stake', label: 'Stake', icon: 'shield', hideLabel: true },
        ]}
      />,
    )
    const stake = screen.getByRole('button', { name: 'Stake' })
    expect(stake).toHaveAttribute('aria-pressed', 'true')
    expect(stake).not.toHaveTextContent('Stake')
    expect(toggle('Standard')).toHaveTextContent('Standard')
  })

  it('shows a count after the label', () => {
    renderWithProviders(
      <Harness
        options={[
          { value: 'standard', label: 'Standard', count: 1234 },
          { value: 'stake', label: 'Stake', count: 0 },
        ]}
      />,
    )
    expect(toggle('Standard')).toHaveTextContent(/^Standard\s*1,234$/)
    expect(toggle('Stake')).toHaveTextContent(/^Stake\s*0$/)
  })
})
