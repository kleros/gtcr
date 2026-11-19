import React from 'react'
import styled, { css } from 'styled-components'
import { Link } from 'react-router-dom'
import {
  ChainChip,
  Rail,
  Small,
  VisuallyHidden,
} from 'components/curate/primitives'
import { CurateIcon } from 'components/curate/icons'
import { VerifiedBadge } from 'components/curate/verified-badge'
import { formatEther } from 'components/curate/item-standard-format'
import { getNativeCurrency } from 'config/chains'
import { parseRichAddress } from 'utils/rich-address'
import {
  formatAbsolute,
  formatAgo,
  formatTimeLeft,
  windowProgress,
} from 'utils/time'
import { formatUnits, type DashboardCard } from './view'
import { Avatar as ListLogo } from 'pages/browse/avatar'

/*
 * The row kit the dashboard's live board shares across its two columns: the
 * open requests in their challenge window on one side, the disputes and the
 * rulings on the other (both in happening-now.tsx). It lives in one place so
 * the columns cannot drift apart when either is recomposed. Its figure
 * helpers and the figures interface are read wider than the rows are: the
 * figures strip above the board (open-for-verification.tsx) and the
 * verification record (bounties.tsx) take their amounts from here too, so
 * every figure on the page is grouped and rounded the same way. Those two
 * are the only figures that carry dollars, and the dollars-first figure they
 * share is built here for the same reason: one rule for both places, so they
 * cannot drift, and none for any other figure on the page.
 */

const integer = new Intl.NumberFormat('en-US')
export const formatInt = (value: number) => integer.format(value)

/** "3,870" and "xDAI" apart, for a figure that leads with the amount. */
export const coinParts = (
  wei: bigint | string,
  chainId: number,
): { amount: string; symbol: string } => {
  const [whole, fraction] = formatEther(wei.toString()).split('.')
  return {
    amount: `${integer.format(BigInt(whole))}${fraction ? `.${fraction}` : ''}`,
    symbol: getNativeCurrency(chainId).symbol,
  }
}

/** "3,870 xDAI", "0.00005 ETH": full precision, grouped. */
export const formatCoin = (wei: bigint | string, chainId: number): string => {
  const { amount, symbol } = coinParts(wei, chainId)
  return `${amount} ${symbol}`
}

const usdWhole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const usdCents = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * A coin amount in dollars, from a price per whole coin (prices.ts). The
 * amount goes through the page's own unit conversion, so the dollar figure is
 * built from the same number the coin figure beside it shows.
 */
export const usdOf = (
  amount: bigint,
  decimals: number,
  usdPerCoin: number,
): number =>
  Number(formatUnits(amount, decimals, 6).replace(/,/g, '')) * usdPerCoin

/**
 * "$4,709", "$12.34": cents below a hundred dollars, none above it, where a
 * cent is noise beside a four-figure sum. Nothing at all under half a cent:
 * a dollar figure that would print "$0.00" says less than the coin amount it
 * stands for, so the coin leads instead.
 */
export const formatUsd = (value: number): string | undefined => {
  if (!Number.isFinite(value) || value < 0.005) return undefined
  return `$${value >= 100 ? usdWhole.format(value) : usdCents.format(value)}`
}

/**
 * The format a dollar count-up uses on its way to `final`: whole dollars or
 * cents by the figure it ends on, not by where it is, so the digits do not
 * change shape mid-count, and never empty (formatUsd is, under half a cent,
 * which every count-up passes through at its start).
 */
export const usdFormatFor =
  (final: number) =>
  (value: number): string =>
    `$${final >= 100 ? usdWhole.format(value) : usdCents.format(value)}`

/*
 * Dollars first (round 5: "put the dollars first, smaller the crypto"). Where
 * a feed on the coin's own chain answers, the dollars are the figure, at the
 * size of the place they lead, and the exact coin amount sits under them in
 * CoinAmount. The approximation sign stays on the figure, smaller and muted,
 * so the dollars are never read as exact; the word is there for a screen
 * reader, and a capped count's "+" rides on the dollars too, since a lower
 * bound in coins is a lower bound in dollars. Where no price can be read the
 * coin amount is the figure, exactly as before dollars existed, and nothing
 * dollar-shaped is drawn. The parent sets the lead's size; this only shapes
 * the sign.
 */
