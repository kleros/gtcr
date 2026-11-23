import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from 'test/render'
import {
  SubmitPage,
  type SubmitPageProps,
  type SubmitTerms,
} from './submit-page'
import { buildInitialValues } from './form'
import { draftKey, saveDraft } from './draft'

/*
 * The submit form keeps a draft for its tab (draft.ts): leaving the page by
 * any route, or reloading it, never loses what was typed. Each render below
 * is the page opening; unmounting it is the page being left.
 */

vi.mock('@reown/appkit/react', () => ({
  useAppKitState: () => ({ open: false }),
}))
vi.mock('@kleros/kleros-app', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@kleros/kleros-app')>()),
  useAtlasProvider: () => ({ roleRestrictions: undefined }),
}))

const LIST = '/tcr/100/0x66260c69d03837016d88c9877e61e08ef74c59f2'
const OTHER_CHAIN = '/tcr/1/0x66260c69d03837016d88c9877e61e08ef74c59f2'

const COLUMNS = [
  { label: 'Name', type: 'text', isIdentifier: true },
  { label: 'Website', type: 'link' },
] as Column[]
const BLANK: unknown[] = []
const ENTRY: unknown[] = ['Rejected entry', 'https://old.example']

const TERMS: SubmitTerms = {
  parts: [],
  amountText: '1 xDAI',
  outcomes: [],
  status: { label: 'Submitted' },
}

const props = (overrides: Partial<SubmitPageProps> = {}): SubmitPageProps => ({
  registryPath: LIST,
  registryTitle: 'Address Tags',
  itemName: 'tag',
  chainId: 100,
  lede: 'If your tag follows the list’s policy, it is accepted.',
  columns: COLUMNS,
  initialValues: BLANK,
  terms: TERMS,
  ready: true,
  gate: {},
  phase: 'idle',
  submitting: false,
  factoryChecks: {
    deployedWithStandardFactory: async () => true,
    deployedWithPermanentFactory: async () => true,
  },
  onSubmit: async () => {},
  ...overrides,
})

const open = (overrides?: Partial<SubmitPageProps>) =>
  renderWithProviders(<SubmitPage {...props(overrides)} />, {
    route: `${LIST}/submit`,
  })

const field = (name: string) => screen.getByRole('textbox', { name })
const restoredNote = () => screen.queryByText(/^Restored the tag you started/)

/** Opens the page, types into it, and leaves it. */
const typeAndLeave = async (
  values: Record<string, string>,
  overrides?: Partial<SubmitPageProps>,
) => {
  const user = userEvent.setup()
  const { unmount } = open(overrides)
  for (const [name, value] of Object.entries(values)) {
    await user.clear(field(name))
    await user.type(field(name), value)
  }
  unmount()
}

describe('Submit page: the draft', () => {
  it('opens with what was typed after the page was left, and says so', async () => {
    await typeAndLeave({ Name: 'Kleros' })
    open()

    expect(field('Name')).toHaveValue('Kleros')
    expect(restoredNote()).toHaveTextContent(
      'Restored the tag you started. Clear form',
    )
  })

  it('never shows a draft on another chain or list', async () => {
    await typeAndLeave({ Name: 'Kleros' })
    open({ registryPath: OTHER_CHAIN })

    expect(field('Name')).toHaveValue('')
    expect(restoredNote()).not.toBeInTheDocument()
  })

  it('never puts another draft in place of a resubmission’s values', async () => {
    await typeAndLeave({ Name: 'A new tag' })
    const { unmount } = open({ initialValues: ENTRY })

    expect(field('Name')).toHaveValue('Rejected entry')
    expect(restoredNote()).not.toBeInTheDocument()
    unmount()

    // The resubmission keeps a draft of its own, and the new one stays.
    await typeAndLeave({ Name: 'Fixed entry' }, { initialValues: ENTRY })
    const resubmission = open({ initialValues: ENTRY })
    expect(field('Name')).toHaveValue('Fixed entry')
    resubmission.unmount()
    open()
    expect(field('Name')).toHaveValue('A new tag')
  })

  it('starts again from the page’s own values with Clear form', async () => {
    const user = userEvent.setup()
    await typeAndLeave({ Name: 'Kleros' })
    const { unmount } = open()

    await user.click(screen.getByRole('button', { name: 'Clear form' }))
    expect(field('Name')).toHaveValue('')
    expect(field('Name')).toHaveFocus()
    expect(restoredNote()).not.toBeInTheDocument()
    unmount()

    open()
    expect(field('Name')).toHaveValue('')
  })

  it('goes once the entry is sent', async () => {
    const user = userEvent.setup()
    let leave = () => {}
    // What both submit hooks do once the transaction is confirmed: open the
    // new entry, which leaves this page, then reset the form.
    const onSubmit = vi.fn<SubmitPageProps['onSubmit']>(
      async (_values, _columns, resetForm) => {
        leave()
        resetForm({})
      },
    )
    const { unmount } = open({ onSubmit })
    leave = unmount
    await user.type(field('Name'), 'Kleros')
    await user.type(field('Website'), 'https://kleros.io')
    // Left first: user-event drops a click whose press also blurs a field.
    await user.tab()
    await user.click(
      screen.getAllByRole('button', { name: 'Submit a tag · 1 xDAI' })[0],
    )
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())

    open()
    expect(field('Name')).toHaveValue('')
    expect(restoredNote()).not.toBeInTheDocument()
  })

  it('is let go while the transaction mines, and back if it fails', async () => {
    const user = userEvent.setup()
    const { rerender } = open()
    await user.type(field('Name'), 'Kleros')
    expect(window.sessionStorage).toHaveLength(1)

    rerender(<SubmitPage {...props({ phase: 'mining', submitting: true })} />)
    expect(window.sessionStorage).toHaveLength(0)

    rerender(<SubmitPage {...props()} />)
    expect(window.sessionStorage).toHaveLength(1)
  })

  it('goes with Cancel, once leaving is confirmed', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    open()
    await user.type(field('Name'), 'Kleros')
    const cancel = screen.getAllByRole('link', { name: 'Cancel' })[0]

    await user.click(cancel)
    expect(confirm).toHaveBeenCalledWith(
      'Leave this page? What you entered will be lost.',
    )
    expect(window.sessionStorage).toHaveLength(1)

    confirm.mockReturnValue(true)
    await user.click(cancel)
    expect(window.sessionStorage).toHaveLength(0)
  })

  it('still asks before the tab is left while anything is entered', async () => {
    await typeAndLeave({ Name: 'Kleros' })
    open()

    // Nothing typed since it opened: the restored text is still unsent.
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it('asks for a picked file again: files are not kept', () => {
    const columns = [
      { label: 'Name', type: 'text', isIdentifier: true },
      { label: 'Logo', type: 'image' },
    ] as Column[]
    const start = buildInitialValues(columns, BLANK)
    saveDraft(draftKey(LIST, start), columns, start, {
      Name: 'Kleros',
      Logo: new File(['png'], 'logo.png', { type: 'image/png' }),
    })
    open({ columns })

    expect(field('Name')).toHaveValue('Kleros')
    expect(restoredNote()).toHaveTextContent(
      'Restored the tag you started; choose its files again.',
    )
  })

  it('never breaks the form when storage is blocked or full', async () => {
    const user = userEvent.setup()
    const refuse = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(refuse)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(refuse)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(refuse)
    open()

    await user.type(field('Name'), 'Kleros')
    expect(field('Name')).toHaveValue('Kleros')
    fireEvent.blur(field('Name'))
    expect(restoredNote()).not.toBeInTheDocument()
  })
})
