import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from 'test/render'
import EvidenceForm from './evidence-form'

vi.mock('@kleros/kleros-app', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@kleros/kleros-app')>()),
  useAtlasProvider: () => ({ roleRestrictions: undefined }),
}))

// The Markdown renderer is a lazy chunk: loaded once, before the tests.
beforeAll(async () => {
  await import('components/curate/evidence-markdown')
})

const PREVIEW = 'Preview of the description'

describe.each(['composer', 'fields'] as const)('the %s preview', (variant) => {
  it('shows the description as the history will, then writing again', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <EvidenceForm formID="evidence" variant={variant} onSubmit={() => {}} />,
    )
    const field = screen.getByRole('textbox', { name: /^Description/ })
    const toggle = screen.getByRole('button', { name: 'Preview' })
    expect(toggle).toBeDisabled()

    await user.type(field, 'The tag **must** differ.')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    const preview = screen.getByRole('group', { name: PREVIEW })
    expect((await within(preview).findByText('must')).tagName).toBe('STRONG')
    expect(field).not.toBeVisible()

    await user.click(toggle)
    expect(screen.queryByRole('group', { name: PREVIEW })).toBeNull()
    expect(field).toBeVisible()
    await waitFor(() => expect(field).toHaveFocus())
    expect(field).toHaveValue('The tag **must** differ.')
  })

  it('shows the text again when a send is refused for it', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <>
        <EvidenceForm formID="evidence" variant={variant} onSubmit={() => {}} />
        <button type="submit" form="evidence">
          Send
        </button>
      </>,
    )
    const field = screen.getByRole('textbox', { name: /^Description/ })
    await user.click(field)
    await user.paste(`${'x'.repeat(1100)} *too long*`)
    await user.click(screen.getByRole('button', { name: 'Preview' }))
    expect(field).not.toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText(/too long \(1,024 at most\)/)).toBeVisible()
    expect(screen.queryByRole('group', { name: PREVIEW })).toBeNull()
    expect(field).toBeVisible()
  })

  it('writes again once the text is emptied', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <EvidenceForm formID="evidence" variant={variant} onSubmit={() => {}} />,
    )
    const field = screen.getByRole('textbox', { name: /^Description/ })
    await user.type(field, 'Plain text')
    await user.click(screen.getByRole('button', { name: 'Preview' }))
    expect(screen.getByRole('group', { name: PREVIEW })).toHaveTextContent(
      'Plain text',
    )
    await user.click(screen.getByRole('button', { name: 'Preview' }))
    await user.clear(field)
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled()
    await user.type(field, 'Again')
    expect(field).toBeVisible()
    expect(screen.queryByRole('group', { name: PREVIEW })).toBeNull()
  })
})
