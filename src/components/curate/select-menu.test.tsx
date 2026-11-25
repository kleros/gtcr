import React, { useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from 'test/render'
import {
  SelectMenu,
  type SelectMenuOption,
  type SelectMenuProps,
} from './primitives'

type Sort = 'newest' | 'entries' | 'ending' | 'oldest' | 'deposit' | 'alpha'

const OPTIONS: SelectMenuOption<Sort>[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'entries', label: 'Entries', hint: 'Most first' },
  { value: 'ending', label: 'Ending soon' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'deposit', label: 'Deposit', disabled: true },
  { value: 'alpha', label: 'Alphabetical' },
]

type HarnessProps<T extends string> = Omit<
  Partial<SelectMenuProps<T>>,
  'value' | 'onChange'
> & {
  initial?: T
  onChange?: (value: T) => void
}

const Harness = <T extends string = Sort>({
  initial,
  onChange,
  options,
  ...props
}: HarnessProps<T>) => {
  const [value, setValue] = useState<T>(initial ?? ('newest' as T))
  return (
    <SelectMenu<T>
      label="Sort"
      options={options ?? (OPTIONS as unknown as SelectMenuOption<T>[])}
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange?.(next)
      }}
    />
  )
}

const trigger = () => screen.getByRole('combobox')

/** An option by the start of its name (a hint or tag may follow the label). */
const option = (label: string) =>
  screen.getByRole('option', { name: new RegExp(`^${label}`) })

/** The option the trigger points at with aria-activedescendant. */
const activeOption = () => {
  const id = trigger().getAttribute('aria-activedescendant')
  // useId ids hold colons: match the attribute rather than a #selector.
  return id ? document.querySelector(`[id="${id}"]`) : null
}

