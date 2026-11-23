import React from 'react'
import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from 'test/render'
import type { ChartRange } from 'pages/dashboard/view'
import { emptyStats, type AddressStats, type ProfileActivity } from './data'
import { jurorBadge, type Scope } from './view'
import { ProfilePanel } from './profile'

// The wagmi config reads window.location when it loads; the panel signs
// nothing.
vi.mock('config/wagmi', () => ({ wagmiConfig: {} }))

const ETHEREUM = 1
const GNOSIS = 100
const ME = '0x03f28fd8e91e5c821cc7aa4da3fed7c4de0102aa'
const LIST = '0x00000000000000000000000000000000000000aa'
const at = (iso: string) => Date.parse(iso) / 1000
// Monday 23 Nov 2026, 12:30 UTC.
const NOW = at('2026-11-23T12:30:00Z')

/** `count` submissions spread evenly from `from` to `to`, newest first. */
const actions = (from: number, to: number, count = 120): ProfileActivity[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `standard-${index}`,
    chainId: GNOSIS,
    registryAddress: LIST,
    registryTitle: 'Tokens',
    kind: 'submission',
    status: 'Submitted',
    timestamp: to - Math.round(((to - from) * index) / (count - 1)),
    href: `/tcr/${GNOSIS}/${LIST}/0x${index}`,
  }))

const busyStats = (): AddressStats => ({
  ...emptyStats(),
  submissions: 304,
  removals: 98,
  activity: 402,
})

const renderPanel = ({
  activities,
  range = '3y',
  scope = 'all',
  stats = busyStats(),
}: {
  activities: ProfileActivity[]
  range?: ChartRange
  scope?: Scope
  stats?: AddressStats
}) =>
  renderWithProviders(
    <ProfilePanel
      address={ME}
      isYou={false}
      isZero={false}
      loading={false}
      error={false}
      failed={[]}
      onRetry={() => {}}
      generatedAt={NOW * 1000}
      scope={scope}
      onScope={() => {}}
      chains={[
        { chainId: GNOSIS, stats: busyStats() },
        { chainId: ETHEREUM, stats: { ...emptyStats(), activity: 12 } },
      ]}
      stats={stats}
      governedCount={0}
      governedError={false}
      governedPartial={false}
      activities={activities}
      // The list is cut at 120: only the most recent actions are listed.
      complete={false}
      listed={120}
      capped={[]}
      roles={['Curator']}
      juror={jurorBadge(undefined, scope, false)}
      badges={[]}
      range={range}
      onRange={() => {}}
      now={NOW}
    />,
  )

const rangeSwitch = () =>
  screen.getByRole('radiogroup', { name: 'Chart range' })

describe('the profile chart of a busy curator (120 actions read)', () => {
  it('draws the latest 120 by week on 3Y when they all fall in this month', () => {
    // 0x03f2…02aa as read on 23 Nov 2026: 120 actions from 9 Nov on.
    renderPanel({
      activities: actions(
        at('2026-11-09T02:21:40Z'),
        at('2026-11-23T10:37:25Z'),
      ),
    })
    expect(
      screen.queryByText('No dated action in this scope.'),
    ).not.toBeInTheDocument()
    expect(
      within(rangeSwitch()).getByRole('radio', { name: '3Y' }),
    ).toHaveAttribute('aria-checked', 'true')
    // The head names the weeks it draws, never "last 3 years".
    expect(screen.getByText('Per week · 16 Nov – 23 Nov 2026')).toBeVisible()
    expect(
      screen.getByRole('img', {
        name: /per week from 16 Nov 2026: .* from the 120 most recent actions$/,
      }),
    ).toBeInTheDocument()
  })

  it('keeps the range switch and says why when every action is from the last hour', () => {
    renderPanel({
      activities: actions(
        at('2026-11-23T12:04:00Z'),
        at('2026-11-23T12:29:00Z'),
      ),
    })
    expect(
      screen.getByText(
        'Every listed action is from the last hour: too short a span to chart.',
      ),
    ).toBeVisible()
    expect(rangeSwitch()).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /^Submissions/ })).toBeNull()
    expect(
      screen.queryByText(/holds only the listed actions/),
    ).not.toBeInTheDocument()
  })

  it('draws a burst before a quiet spell rather than call the range empty', () => {
    renderPanel({
      activities: actions(
        at('2026-11-18T10:00:00Z'),
        at('2026-11-18T10:59:00Z'),
      ),
      range: '30d',
    })
    expect(
      screen.queryByText(/No submission, removal or challenge in the/),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Per day · 18 Nov – 23 Nov 2026')).toBeVisible()
    expect(
      screen.getByText(/The first day holds only the listed actions\./),
    ).toBeVisible()
  })

  it('names the cut when none of the listed actions is on the chosen chain', () => {
    renderPanel({
      activities: [],
      scope: ETHEREUM,
      stats: { ...emptyStats(), submissions: 12, activity: 12 },
    })
    expect(
      screen.getByText('None of the 120 most recent actions is on Ethereum.'),
    ).toBeVisible()
    expect(
      screen.queryByText('No dated action in this scope.'),
    ).not.toBeInTheDocument()
  })
})
