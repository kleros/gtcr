import React, { useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from 'test/render'
import Pagination from './Pagination'

const PAGE_SIZE = 10

/** A caller as the list pages are: the page lives in the parent's state. */
const Harness = ({
  pages,
  initial = 1,
  onChange,
}: {
  pages: number
  initial?: number
  onChange?: (page: number, pageSize: number) => void
}) => {
  const [current, setCurrent] = useState(initial)
  return (
    <>
      <Pagination
        total={pages * PAGE_SIZE}
        current={current}
        pageSize={PAGE_SIZE}
        onChange={(page, pageSize) => {
          setCurrent(page)
          onChange?.(page, pageSize)
        }}
      />
      <button type="button">Elsewhere</button>
    </>
  )
}

const page = (number: number) =>
  screen.getByRole('button', { name: `Page ${number}` })

const pageNumbers = () =>
  screen
    .getAllByRole('button', { name: /^Page \d+$/ })
    .map((button) => Number(button.textContent))

const currentPage = () =>
  screen
    .getAllByRole('button', { name: /^Page \d+$/ })
    .find((button) => button.getAttribute('aria-current') === 'page')

const jumpField = () => screen.getByRole('textbox', { name: /^Go to page/ })

describe('Pagination', () => {
  it('is a navigation landmark with previous, next and one button per page', () => {
    renderWithProviders(<Harness pages={5} />)
    expect(
      screen.getByRole('navigation', { name: 'Pagination' }),
    ).toBeInTheDocument()
    expect(pageNumbers()).toEqual([1, 2, 3, 4, 5])
    expect(currentPage()).toBe(page(1))
    expect(page(2)).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled()
    // Every page is on screen: there is nothing to jump to.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('goes to a pressed page, and steps with previous and next', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(<Harness pages={5} onChange={onChange} />)
    await user.click(page(4))
    expect(onChange).toHaveBeenLastCalledWith(4, PAGE_SIZE)
    expect(currentPage()).toBe(page(4))

    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onChange).toHaveBeenLastCalledWith(5, PAGE_SIZE)
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(onChange).toHaveBeenLastCalledWith(4, PAGE_SIZE)
    expect(onChange).toHaveBeenCalledTimes(3)
  })

  it('keeps its own page when uncontrolled', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(
      <Pagination total={50} defaultCurrent={3} onChange={onChange} />,
    )
    expect(currentPage()).toBe(page(3))
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onChange).toHaveBeenCalledWith(4, 10)
    expect(currentPage()).toBe(page(4))
  })

  it('has one page, and nowhere to step, when there is nothing to page', () => {
    renderWithProviders(<Pagination total={0} />)
    expect(pageNumbers()).toEqual([1])
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  it('skips pages when there are many, and offers a jump field', () => {
    renderWithProviders(<Harness pages={237} initial={120} />)
    // The first, the last, and the current page with its neighbours.
    expect(pageNumbers()).toEqual([1, 119, 120, 121, 237])
    expect(currentPage()).toBe(page(120))
    expect(jumpField()).toHaveAccessibleName('Go to page, 1 to 237')
    expect(jumpField()).toHaveValue('')
  })

  it('keeps only the first, current and last pages on a phone', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('max-width: 479px'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    renderWithProviders(<Harness pages={237} initial={120} />)
    expect(pageNumbers()).toEqual([1, 120, 237])
    expect(jumpField()).toBeInTheDocument()
  })

  it('takes digits only in the jump field, no more than the last page has', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(<Harness pages={237} onChange={onChange} />)
    await user.type(jumpField(), '1a3-7')
    expect(jumpField()).toHaveValue('137')
    await user.type(jumpField(), '99')
    expect(jumpField()).toHaveValue('137')
    // Typing alone never navigates.
    expect(onChange).not.toHaveBeenCalled()
  })

  it('goes to the typed page on Enter, once, and empties the field', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(<Harness pages={237} onChange={onChange} />)
    await user.type(jumpField(), '137{Enter}')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(137, PAGE_SIZE)
    expect(currentPage()).toBe(page(137))
    expect(jumpField()).toHaveValue('')

    // Leaving the emptied field afterwards writes nothing more.
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  // Regression: the field was rendered inside its ellipsis' fragment, keyed
  // `page + idx` (Pagination.tsx:465). A jump that moves that ellipsis to
  // another index (page 1 to 137: from the 3rd item to the 6th) or to the
  // other ellipsis (120 to 237) remounts the field, and the focus falls to
  // <body>, though the comment by its onBlur says focus stays on the field.
  // A keyboard user starts over from the top of the page after every such
  // jump. (From 120 to 137 the index holds and the focus stays.)
  it('keeps the focus in the jump field after a jump', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness pages={237} />)
    await user.type(jumpField(), '137{Enter}')
    expect(currentPage()).toBe(page(137))
    expect(jumpField()).toHaveFocus()
  })

  it('clamps a number out of range to the first or the last page', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(
      <Harness pages={237} initial={120} onChange={onChange} />,
    )
    await user.type(jumpField(), '999{Enter}')
    expect(onChange).toHaveBeenLastCalledWith(237, PAGE_SIZE)
    expect(currentPage()).toBe(page(237))

    await user.type(jumpField(), '0{Enter}')
    expect(onChange).toHaveBeenLastCalledWith(1, PAGE_SIZE)
    expect(currentPage()).toBe(page(1))
  })

  it('writes nothing for the page already shown', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(
      <Harness pages={237} initial={120} onChange={onChange} />,
    )
    await user.type(jumpField(), '120{Enter}')
    expect(onChange).not.toHaveBeenCalled()
    expect(jumpField()).toHaveValue('')
  })

  // Regression: commitJump compared the typed
  // number with the current page before goTo clamps it, so on the last page
  // "999" (or on the first, "0") writes the page already shown. Every caller
  // puts the page in the URL: standard-items' goToPage pushes a history
  // entry and scrolls the list back to its toolbar for nothing.
  it('writes nothing when a clamped jump lands on the page already shown', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(
      <Harness pages={237} initial={237} onChange={onChange} />,
    )
    await user.type(jumpField(), '999{Enter}')
    expect(onChange).not.toHaveBeenCalled()
  })

  // Regression (as on master): the current page's button called
  // goTo(current) (Pagination.tsx:518, the PageButton's onClick), so
  // pressing the page already shown writes it again: a second history entry
  // for the same page and a scroll back to the toolbar.
  it('writes nothing when the current page is pressed again', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(<Harness pages={5} initial={3} onChange={onChange} />)
    await user.click(page(3))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('drops the typed page on Escape', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(<Harness pages={237} onChange={onChange} />)
    await user.type(jumpField(), '137{Escape}')
    expect(jumpField()).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('goes to the typed page when the field is left for anything outside the pager', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(<Harness pages={237} onChange={onChange} />)
    await user.type(jumpField(), '137')
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(137, PAGE_SIZE)
    expect(jumpField()).toHaveValue('')
  })

  it('goes to the typed page after a press on a gap between the controls', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(<Harness pages={237} onChange={onChange} />)
    await user.type(jumpField(), '137')
    await user.click(screen.getByText('…'))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(137, PAGE_SIZE)
  })

  it('hands the move to a pager control pressed while a page is typed, navigating once', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(
      <Harness pages={237} initial={120} onChange={onChange} />,
    )
    await user.type(jumpField(), '137')
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(121, PAGE_SIZE)
    expect(currentPage()).toBe(page(121))
    expect(jumpField()).toHaveValue('')

    await user.type(jumpField(), '50')
    await user.click(page(1))
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenLastCalledWith(1, PAGE_SIZE)
  })

  it('drops the typed page when Tab moves on to another pager control', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(<Harness pages={237} onChange={onChange} />)
    await user.type(jumpField(), '137')
    await user.tab()
    expect(page(237)).toHaveFocus()
    expect(onChange).not.toHaveBeenCalled()
    expect(jumpField()).toHaveValue('')
  })
})