const UsdShape = styled.span`
  display: inline-flex;
  align-items: baseline;
  white-space: nowrap;

  > [data-approx] {
    align-self: center;
    margin-right: 0.12em;
    color: var(--color-muted);
    font-size: 0.6em;
    font-weight: 400;
    letter-spacing: 0;
  }
`

export const UsdLead = ({
  value,
  bound,
}: {
  /** The dollars, formatted or counting up (AnimatedNumber with usdFormatFor). */
  value: React.ReactNode
  /** "+" when the amount it converts is itself a lower bound. */
  bound?: string
}) => (
  <UsdShape>
    <VisuallyHidden>about </VisuallyHidden>
    <span data-approx="" aria-hidden="true">
      ≈
    </span>
    {value}
    {bound}
  </UsdShape>
)

/**
 * The exact coin amount under a dollar lead: full precision, at body size and
 * muted, so it reads as the measurement the dollars were made from rather
 * than as a second headline. `small` carries the symbol.
 */
export const CoinAmount = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  min-width: 0;
  color: var(--color-muted);
  font-family: var(--font-figure);
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  small {
    color: var(--color-muted);
    font-size: 13px;
    font-weight: 400;
  }
`

const shortKey = (value: string) =>
  value.length > 14 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value

/**
 * CAIP-10 values read as "0x94bA…8a2f" on "Robinhood Chain"; a bare hex key
 * is shortened like an address; anything else passes through.
 *
 * A long hex key cut upstream (a saved load painted from before data.ts
 * stopped cutting them, ending "…48e4ce3270...") shows its head alone: its
 * real tail was lost, and a tail taken from the cut would be a value the
 * entry never had.
 */
export const readableIdentifier = (
  value: string,
): { text: string; network?: string } => {
  const rich = parseRichAddress(value)
  if (rich)
    return { text: shortKey(rich.address), network: rich.reference.name }
  const cut = value.match(/^((?:0x)?[0-9a-f]{32,})(?:\.\.\.|…)$/i)
  if (cut) return { text: `${cut[1].slice(0, 6)}…` }
  return { text: /^(0x)?[0-9a-f]{32,}$/i.test(value) ? shortKey(value) : value }
}

export const rowBase = css`
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  column-gap: 12px;
  row-gap: 4px;
  align-items: center;
  padding: 12px 14px;
  border-radius: var(--radius);
  background: var(--color-raised);
  color: inherit;
  text-decoration: none;
  transition:
    background var(--motion),
    box-shadow var(--motion),
    transform var(--motion);

  &:hover {
    background: color-mix(in srgb, var(--color-raised), var(--color-text) 5%);
    box-shadow: inset 0 0 0 1px var(--glass-border);
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    &:hover {
      transform: none;
    }
  }
`

export const Row = styled(Link)`
  ${rowBase}
`

const AvatarShape = styled.span<{ $small?: boolean }>`
  display: inline-flex;
  grid-row: ${({ $small }) => ($small ? 'auto' : 'span 3')};
  align-self: ${({ $small }) => ($small ? 'center' : 'start')};
  border-radius: 999px;
  box-shadow: 0 0 0 3px var(--color-surface);
`

/** The list's logo, or the registry glyph when it has none. */
export const Avatar = ({
  logo,
  seed,
  small,
}: {
  logo?: string | null
  seed: string
  small?: boolean
}) => (
  <AvatarShape $small={small} aria-hidden>
    <ListLogo
      uri={logo}
      seed={seed}
      size={small ? 28 : 36}
      radius={small ? 14 : 18}
    />
  </AvatarShape>
)

export const RowTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
`

const RegistryText = styled.span`
  min-width: 0;
  overflow: hidden;
  color: var(--color-text);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const RegistryLine = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
`

