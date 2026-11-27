import React from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from 'test/render'

// The connected wallet, which the Disputes panel reads for "Your case".
const wallet = vi.hoisted(() => ({ account: undefined as string | undefined }))
vi.mock('wagmi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('wagmi')>()),
  useAccount: () => ({
    address: wallet.account,
    isConnected: !!wallet.account,
  }),
}))
import { LiveBoard, type RulingsView } from './happening-now'
import type { HappeningFigures, OpenListChip } from './board-rows'
import type { UsdPrice } from './prices'
import type { DashboardCard } from './view'

const NOW = 1_795_600_000
const TAGS = `0x${'a'.repeat(40)}`
const TOKENS = `0x${'b'.repeat(40)}`
const WALLETS = `0x${'c'.repeat(40)}`
const XDAI = 10n ** 18n

const card = (
  id: string,
  registry: string,
  title: string,
  closesIn: number,
): DashboardCard => ({
  id,
  href: `/tcr/100/${registry}/0x${id.padStart(64, '0')}`,
  registry: title,
  registryAddress: registry,
  identifiers: [{ label: 'Address', value: `0x${id.padStart(40, '0')}` }],
  chainId: 100,
  when: 'submitted 1h ago',
  detail: '',
  tone: 'window',
  request: 'submission',
  deposit: String(30n * XDAI),
  windowStart: NOW - 3_600,
  windowEnd: NOW + closesIn,
  at: NOW - 3_600,
})

const list = (
  registry: string,
  title: string,
  count: number,
): OpenListChip => ({
  key: `100:${registry}`,
  title,
  count,
  href: `/tcr/100/${registry}?submitted=true&removalRequested=true&oldestFirst=true`,
})

const OPEN = [
  card('1', TAGS, 'Address Tags', 600),
  card('2', TOKENS, 'Kleros Tokens', 1_200),
  card('3', TAGS, 'Address Tags', 1_800),
]
const LISTS = [list(TAGS, 'Address Tags', 5), list(TOKENS, 'Kleros Tokens', 2)]
const FIGURES: HappeningFigures = {
  inWindow: 7,
  pastWindow: 0,
  inWindowDeposits: { 100: 210n * XDAI },
  windowsKnown: true,
  unchallenged: 7,
  unchallengedCapped: false,
  inCourt: 0,
  inCourtCapped: false,
}
const RULINGS: RulingsView = {
  cards: [],
  pending: new Set(),
  total: 0,
  capped: false,
  partial: false,
}
const PRICES: Record<string, UsdPrice> = {
  '100:native': {
    usd: 1,
    updatedAt: NOW,
    staleAfter: NOW + 86_400,
    pair: 'DAI / USD',
  },
}

const board = (props: Partial<React.ComponentProps<typeof LiveBoard>> = {}) =>
  renderWithProviders(
    <LiveBoard
      open={OPEN}
      openLists={LISTS}
      live={[]}
      rulings={RULINGS}
      figures={FIGURES}
      prices={PRICES}
      pricesSettled
      checking={false}
      now={NOW}
      {...props}
    />,
  )

/** The hrefs of the rows the column draws (not the "All n by list" links). */
const rowLinks = (panel: HTMLElement) => {
  const rows = within(panel).queryByRole('list', {
    name: /^Requests in their challenge window/,
  })
  return rows
    ? within(rows)
        .getAllByRole('listitem')
        .map((row) => within(row).getByRole('link').getAttribute('href'))
    : []
}

