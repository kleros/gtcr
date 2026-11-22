import React from 'react'
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from 'test/render'
import { getAddressPage } from 'utils/network-utils'
import { ChromeAddress, CopyValue, CuratorAddress } from './chrome-address'
import { ExplorerAddressLink } from './item-standard-fields'
import { truncateMiddle } from './primitives'

const PERSON = '0xAbCdEf0123456789aBcDeF0123456789AbCdEf01'
const CONTRACT = '0x66260C69d03837016d88c9877e61e08Ef74C59F2'
const EXPLORER = `https://gnosisscan.io/address/${CONTRACT}`

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** A name that contains this text somewhere. */
const containing = (text: string) => new RegExp(escape(text))

describe('CuratorAddress', () => {
  it("opens the person's Curate profile, cut 6…4, with no explorer arrow", () => {
    renderWithProviders(<CuratorAddress address={PERSON} />)
    const link = screen.getByRole('link', { name: '0xAbCd…Ef01' })
    expect(link).toHaveAttribute('href', `/address/${PERSON.toLowerCase()}`)
    expect(link).not.toHaveAttribute('target')
    // The arrow means "leaves the app"; a profile is in the app.
    expect(link.querySelector('svg')).toBeNull()
    expect(link).toHaveAttribute('title', expect.stringContaining(PERSON))
  })

  it('stays in the app: a click lands on the profile route', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <Routes>
        <Route path="/" element={<CuratorAddress address={PERSON} />} />
        <Route path="/address/:address" element={<p>Profile page</p>} />
      </Routes>,
    )
    await user.click(screen.getByRole('link', { name: '0xAbCd…Ef01' }))
    expect(screen.getByText('Profile page')).toBeInTheDocument()
  })

  it('shows a label in place of the address, and still opens the profile', () => {
    renderWithProviders(<CuratorAddress address={PERSON} label="You" />)
    expect(screen.getByRole('link', { name: 'You' })).toHaveAttribute(
      'href',
      `/address/${PERSON.toLowerCase()}`,
    )
  })

  it('has a copy button beside it that copies the full address', async () => {
    const user = userEvent.setup()
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue()
    renderWithProviders(<CuratorAddress address={PERSON} />)
    await user.click(screen.getByRole('button', { name: 'Copy address' }))
    expect(writeText).toHaveBeenCalledWith(PERSON)
  })
})