/** The list's name, with the Kleros Verified seal when it carries one. */
export const Registry = ({
  card,
  quiet,
}: {
  card: DashboardCard
  quiet?: boolean
}) => (
  <RegistryLine>
    <RegistryText
      title={card.registry}
      style={quiet ? { fontWeight: 500 } : undefined}
    >
      {card.registry}
    </RegistryText>
    {card.verified && <VerifiedBadge size={14} />}
  </RegistryLine>
)

const IdValue = styled.span`
  display: block;
  min-width: 0;
  overflow: hidden;
  color: var(--color-muted);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;

  /* A network name goes whole to the next line rather than being cut. */
  &[data-networks] {
    white-space: normal;

    > span {
      margin-inline-end: 8px;
      white-space: nowrap;
    }

    /* Muted, not faint: at 12px faint falls under 4.5:1 on the cards. */
    > [data-network] {
      display: inline-block;
      color: var(--color-muted);
      font-family: var(--font-sans);
    }
  }
`

/* The identifier, and the bounty on the right. */
const IdLine = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
`

/* The submitter's deposit: what a winning challenger takes. */
const Bounty = styled.span`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 5px;
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  svg {
    color: var(--status-window);
  }
`

/*
 * Request kind · what is left of the window · time left to challenge.
 *
 * The rail draws the time REMAINING, not the time used, so it starts full
 * and is eaten from its right-hand end as the deadline comes: a window with
 * minutes left reads as nearly empty rather than nearly full. The entry
 * status track (components/curate/entry-status.tsx) reads the same way, and
 * these two are the only places the app draws a challenge window as a bar.
 */
const WindowLine = styled.div`
  display: grid;
  grid-template-columns: auto minmax(32px, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-width: 0;
  margin-top: 2px;

  > :last-child {
    color: var(--color-text);
    font-family: var(--font-figure);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
`

export const Meta = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 2px 12px;
  min-width: 0;

  > * {
    white-space: nowrap;
  }
`

/*
 * The window rail sits on a raised row: give its track some contrast. The
 * rows are sorted closing soonest first, so most rails keep a few percent of
 * their track, and a bare sliver that thin read as an empty groove rather
 * than a live bar. So the end of what is left carries a lit bead, the ring
 * gauges' head in miniature: even a 3% window reads as a light on its track.
 * The bead overhangs the 6px track, so the track stops clipping (the fill is
 * rounded on its own and needs no clip). Unclipped, the fill's own glow
 * would spill onto the row's words above and below, so the fill drops it
 * and the bead alone carries the light. A window that has closed while the
 * page is open (the next refresh drops its row) has no bead: nothing live
 * is left to light.
 */
const WindowRail = styled(Rail)`
  overflow: visible;
  background: color-mix(in srgb, var(--color-text) 9%, transparent);

  &::after {
    box-shadow: none;
  }

  &::before {
    display: ${({ $value }) => ($value > 0 ? 'block' : 'none')};
    content: '';
    position: absolute;
    z-index: 1;
    top: 50%;
    left: clamp(
      4px,
      ${({ $value }) => Math.round(Math.min(1, Math.max(0, $value)) * 100)}%,
      calc(100% - 4px)
    );
    width: 8px;
    height: 8px;
    margin: -4px 0 0 -4px;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      color-mix(in srgb, var(--status-window), #fff 70%) 0 30%,
      var(--status-window) 75%
    );
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--status-window) 22%, transparent),
      0 0 10px 1px color-mix(in srgb, var(--status-window) 70%, transparent);
    transition: left 400ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  @media (prefers-reduced-motion: reduce) {
    &::before,
    &::after {
      transition: none;
    }
  }
`

export const Empty = styled.div`
  padding: 20px 8px;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  text-align: center;
`

export const moreStyles = css`
  align-self: flex-start;
  padding: 4px 0;
  border: 0;
  background: none;
  color: var(--color-primary);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
    border-radius: 4px;
  }
`

export const More = styled.button`
  ${moreStyles}
`

/**
 * The row's first identifier. When another row shown from the same list has
 * the same first one, the second leads, so the rows differ even when cut.
 */
export const Identifier = ({
  card,
  withSecond,
}: {
  card: DashboardCard
  withSecond?: boolean
}) => {
  const [first, second] = card.identifiers
  if (!first) return <span />
  const parts = (withSecond && second ? [second, first] : [first]).map(
    (identifier) => readableIdentifier(identifier.value),
  )
  const networks = parts.some((part) => part.network)
  return (
    <IdValue
      data-networks={networks ? '' : undefined}
      title={card.identifiers
        .map((identifier) => `${identifier.label}: ${identifier.value}`)
        .join('\n')}
    >
      {networks
        ? parts.map((part, index) => (
            <React.Fragment key={index}>
              <span>{part.text}</span>
              {part.network && <span data-network>{part.network}</span>}
            </React.Fragment>
          ))
        : parts.map((part) => part.text).join(' · ')}
    </IdValue>
  )
}

/** Keys of shown rows whose list and first identifier repeat. */
export const repeatedIds = (cards: DashboardCard[]): Set<string> => {
  const seen = new Map<string, number>()
  const key = (card: DashboardCard) =>
    `${card.chainId}:${card.registryAddress}:${card.identifiers[0]?.value ?? ''}`
  for (const card of cards) seen.set(key(card), (seen.get(key(card)) ?? 0) + 1)
  return new Set(
    cards.filter((card) => (seen.get(key(card)) ?? 0) > 1).map((c) => c.id),
  )
}

export const OpenRow = ({
  card,
  now,
  withSecond,
}: {
  card: DashboardCard
  now: number
  withSecond: boolean
}) => {
  const { windowStart, windowEnd } = card
  const removal = card.request === 'removal'
  return (
    <Row to={card.href} title={card.actor ? `by ${card.actor}` : undefined}>
      <Avatar logo={card.logo} seed={card.registryAddress} />
      <RowTop>
        <Registry card={card} />
        <ChainChip chainId={card.chainId} size="sm" />
      </RowTop>
      <IdLine>
        <Identifier card={card} withSecond={withSecond} />
        {card.deposit !== undefined && (
          <Bounty title="The bounty: the collateral a successful challenger earns, on top of their own deposit back">
            <CurateIcon name="bounty" size={14} />
            {formatCoin(card.deposit, card.chainId)}
            <VisuallyHidden> bounty</VisuallyHidden>
          </Bounty>
        )}
      </IdLine>
      {windowStart !== undefined && windowEnd !== undefined ? (
        <WindowLine
          title={`${removal ? 'Removal requested' : 'Submitted'} ${formatAgo(windowStart, now)} · challenge period closes ${formatAbsolute(windowEnd)}`}
        >
          <Small $muted>{removal ? 'Removal' : 'Submission'}</Small>
          <WindowRail
            $value={1 - windowProgress(windowStart, windowEnd, now)}
            role="presentation"
          />
          <Small>{formatTimeLeft(windowEnd, now)}</Small>
        </WindowLine>
      ) : (
        <Meta>
          <Small $muted>
            {removal ? 'Removal' : 'Submission'} · {card.when}
          </Small>
        </Meta>
      )}
    </Row>
  )
}

/** The figures both boards read, in the page's chain scope. */
export interface HappeningFigures {
  /** Requests nobody challenged, still inside their window. */
  inWindow: number
  /** Requests nobody challenged, past their window (waiting to be executed). */
  pastWindow: number
  /** The in-window requests' deposits per chain, in wei. */
  inWindowDeposits: Record<number, bigint>
  /** False when some windows could not be read: no window claims then. */
  windowsKnown: boolean
  /** Every unresolved request with no challenge. */
  unchallenged: number
  /** The open-request read hit its cap: counts are lower bounds. */
  unchallengedCapped: boolean
  /** Disputes open right now (the hero's "In court now"). */
  inCourt: number
  /** The open-dispute read hit its limit: "In court" is a lower bound. */
  inCourtCapped: boolean
}

/** A list holding open requests, as its chip shows it. */
export interface OpenListChip {
  key: string
  title: string
  logo?: string | null
  count: number
  href: string
}
