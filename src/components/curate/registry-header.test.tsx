import React from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from 'test/render'
import { RegistryHeader } from './registry-header'

/*
 * The header's main action. A badges list takes no entries, and which kind
 * a Standard list is comes with its metadata: until then the button's place
 * is held, so a Submit button never shows and then goes.
 */

type Props = React.ComponentProps<typeof RegistryHeader>

const header = (props: Partial<Props>) =>
  renderWithProviders(
    <RegistryHeader
      title="Tokens"
      address="0x1111111111111111111111111111111111111111"
      chainId={100}
      kind="standard"
      itemName="token"
      primaryLabel="Submit token"
      stats={[]}
      parameters={[]}
      explainerId="how"
      explainerHeading="How it works"
      explainerSteps={[]}
      {...props}
    />,
  )

describe('RegistryHeader: the main action', () => {
  it('holds its place, with nothing to press, while the kind is read', () => {
    header({ primaryPending: true, onPrimary: vi.fn() })
    expect(screen.queryByRole('button', { name: /Submit token/ })).toBeNull()
    expect(screen.queryByText(/A deposit, not a fee/)).toBeNull()
  })

  it('offers the submit button, with its note, on a list that takes entries', () => {
    header({ onPrimary: vi.fn() })
    expect(
      screen.getByRole('button', { name: /Submit token/ }),
    ).toBeInTheDocument()
    expect(screen.getByText(/A deposit, not a fee/)).toBeInTheDocument()
  })

  it('says why there is no button on a badges list', () => {
    header({ depositNote: 'Badges are retired.' })
    expect(screen.queryByRole('button', { name: /Submit token/ })).toBeNull()
    expect(screen.getByText('Badges are retired.')).toBeInTheDocument()
  })
})