describe('LiveBoard', () => {
  afterEach(() => {
    wallet.account = undefined
  })

  it('puts a connected party’s own case in court first, marked', () => {
    const PARTY = `0x${'d'.repeat(40)}`
    const dispute = (id: string, parties: string[]): DashboardCard => ({
      ...card(id, TAGS, 'Address Tags', 0),
      when: 'challenged 2d ago',
      detail: 'Dispute',
      detailId: `#${id}`,
      tone: 'contested',
      parties,
    })
    const live = [
      dispute('11', [`0x${'e'.repeat(40)}`, `0x${'f'.repeat(40)}`]),
      dispute('12', [`0x${'e'.repeat(40)}`, PARTY]),
    ]
    const inCourt = () =>
      within(screen.getByRole('region', { name: 'Disputes' }))
        .getAllByRole('link')
        .filter((link) => /In court/.test(link.textContent ?? ''))

    // Anyone else sees the panel as it was.
    const { unmount } = board({ live })
    expect(inCourt().map((row) => row.textContent)).not.toContain('Your case')
    expect(inCourt()[0]).toHaveTextContent('#11')
    expect(screen.queryByText('Your case')).not.toBeInTheDocument()
    unmount()

    // The party (any case of address) sees its case first, marked.
    wallet.account = PARTY.toUpperCase().replace('0X', '0x')
    board({ live })
    const rows = inCourt()
    expect(rows[0]).toHaveTextContent('#12')
    expect(rows[0]).toHaveTextContent('Your case')
    expect(rows[1]).not.toHaveTextContent('Your case')
  })

  it('gives the PNK rewards paid under the rows, and asks other lists to ask', () => {
    board({
      rewards: {
        total: (13_681_495n * XDAI).toString(),
        curators: 101,
        from: '2022-04',
        through: '2026-10',
        chainIds: [100],
      },
    })
    const submissions = screen.getByRole('region', {
      name: 'Recent submissions',
    })
    const paid = within(submissions).getByRole('link', {
      name: /13\.7M PNK paid in rewards to 101 curators/,
    })
    expect(paid).toHaveAttribute('href', 'https://rewards.kleros.io/curate')
    expect(paid).toHaveAttribute('target', '_blank')
    expect(
      within(submissions).getByRole('link', {
        name: /Rewards on your list\? Ask Kleros/,
      }),
    ).toHaveAttribute('href', 'https://t.me/KlerosCurate')
  })

  it('titles its section and counts what is open in the Submissions head', () => {
    board()
    const section = screen.getByRole('region', {
      name: 'Open for verification',
    })
    expect(
      within(section).getByRole('heading', { level: 2 }),
    ).toHaveTextContent('Open for verification')
    const submissions = within(section).getByRole('region', {
      name: 'Recent submissions',
    })
    expect(
      within(submissions).getByRole('img', {
        name: '7 requests open now, in their challenge window',
      }),
    ).toBeInTheDocument()
    expect(submissions).toHaveTextContent('Open now')
    expect(submissions).toHaveTextContent('$210')
    expect(submissions).toHaveTextContent('Up for grabs')
  })

  it('filters the rows by list, and leads to the list for the rest', async () => {
    const user = userEvent.setup()
    board()
    const submissions = screen.getByRole('region', {
      name: 'Recent submissions',
    })
    const chips = within(submissions).getByRole('group', {
      name: "Show one list's requests",
    })
    const all = within(chips).getByRole('button', { name: 'All 7' })
    expect(all).toHaveAttribute('aria-pressed', 'true')
    expect(rowLinks(submissions)).toHaveLength(3)

    const tags = within(chips).getByRole('button', { name: /Address Tags 5/ })
    await user.click(tags)
    expect(tags).toHaveAttribute('aria-pressed', 'true')
    expect(all).toHaveAttribute('aria-pressed', 'false')
    const links = rowLinks(submissions)
    expect(links).toHaveLength(2)
    for (const href of links) expect(href).toContain(TAGS)
    expect(
      within(submissions).getByRole('link', { name: /^All 5 in Address Tags/ }),
    ).toHaveAttribute('href', LISTS[0].href)

    await user.click(all)
    expect(rowLinks(submissions)).toHaveLength(3)
  })

  it('says so when none of a list’s rows are among those loaded', async () => {
    const user = userEvent.setup()
    board({ openLists: [...LISTS, list(WALLETS, 'Wallets', 4)] })
    const submissions = screen.getByRole('region', {
      name: 'Recent submissions',
    })
    await user.click(
      within(submissions).getByRole('button', { name: /Wallets 4/ }),
    )
    expect(rowLinks(submissions)).toHaveLength(0)
    expect(submissions).toHaveTextContent(
      'Its requests close later than the ones loaded here',
    )
    expect(
      within(submissions).getByRole('link', { name: /^All 4 in Wallets/ }),
    ).toBeInTheDocument()
  })

  it('always leads a chosen list on to its own page', async () => {
    const user = userEvent.setup()
    board({
      openLists: [
        list(TAGS, 'Address Tags', 2),
        list(TOKENS, 'Kleros Tokens', 1),
      ],
    })
    const submissions = screen.getByRole('region', {
      name: 'Recent submissions',
    })
    await user.click(
      within(submissions).getByRole('button', { name: /Kleros Tokens 1/ }),
    )
    // Its one request is drawn, and its page is still a click away.
    expect(rowLinks(submissions)).toHaveLength(1)
    expect(
      within(submissions).getByRole('link', {
        name: /^All 1 in Kleros Tokens/,
      }),
    ).toHaveAttribute('href', list(TOKENS, 'Kleros Tokens', 1).href)
  })

  it('drops a choice its chips no longer offer', async () => {
    const user = userEvent.setup()
    const { rerender } = board()
    const submissions = () =>
      screen.getByRole('region', { name: 'Recent submissions' })
    await user.click(
      within(submissions()).getByRole('button', { name: /Kleros Tokens 2/ }),
    )
    expect(rowLinks(submissions())).toHaveLength(1)
    // Kleros Tokens' last request closes: one list is left, and no chips.
    const tagsOnly = OPEN.filter((card) => card.registryAddress === TAGS)
    rerender(
      <LiveBoard
        open={tagsOnly}
        openLists={[list(TAGS, 'Address Tags', 5)]}
        live={[]}
        rulings={RULINGS}
        figures={{ ...FIGURES, inWindow: 5, unchallenged: 5 }}
        prices={PRICES}
        pricesSettled
        checking={false}
        now={NOW}
      />,
    )
    expect(
      screen.queryByRole('group', { name: "Show one list's requests" }),
    ).not.toBeInTheDocument()
    expect(rowLinks(submissions())).toHaveLength(2)
  })

  it('draws no chips when one list holds every request', () => {
    board({ openLists: [list(TAGS, 'Address Tags', 7)] })
    expect(
      screen.queryByRole('group', { name: "Show one list's requests" }),
    ).not.toBeInTheDocument()
  })

  it('has no heading and no Submissions column when nothing is open', () => {
    board({
      open: [],
      openLists: [],
      figures: {
        ...FIGURES,
        inWindow: 0,
        unchallenged: 0,
        inWindowDeposits: {},
      },
    })
    expect(
      screen.queryByRole('heading', { name: 'Open for verification' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Recent submissions' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Disputes' })).toBeInTheDocument()
  })

  it('reads its windows again without claiming any, and says so', () => {
    board({ checking: true, figures: { ...FIGURES, windowsKnown: false } })
    expect(screen.getByRole('status')).toHaveTextContent(
      'Checking challenge periods…',
    )
    const submissions = screen.getByRole('region', {
      name: 'Recent submissions',
    })
    expect(submissions).toHaveTextContent('Unchallenged')
    expect(submissions).not.toHaveTextContent('Up for grabs')
  })
})