describe('SelectMenu', () => {
  it('is a closed combobox named by its label and its value', () => {
    renderWithProviders(<Harness />)
    const button = screen.getByRole('combobox', { name: 'Sort: Newest' })
    expect(button).toHaveAttribute('aria-haspopup', 'listbox')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).not.toHaveAttribute('aria-controls')
    expect(button).not.toHaveAttribute('aria-activedescendant')
    // The quiet trigger reads "Sort  Newest".
    expect(button).toHaveTextContent('Sort')
    expect(button).toHaveTextContent('Newest')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('opens on click into a listbox of the options, the chosen one selected and active', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness initial="ending" />)
    await user.click(trigger())

    const listbox = screen.getByRole('listbox', { name: 'Sort' })
    expect(trigger()).toHaveAttribute('aria-expanded', 'true')
    expect(trigger()).toHaveAttribute('aria-controls', listbox.id)
    expect(screen.getAllByRole('option')).toHaveLength(OPTIONS.length)
    expect(option('Ending soon')).toHaveAttribute('aria-selected', 'true')
    expect(option('Newest')).toHaveAttribute('aria-selected', 'false')
    expect(option('Entries')).toHaveTextContent('Most first')
    expect(option('Deposit')).toHaveAttribute('aria-disabled', 'true')
    expect(activeOption()).toBe(option('Ending soon'))
    // The trigger keeps the focus; the options are reached through it.
    expect(trigger()).toHaveFocus()
  })

  it('picks a clicked option, closes, and leaves the focus on the trigger', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(<Harness onChange={onChange} />)
    await user.click(trigger())
    await user.click(option('Ending soon'))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('ending')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(
      screen.getByRole('combobox', { name: 'Sort: Ending soon' }),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(trigger()).toHaveFocus()
  })

  it('closes without a change when the chosen option is picked again', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(<Harness onChange={onChange} />)
    await user.click(trigger())
    await user.click(option('Newest'))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('never picks or highlights a disabled option', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(<Harness onChange={onChange} />)
    await user.click(trigger())
    await user.hover(option('Oldest'))
    expect(activeOption()).toBe(option('Oldest'))
    await user.hover(option('Deposit'))
    expect(activeOption()).not.toBe(option('Deposit'))
    await user.click(option('Deposit'))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it.each([
    ['ArrowDown', '{ArrowDown}'],
    ['ArrowUp', '{ArrowUp}'],
    ['Enter', '{Enter}'],
    ['Space', ' '],
  ])(
    'opens from the keyboard on the chosen option (%s)',
    async (_name, key) => {
      const user = userEvent.setup()
      renderWithProviders(<Harness initial="oldest" />)
      await user.tab()
      expect(trigger()).toHaveFocus()
      await user.keyboard(key)
      expect(trigger()).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByRole('listbox')).toBeInTheDocument()
      expect(activeOption()).toBe(option('Oldest'))
    },
  )

  it('opens on the first option with Home and on the last with End', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness initial="oldest" />)
    await user.tab()
    await user.keyboard('{Home}')
    expect(activeOption()).toBe(option('Newest'))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    await user.keyboard('{End}')
    expect(activeOption()).toBe(option('Alphabetical'))
  })

  it('moves with the arrows, Home and End, skipping disabled options and never past the ends', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness initial="oldest" />)
    await user.tab()
    await user.keyboard('{ArrowDown}')
    expect(activeOption()).toBe(option('Oldest'))
    // Deposit is disabled: the highlight steps over it, both ways.
    await user.keyboard('{ArrowDown}')
    expect(activeOption()).toBe(option('Alphabetical'))
    await user.keyboard('{ArrowDown}')
    expect(activeOption()).toBe(option('Alphabetical'))
    await user.keyboard('{ArrowUp}')
    expect(activeOption()).toBe(option('Oldest'))
    await user.keyboard('{Home}')
    expect(activeOption()).toBe(option('Newest'))
    await user.keyboard('{ArrowUp}')
    expect(activeOption()).toBe(option('Newest'))
    await user.keyboard('{End}')
    expect(activeOption()).toBe(option('Alphabetical'))
    // Moving is not picking.
    expect(
      screen.getByRole('combobox', { name: 'Sort: Oldest' }),
    ).toBeInTheDocument()
  })

  it('pages with PageDown and PageUp, stopping at the ends', async () => {
    const user = userEvent.setup()
    const rows = Array.from({ length: 30 }, (_, index) => ({
      value: `row-${index + 1}`,
      label: `Row ${index + 1}`,
    }))
    renderWithProviders(<Harness initial="row-1" options={rows} />)
    await user.tab()
    await user.keyboard('{ArrowDown}')
    expect(activeOption()).toBe(option('Row 1$'))

    await user.keyboard('{PageDown}')
    const paged = rows.findIndex(
      (row) => row.label === activeOption()?.textContent,
    )
    // A page is more than an arrow's one row.
    expect(paged).toBeGreaterThan(1)

    await user.keyboard('{PageDown}{PageDown}{PageDown}{PageDown}')
    expect(activeOption()).toBe(option('Row 30'))
    await user.keyboard('{PageUp}')
    expect(activeOption()).not.toBe(option('Row 30'))
    await user.keyboard('{PageUp}{PageUp}{PageUp}{PageUp}')
    expect(activeOption()).toBe(option('Row 1$'))
  })

  it.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
  ])(
    'picks the active option with %s and gives the focus back to the trigger',
    async (_name, key) => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      renderWithProviders(<Harness onChange={onChange} />)
      await user.tab()
      await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}')
      expect(activeOption()).toBe(option('Ending soon'))
      await user.keyboard(key)
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith('ending')
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      expect(
        screen.getByRole('combobox', { name: 'Sort: Ending soon' }),
      ).toHaveFocus()
    },
  )

  it('closes on Escape, and only the menu: the dialog around it keeps its own Escape', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const dialogKeys = vi.fn()
    renderWithProviders(
      // A dialog listens on its panel, as ui/Modal does.
      // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
      <div
        role="dialog"
        aria-label="Filters"
        onKeyDown={(event) => dialogKeys(event.key)}
      >
        <Harness onChange={onChange} />
      </div>,
    )
    await user.tab()
    await user.keyboard('{ArrowDown}{ArrowDown}')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
    expect(trigger()).toHaveFocus()
    expect(onChange).not.toHaveBeenCalled()
    expect(dialogKeys).not.toHaveBeenCalledWith('Escape')

    // With the menu closed, Escape is the dialog's again.
    await user.keyboard('{Escape}')
    expect(dialogKeys).toHaveBeenCalledWith('Escape')
  })

  it('closes on Tab without picking, and the focus moves on', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(
      <>
        <Harness onChange={onChange} />
        <button type="button">Apply</button>
      </>,
    )
    await user.tab()
    await user.keyboard('{ArrowDown}{ArrowDown}')
    await user.tab()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Apply' })).toHaveFocus()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('closes on a press outside it, and the trigger toggles it', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness />)
    await user.click(trigger())
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await user.click(document.body)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    await user.click(trigger())
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await user.click(trigger())
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('jumps to the next option starting with a typed letter, opening the menu if needed', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    let now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    renderWithProviders(<Harness onChange={onChange} />)
    await user.tab()

    await user.keyboard('o')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(activeOption()).toBe(option('Oldest'))

    now += 1000
    await user.keyboard('a')
    expect(activeOption()).toBe(option('Alphabetical'))

    // The only "D" is disabled: the highlight stays where it is.
    now += 1000
    await user.keyboard('d')
    expect(activeOption()).toBe(option('Alphabetical'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('matches several typed letters, cycles on a repeated one, and starts over after a pause', async () => {
    const user = userEvent.setup()
    let now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    renderWithProviders(<Harness />)
    await user.tab()
    await user.keyboard('{ArrowDown}')

    // "e", "en", "end": Entries, still Entries, then Ending soon.
    await user.keyboard('e')
    expect(activeOption()).toBe(option('Entries'))
    now += 100
    await user.keyboard('n')
    expect(activeOption()).toBe(option('Entries'))
    now += 100
    await user.keyboard('d')
    expect(activeOption()).toBe(option('Ending soon'))

    // After a pause "e" is a new search from the next option on.
    now += 1000
    await user.keyboard('e')
    expect(activeOption()).toBe(option('Entries'))
    // The same letter again moves through the options that start with it.
    now += 100
    await user.keyboard('e')
    expect(activeOption()).toBe(option('Ending soon'))
    now += 100
    await user.keyboard('e')
    expect(activeOption()).toBe(option('Entries'))
  })

  it('shows the placeholder while the value matches no option', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <Harness initial={'gone' as Sort} placeholder="Pick an order" />,
    )
    expect(
      screen.getByRole('combobox', { name: 'Sort: Pick an order' }),
    ).toBeInTheDocument()
    await user.click(trigger())
    expect(screen.queryByRole('option', { selected: true })).toBeNull()
    await user.keyboard('{ArrowDown}')
    expect(activeOption()).toBe(option('Newest'))
  })

  it('keeps a hidden label in the accessible name', () => {
    renderWithProviders(<Harness hideLabel />)
    const button = screen.getByRole('combobox', { name: 'Sort: Newest' })
    expect(button).not.toHaveTextContent('Sort')
    expect(button).toHaveTextContent('Newest')
  })

  it('does not open while disabled', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness disabled />)
    expect(trigger()).toBeDisabled()
    await user.click(trigger())
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