describe('ChromeAddress', () => {
  it('opens a contract on the explorer in a new tab, named by what it shows', () => {
    const shown = truncateMiddle(CONTRACT, 6, 4)
    renderWithProviders(
      <ChromeAddress address={CONTRACT} display={shown} href={EXPLORER} />,
    )
    const link = screen.getByRole('link', { name: containing(shown) })
    expect(link).toHaveAttribute('href', EXPLORER)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'))
    // Its arrow says it leaves the app, and is not read out.
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(link).toHaveAttribute('title', expect.stringContaining(CONTRACT))
    expect(
      screen.getByRole('button', { name: 'Copy address' }),
    ).toBeInTheDocument()
  })

  it('is plain text, with copy, when there is no explorer page', () => {
    renderWithProviders(<ChromeAddress address={CONTRACT} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText(CONTRACT)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Copy address' }),
    ).toBeInTheDocument()
  })

  it('copies its copy value when it has one', async () => {
    const user = userEvent.setup()
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue()
    renderWithProviders(
      <ChromeAddress
        address={CONTRACT}
        display="eip155:100:0x6626…59F2"
        copyValue={`eip155:100:${CONTRACT}`}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Copy address' }))
    expect(writeText).toHaveBeenCalledWith(`eip155:100:${CONTRACT}`)
  })

  // Regression: DESIGN.md (Addresses) asks an explorer link to say where it goes to
  // a screen reader, with hidden text around the visible address ("List
  // contract 0x66260c…4c59f2 on the explorer (opens in a new tab)"), as the
  // list header (registry-header.tsx) and the profile's chain plates do.
  // ChromeAddress, the explorer link for every other contract (the
  // arbitrator, contract fields), is named by the bare short address; that
  // it opens the explorer is only in its title (chrome-address.tsx:338), and
  // that it opens a new tab is said nowhere.
  it('tells a screen reader that it opens the explorer in a new tab', () => {
    const shown = truncateMiddle(CONTRACT, 6, 4)
    renderWithProviders(
      <ChromeAddress address={CONTRACT} display={shown} href={EXPLORER} />,
    )
    const link = screen.getByRole('link', { name: containing(shown) })
    expect(link).toHaveAccessibleName(/new tab/i)
  })
})

describe('ExplorerAddressLink', () => {
  it("opens the address on the URL chain's explorer, cut 6…4", () => {
    renderWithProviders(<ExplorerAddressLink address={CONTRACT} />, {
      route: '/tcr/100/0x0000000000000000000000000000000000000001',
    })
    const link = screen.getByRole('link', {
      name: containing(truncateMiddle(CONTRACT, 6, 4)),
    })
    expect(link).toHaveAttribute(
      'href',
      getAddressPage({ networkId: 100, address: CONTRACT }),
    )
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('is plain text with copy when the URL names no chain', () => {
    renderWithProviders(<ExplorerAddressLink address={CONTRACT} />, {
      route: '/',
    })
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText(truncateMiddle(CONTRACT, 6, 4))).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Copy address' }),
    ).toBeInTheDocument()
  })
})

describe('CopyValue', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  /* user-event's setup puts a clipboard on navigator; spy on it after. */
  const setup = () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    return userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTime(ms),
    })
  }

  it('copies the value, reports it in a live region, and settles back after 1.6s', async () => {
    const user = setup()
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue()
    renderWithProviders(
      <CopyValue value={CONTRACT} label="Copy list address" />,
    )
    const status = screen.getByRole('status')
    expect(status).toBeEmptyDOMElement()

    await user.click(screen.getByRole('button', { name: 'Copy list address' }))
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith(CONTRACT)
    expect(status).toHaveTextContent('Copied')
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1600)
    })
    expect(status).toBeEmptyDOMElement()
    expect(
      screen.getByRole('button', { name: 'Copy list address' }),
    ).toBeInTheDocument()
  })

  it('reports a copy the browser refused', async () => {
    const user = setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
      new Error('Write permission denied'),
    )
    renderWithProviders(<CopyValue value={CONTRACT} />)
    await user.click(screen.getByRole('button', { name: 'Copy address' }))
    expect(screen.getByRole('status')).toHaveTextContent('Copy failed')
    expect(
      screen.getByRole('button', { name: 'Copy failed' }),
    ).toBeInTheDocument()
  })

  it('reports a failure where the browser has no clipboard', async () => {
    const user = setup()
    const own = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })
    try {
      renderWithProviders(<CopyValue value={CONTRACT} />)
      await user.click(screen.getByRole('button', { name: 'Copy address' }))
      expect(screen.getByRole('status')).toHaveTextContent('Copy failed')
    } finally {
      if (own) Object.defineProperty(navigator, 'clipboard', own)
    }
  })

  it('never lets its click reach a row link around it', async () => {
    const user = setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    const onRowClick = vi.fn()
    renderWithProviders(
      <Routes>
        <Route
          path="/"
          element={
            <Link to="/entry" onClick={onRowClick}>
              Entry row <CopyValue value={CONTRACT} />
            </Link>
          }
        />
        <Route path="/entry" element={<p>Entry page</p>} />
      </Routes>,
    )
    await user.click(screen.getByRole('button', { name: 'Copy address' }))
    expect(onRowClick).not.toHaveBeenCalled()
    expect(screen.queryByText('Entry page')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Copied')
  })

  // Regression: the live region sat inside the copy button (the Unseen
  // role="status" in CopyButton). DESIGN.md (Addresses) puts the
  // copy report in a live region beside the control, as the item ID's
  // CopyId does (item-hero-facts.tsx). A button's children are
  // presentational in ARIA, so a browser may drop the region with them
  // (WebKit prunes button descendants) and VoiceOver never hears "Copied".
  it('reports the copy in a live region beside the button, not inside it', async () => {
    const user = setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    renderWithProviders(<CopyValue value={CONTRACT} />)
    const button = screen.getByRole('button', { name: 'Copy address' })
    await user.click(button)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Copied')
    expect(button).not.toContainElement(status)
  })
})
