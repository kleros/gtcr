import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from 'test/render'
import { Dialog } from './item-standard-dialog'

// The wallet modal is never open here (and its kit is not loaded).
vi.mock('config/wagmi', () => ({ appKitModal: undefined }))

const WARNING = 'Close this? Your justification will be lost.'

const open = (onClose: () => void, discardWarning?: string) =>
  renderWithProviders(
    <Dialog
      open
      onClose={onClose}
      discardWarning={discardWarning}
      title="Challenge the submission"
    >
      <textarea aria-label="Justification" defaultValue="It breaks rule 2." />
    </Dialog>,
  )

/** The dimmed layer around the panel, which closes the dialog. */
const scrim = () => screen.getByRole('dialog').parentElement as HTMLElement

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Dialog', () => {
  it('closes at once when nothing would be lost', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    const onClose = vi.fn()
    open(onClose)

    await userEvent.keyboard('{Escape}')
    fireEvent.mouseDown(scrim())
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledTimes(3)
    expect(confirm).not.toHaveBeenCalled()
  })

  it('asks before Escape, the scrim or Close throws a draft away', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const onClose = vi.fn()
    open(onClose, WARNING)

    await userEvent.keyboard('{Escape}')
    fireEvent.mouseDown(scrim())
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(confirm).toHaveBeenCalledTimes(3)
    expect(confirm).toHaveBeenCalledWith(WARNING)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Justification')).toHaveValue(
      'It breaks rule 2.',
    )
  })

  it('closes once the person agrees to discard', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onClose = vi.fn()
    open(onClose, WARNING)

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ignores a click that starts inside the panel', () => {
    const onClose = vi.fn()
    open(onClose)

    fireEvent.mouseDown(screen.getByRole('dialog'))

    expect(onClose).not.toHaveBeenCalled()
  })
})
