import React, { useMemo, useRef } from 'react'
import styled, { css, keyframes } from 'styled-components'
import { useQuery } from '@tanstack/react-query'
import useNow from 'hooks/use-now'
import {
  ButtonLink,
  Label,
  Small,
  StatusDot,
  Surface,
} from 'components/curate/primitives'
import { AnimatedNumber } from 'components/curate/motion/animated-number'
import {
  MAINNET_CHAIN_IDS,
  chainInfo,
  scopedFigures,
} from 'pages/dashboard/view'
import type { DashboardData } from 'pages/dashboard/types'
import { useInView } from './hooks'

/*
 * The one live figure in the guide: how many requests are open for
 * verification right now, the dashboard's own count. It reads the
 * dashboard's query (same key, so a visit to either page fills the other)
 * and only once the strip scrolls into view. The count is Light and Classic
 * requests nobody has challenged whose challenge period is still running,
 * on every mainnet ("All chains"). If any chain or any challenge period
 * failed to load, it shows no number rather than a partial one.
 */

const loadDashboard = (): Promise<DashboardData> =>
  import('pages/dashboard/data').then((module) => module.fetchDashboardData())

const integer = new Intl.NumberFormat('en-US')

const SCOPE = new Intl.ListFormat('en', {
  style: 'long',
  type: 'conjunction',
}).format(
  MAINNET_CHAIN_IDS.map((chainId) => chainInfo(chainId)?.name ?? `${chainId}`),
)

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--status-window) 55%, transparent); }
  70% { box-shadow: 0 0 0 7px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
`

const Strip = styled(Surface)`
  display: grid;
  grid-template-columns: minmax(3.2ch, auto) minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px 28px;
  max-width: 900px;
  padding: 20px 24px;
  overflow: hidden;

  /* A soft pool of the window colour behind the figure. */
  &::before {
    content: '';
    position: absolute;
    top: -60%;
    bottom: -60%;
    left: -80px;
    width: 300px;
    background: radial-gradient(
      closest-side,
      color-mix(in srgb, var(--status-window) 16%, transparent),
      transparent
    );
    pointer-events: none;
  }

  > * {
    position: relative;
  }

  @media (max-width: 720px) {
    grid-template-columns: minmax(2.4ch, auto) minmax(0, 1fr);
    gap: 14px 18px;
    padding: 18px 16px;

    > a {
      grid-column: 1 / -1;
      justify-self: start;
    }
  }
`

const Count = styled.span`
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: 48px;
  line-height: 1;
  font-weight: 500;
  letter-spacing: -0.035em;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 28px
    color-mix(in srgb, var(--status-window) 38%, transparent);

  @media (max-width: 720px) {
    font-size: 40px;
  }
`

const Words = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
`

const Head = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 10px;
`

const LiveDot = styled(StatusDot)<{ $live: boolean }>`
  ${({ $live }) =>
    $live &&
    css`
      animation: ${pulse} 2.4s ease-out infinite;
    `}

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

export const OpenNow = () => {
  const ref = useRef<HTMLDivElement>(null)
  const seen = useInView(ref, 0.2)
  const now = useNow(30_000)
  const query = useQuery({
    queryKey: ['curateDashboard'],
    queryFn: loadDashboard,
    staleTime: 60_000,
    enabled: seen,
  })
  const data = query.data

  const figure = useMemo(() => {
    if (!data) return undefined
    const partial = data.failedChains.some((chainId) =>
      MAINNET_CHAIN_IDS.includes(chainId),
    )
    const figures = scopedFigures(data, MAINNET_CHAIN_IDS, now)
    if (partial || !figures.windowsKnown) return null
    return { count: figures.inWindow, capped: figures.unchallengedCapped }
  }, [data, now])

  const loading = figure === undefined && !query.isError
  const unavailable = figure === null || (figure === undefined && query.isError)

  return (
    <Strip
      ref={ref}
      $padding="none"
      role="group"
      aria-labelledby="open-now-label"
      aria-busy={loading}
    >
      <Count>
        {figure ? (
          <AnimatedNumber
            value={figure.count}
            format={(value) =>
              `${integer.format(Math.round(value))}${figure.capped ? '+' : ''}`
            }
          />
        ) : (
          <span aria-hidden>—</span>
        )}
      </Count>
      <Words>
        <Head>
          <LiveDot $tone="window" $live={!!figure} aria-hidden />
          <Label $tone="text" id="open-now-label">
            Open for verification now
          </Label>
        </Head>
        <Small $muted>
          {unavailable
            ? 'The count did not load; the dashboard lists them.'
            : 'Requests nobody has challenged, still in their challenge period.'}
        </Small>
        <Small $faint>Light and Classic · {SCOPE}</Small>
      </Words>
      <ButtonLink to="/" $variant="secondary" $size="sm">
        Open the dashboard
      </ButtonLink>
    </Strip>
  )
}

export default OpenNow
