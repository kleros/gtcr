import React from 'react'
import styled from 'styled-components'
import ReactBlockies from 'react-blockies'
import { NETWORKS, NETWORKS_INFO } from 'config/networks'
import { getAddressPage } from 'utils/network-utils'
import { formatAgo, formatDate } from 'utils/time'
import ChainLogo from 'components/chain-logo'
import Tooltip from 'components/ui/Tooltip'
import { CurateIcon } from 'components/curate/icons'
import { CopyValue } from 'components/curate/chrome-address'
import {
  Button,
  ChainChip,
  Chip,
  Label,
  SegmentedControl,
  SkeletonBlock,
  StatusDot,
  Surface,
  truncateMiddle,
  type StatusTone,
} from 'components/curate/primitives'
import { AnimatedNumber } from 'components/curate/motion/animated-number'
import { Odometer } from 'components/curate/motion/odometer'
import { reveal } from 'components/curate/motion/reveal'
import {
  PERMANENT_PROFILE_LIMIT,
  PROFILE_LIMIT,
  SUPPORTED_CHAIN_IDS,
  chainName,
  type AddressStats,
  type ProfileActivity,
} from './data'
import {
  activityBuckets,
  chainNames,
  challengeRecord,
  coverage,
  formatInt,
  jurorTip,
  type ChainActivity,
  type JurorBadgeView,
  type Scope,
} from './view'
import { QuietState, When } from './parts'
import { ActivityChart } from './activity-chart'
import { ChallengeRing } from './challenge-ring'

/*
 * The profile panel, the page's one featured surface: who the address is
 * (its roles, identicon, the address in mono with its copy and explorer
 * controls, "this is you"), the entries it submitted as the headline figure
 * with its other counts inline, its requests and challenges over time, and
 * its challenge record as a ring when it has challenged anything. An
 * address with no action in the scope leads with what it does have, its
 * juror record and the lists it governs, over one muted line that says it
 * has no action; with none of those either, that line is all. Every figure
 * describes the chosen scope.
 */

/* ---------- Identity ---------- */

const Featured = styled(Surface)`
  padding: 28px 28px 20px;
  ${reveal}

  @media (max-width: 720px) {
    padding: 20px 16px 16px;
  }
`

const IdentityBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 20px 32px;
  padding-bottom: 24px;
  margin-bottom: 28px;
  border-bottom: 1px solid var(--glass-border);
`

const Identity = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  min-width: 0;

  @media (max-width: 720px) {
    align-items: flex-start;
    gap: 14px;
  }
`

/** Identicon in a ring of the aurora hues, with a soft glow of the accent. */
const Avatar = styled.span`
  position: relative;
  flex: 0 0 auto;
  width: 68px;
  height: 68px;
  padding: 2px;
  border-radius: var(--radius-pill);
  background: conic-gradient(
    from 210deg,
    var(--aurora-b),
    var(--color-primary),
    var(--aurora-c),
    color-mix(in srgb, var(--color-warning) 70%, var(--aurora-a)),
    var(--aurora-b)
  );
  box-shadow:
    0 0 0 6px color-mix(in srgb, var(--color-primary) 8%, transparent),
    0 10px 36px -8px color-mix(in srgb, var(--color-primary) 70%, transparent);

  span {
    display: block;
    width: 100%;
    height: 100%;
    overflow: hidden;
    border: 3px solid var(--color-surface);
    border-radius: inherit;
    background: var(--color-raised);
  }

  canvas {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }

  @media (max-width: 720px) {
    width: 52px;
    height: 52px;
  }
`

const IdentityText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
`

/* As tall as its label line, so the skeleton that stands in while the
   roles are read swaps for them without moving the address. */
const Eyebrow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 16px;
`

/* The address and its controls on one line; on a phone the controls wrap
   under the short address when the line is full. */
const AddressLine = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  min-width: 0;
`

const AddressTitle = styled.h1`
  min-width: 0;
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: clamp(15px, 0.7vw + 10px, 21px);
  line-height: 1.25;
  font-weight: 500;
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;

  .short {
    display: none;
  }

  @media (max-width: 720px) {
    .full {
      display: none;
    }

    .short {
      display: inline;
    }
  }
`

const IdentityMeta = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 8px;
  color: var(--color-faint);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

/*
 * One cluster of equal round controls after the address: copy (a 28px glass
 * circle) and one mark per chain the address acted on, each opening that
 * chain's explorer. A mark is the chain's own plate at the same 28px
 * (components/chain-logo.tsx), never a named pill: the explorer and the chain
 * are in its tooltip. A small arrow badge says it leaves the app; it shows on
 * hover or focus, and always on touch screens. Sepolia carries the Ethereum
 * mark, so its plate gets a dashed ring as well.
 */
const AddressTools = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
`

const ExplorerMark = styled.a`
  position: relative;
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  border-radius: var(--radius-pill);
  color: var(--color-text);
  text-decoration: none;
  transition:
    box-shadow var(--motion),
    transform 240ms var(--ease-out);

  &[data-testnet]::before {
    content: '';
    position: absolute;
    inset: -3px;
    border: 1px dashed var(--color-border-strong);
    border-radius: inherit;
    pointer-events: none;
  }

  > svg {
    position: absolute;
    top: -3px;
    right: -3px;
    width: 13px;
    height: 13px;
    padding: 2px;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-pill);
    background: var(--color-surface);
    opacity: 0;
    transform: scale(0.6);
    transition:
      opacity var(--motion),
      transform 240ms var(--ease-out);
  }

  &:hover,
  &:focus-visible {
    box-shadow: 0 0 0 1px var(--color-border-strong);
    transform: translateY(-1px);
  }

  &:hover > svg,
  &:focus-visible > svg {
    opacity: 1;
    transform: none;
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  @media (hover: none) {
    > svg {
      opacity: 1;
      transform: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    &:hover,
    &:focus-visible {
      transform: none;
    }
  }
`

/** Stands in for the explorer marks until the chains are known. */
const MarkSkeleton = styled(SkeletonBlock)`
  width: 28px;
  min-height: 28px;
  border-radius: var(--radius-pill);
`

/** Stands in for the scope control until the chains are known. */
const PillSkeleton = styled(SkeletonBlock)`
  width: 104px;
  min-height: 28px;
  border-radius: var(--radius-pill);
`

const ScopeSide = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  min-width: 0;
  max-width: 100%;

  @media (max-width: 720px) {
    align-items: flex-start;
  }
`

/* ---------- Figures ---------- */

const FiguresRow = styled.div`
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 24px 48px;
`

const HeadlineFigure = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`

const Big = styled.span`
  display: inline-flex;
  align-items: flex-start;
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: clamp(48px, 3.2vw + 22px, 76px);
  /* The odometer rolls in 1em columns: the settled figure keeps that
     height, so the hero does not shrink when the roll ends. */
  line-height: 1;
  font-weight: 500;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
`

const InlineStats = styled.dl`
  display: flex;
  flex-wrap: wrap;
  gap: 16px 40px;
  margin: 0;
  padding-bottom: 6px;

  div {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  dd {
    margin: 0;
    color: var(--color-text);
    font-family: var(--font-figure);
    font-size: 20px;
    line-height: 24px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 720px) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
  }
`

/** "+" after a figure that is a lower bound (the read stopped early). */
const Plus = styled.span`
  margin-left: 0.04em;
  color: var(--color-faint);
  font-size: 0.5em;
  line-height: 1.1;
`

/** A figure that could not be read: said in words, never shown as 0. */
const Unavailable = styled.span`
  color: var(--color-muted);
  font-family: var(--font-sans);
  font-size: var(--fs-small);
  line-height: 24px;
  font-weight: 400;
`

/** Read by screen readers, not shown. */
const Hidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
`

/** The lower-bound marker: "+" on screen, "or more" for screen readers. */
const OrMore = () => (
  <>
    <Plus aria-hidden>+</Plus>
    <Hidden> or more</Hidden>
  </>
)

/* A headline label with its explanation behind a "?" (the juror record). */
const TipLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  border-radius: 4px;

  svg {
    color: var(--color-faint);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 3px;
  }
`

/** No action in the scope: one muted line, never a boxed empty state. */
const QuietLine = styled.p`
  margin: 0;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

/* ---------- Chart and gauge ---------- */

const Body = styled.div<{ $gauge: boolean }>`
  display: grid;
  grid-template-columns: ${({ $gauge }) =>
    $gauge ? 'minmax(0, 1fr) 264px' : 'minmax(0, 1fr)'};
  gap: 28px 40px;
  align-items: stretch;

  @media (max-width: 980px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

const Main = styled.div`
  display: flex;
  flex-direction: column;
  gap: 28px;
  min-width: 0;
`

const ChartBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
`

const ChartHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 20px;
`

const Legend = styled.ul`
  display: flex;
  gap: 18px;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--color-muted);
    font-size: 13px;
  }

  i {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-pill);
    box-shadow: 0 0 10px currentColor;
  }
`

const GaugeBlock = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin: 0;
  padding-left: 40px;
  border-left: 1px solid var(--glass-border);

  @media (max-width: 980px) {
    padding: 24px 0 0;
    border-left: 0;
    border-top: 1px solid var(--glass-border);
  }
`

/** One row per outcome: dot, plain label, count. */
const Outcomes = styled.dl`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 220px;
  margin: 0;

  div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 7px 0;
    border-top: 1px solid var(--glass-border);
  }

  div:first-child {
    border-top: 0;
  }

  dt {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: var(--color-muted);
    font-size: 13px;
    line-height: 18px;
  }

  dd {
    margin: 0;
    color: var(--color-text);
    font-family: var(--font-figure);
    font-size: 14px;
    line-height: 18px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
`

const Footnote = styled.p`
  margin: 22px 0 0;
  padding-top: 16px;
  border-top: 1px solid var(--glass-border);
  color: var(--color-faint);
  font-size: 12px;
  line-height: 16px;
`

/* ---------- Pieces ---------- */

/** The explorer page per chain; its name only reaches the tooltip. */
const explorerLinks = (address: string, chainIds: number[]) =>
  chainIds.map((chainId) => {
    const info = NETWORKS_INFO[chainId as keyof typeof NETWORKS_INFO]
    return {
      chainId,
      name: info?.explorers?.[0]?.name ?? 'the block explorer',
      place:
        chainId === NETWORKS.sepolia
          ? `${chainName(chainId)} test network`
          : chainName(chainId),
      href: getAddressPage({ networkId: chainId, address }),
    }
  })

const rangeLabel = (from: number, to: number) => {
  const a = formatDate(from)
  const b = formatDate(to)
  if (a === b) return a
  // "8 Oct – 19 Oct 2026" when both fall in the same year.
  const sameYear = a.slice(-4) === b.slice(-4)
  return `${sameYear ? a.slice(0, -5) : a} – ${b}`
}

const unitWord: Record<string, string> = {
  hour: 'hour',
  day: 'day',
  week: 'week',
  month: 'month',
}

/* ---------- Panel ---------- */

/*
 * Below 420px the four scope options do not fit the panel (a 323px track at
 * 390): "All chains" says "All" there, as a label, so the chosen option and
 * its thumb stay measured by the control itself.
 */
const NARROW_QUERY = '(max-width: 419px)'
const subscribeNarrow = (onChange: () => void) => {
  const query = window.matchMedia?.(NARROW_QUERY)
  query?.addEventListener('change', onChange)
  return () => query?.removeEventListener('change', onChange)
}
const useNarrow = () =>
  React.useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia?.(NARROW_QUERY).matches ?? false,
    () => false,
  )

/** A figure in the row: a count, a lower bound, or said unavailable. */
interface Figure {
  label: string
  value?: number
  /** A lower bound: "+" after it. */
  lower?: boolean
  /** Why it could not be read; the figure then says "unavailable". */
  unavailable?: string
  /** The figure's own explanation on hover. */
  title?: string
}

/** "Ethereum", "Ethereum and Gnosis", "Ethereum, Gnosis and Sepolia". */
const chainList = new Intl.ListFormat('en', {
  style: 'long',
  type: 'conjunction',
})

export const ProfilePanel = ({
  address,
  isYou,
  isZero,
  loading,
  error,
  failed,
  onRetry,
  generatedAt,
  refreshFailed = false,
  governedStaleSince,
  scope,
  onScope,
  chains,
  stats,
  governedCount,
  governedError,
  governedPartial,
  activities,
  complete,
  listed,
  capped,
  roles,
  juror,
  now,
}: {
  address: string
  isYou: boolean
  isZero: boolean
  loading: boolean
  /** Nothing could be read: the profile is unknown. */
  error: boolean
  /**
   * Chains in the scope whose indexer did not answer: their actions are
   * missing, so the figures read are lower bounds.
   */
  failed: number[]
  onRetry: () => void
  /** When the profile was read, ms. */
  generatedAt?: number
  /** The latest refresh failed: the profile shown is the one read at `generatedAt`. */
  refreshFailed?: boolean
  /** The governance scan's latest refresh failed: its lists are from then, ms. */
  governedStaleSince?: number
  scope: Scope
  onScope: (value: string) => void
  /** Chains the address acted on or governs a list on, busiest first. */
  chains: ChainActivity[]
  /** Figures for the scope. */
  stats?: AddressStats
  /** Lists governed in the scope; undefined until the governance scan settles. */
  governedCount?: number
  /** The governance scan failed: the count is unknown, never 0. */
  governedError: boolean
  /**
   * Some list's governor() could not be read in the scope: the count is a
   * lower bound, and 0 is unknown rather than none.
   */
  governedPartial: boolean
  /** Listed actions in the scope, newest first. */
  activities: ProfileActivity[]
  /** True when every indexed action is listed (no cut at the list limit). */
  complete: boolean
  /** How many actions the list holds across every scope. */
  listed: number
  /** Chains in the scope where the query limit was reached. */
  capped: number[]
  /** What the address is on Curate (all chains); undefined while it loads. */
  roles?: string[]
  /** The juror record in the scope; it leads the figures when no action does. */
  juror: JurorBadgeView
  now: number
}) => {
  const narrow = useNarrow()
  // Until the chains are known a skeleton mark stands in, so the marks do
  // not jump from a default to the chains the address uses. An address with
  // no actions gets the mainnets ("All chains" is Ethereum and Gnosis):
  // Sepolia shows only where the address acted, as its mark would otherwise
  // repeat Ethereum's.
  const explorers = loading
    ? []
    : explorerLinks(
        address,
        chains.length > 0
          ? chains.map((chain) => chain.chainId)
          : [NETWORKS.ethereum, NETWORKS.gnosis],
      )
  const covered = coverage(activities)
  const buckets = activityBuckets(activities, now, complete)
  const record = stats ? challengeRecord(stats) : undefined
  const showGauge = !loading && !error && (record?.total ?? 0) > 0
  const isCapped = !loading && capped.length > 0
  const cappedOn = capped.map(chainName).join(' and ')
  // An indexer that did not answer leaves its chain's actions out: what was
  // read stands, as lower bounds, like a capped read.
  const isPartial = !loading && failed.length > 0
  const failedOn = chainList.format(failed.map(chainName))
  // The exact read limits, on hover: the footnote only names them.
  const limits = `The read stops at ${formatInt(PROFILE_LIMIT)} requests per chain and list type (${formatInt(PERMANENT_PROFILE_LIMIT)} on Stake Curate) or when an indexer does not answer.`
  const lowerBound = isCapped || isPartial
  // No action indexed in the scope: every action figure would be 0, so a
  // juror's figures lead (they are this address's own record) and one muted
  // line says the rest. A governor with no action gets the line alone: the
  // Governed lists heading below carries its count. A capped or partial
  // read keeps its figures, which are lower bounds.
  const noActions =
    !loading && !lowerBound && stats !== undefined && stats.activity === 0
  // Until the jury read lands, a quiet hero does not know what it leads
  // with: it keeps its loading skeleton, so it never shows the muted line
  // first and then grows a row of figures above it.
  const settling = noActions && juror.state === 'loading'
  const bodyLoading = loading || settling
  const quietScope = noActions && !settling
  const jurorLeads = quietScope && juror.state === 'ready' && juror.seats > 0
  const governedKnown = !!governedCount || governedError || governedPartial
  const showFigures = !quietScope || jurorLeads
  // What could not be read on a quiet address, said in its muted line
  // rather than implied to be nothing.
  const quietUnread = chainList.format(
    [
      juror.state === 'unavailable' && 'juror record',
      (governedError || (governedPartial && !governedCount)) &&
        'governed lists',
    ].filter((part): part is string => Boolean(part)),
  )
  const governedFigure: Figure = {
    label: 'Lists governed',
    // Read from each list's governor, not from the requests, by a scan of
    // its own that may settle later.
    value: governedCount,
    // Some governor() reads failed: 0 is not "none".
    unavailable: governedError
      ? 'The governor reads failed; try again later'
      : governedPartial && !governedCount
        ? 'Some lists could not be read; try again later'
        : undefined,
    lower: governedPartial,
  }
  const jurorLower = juror.unread.length > 0 || juror.capped.length > 0
  const jurorUnread =
    juror.unread.length > 0
      ? `At least this many: ${chainNames(juror.unread)} could not be read.`
      : undefined
  const headline: Figure = jurorLeads
    ? {
        label: 'Juror on Curate · seats',
        value: juror.seats,
        lower: jurorLower,
        title: jurorUnread,
      }
    : {
        label: 'Entries submitted · all time',
        value: stats?.submissions,
        lower: lowerBound,
        title: isCapped
          ? `At least ${formatInt(stats?.submissions ?? 0)}: the read stopped before the oldest requests on ${cappedOn}. ${limits}`
          : isPartial
            ? `At least ${formatInt(stats?.submissions ?? 0)}: the indexer did not answer for ${failedOn}.`
            : undefined,
      }
  const inline: Figure[] = jurorLeads
    ? [
        {
          label: 'Disputes drawn in',
          value: juror.cases,
          lower: jurorLower,
          title: jurorUnread,
        },
        {
          label: 'Voted',
          value: juror.votes,
          unavailable:
            juror.votes === undefined
              ? `Votes on ${chainNames(juror.votesUnread)} couldn’t be read`
              : undefined,
        },
        ...(juror.voting > 0
          ? [{ label: 'Still voting', value: juror.voting }]
          : []),
        ...(governedKnown ? [governedFigure] : []),
      ]
    : [
        {
          label: 'Removals requested',
          value: stats?.removals,
          lower: lowerBound,
        },
        { label: 'Challenges', value: stats?.challenges, lower: lowerBound },
        { label: 'Disputes', value: stats?.disputes, lower: lowerBound },
        governedFigure,
      ]
  const testnetIncluded =
    scope === 'all'
      ? chains.some((chain) => chain.chainId === NETWORKS.sepolia)
      : scope === NETWORKS.sepolia
  const scopeOptions = [
    { value: 'all', label: narrow ? 'All' : 'All chains' },
    ...chains.map((chain) => ({
      value: String(chain.chainId),
      label: chainName(chain.chainId),
    })),
  ]
  if (scope !== 'all' && !chains.some((chain) => chain.chainId === scope))
    scopeOptions.push({ value: String(scope), label: chainName(scope) })

  const chartSource = complete
    ? 'every indexed action'
    : `the ${formatInt(listed)} most recent actions`
  const unit = buckets ? unitWord[buckets.unit] : ''
  const outcomes: {
    key: string
    label: string
    value: number
    tone: StatusTone
    always?: boolean
  }[] = record
    ? [
        {
          key: 'won',
          label: 'Won',
          value: record.won,
          tone: 'registered',
          always: true,
        },
        {
          key: 'lost',
          label: 'Lost',
          value: record.lost,
          tone: 'off',
          always: true,
        },
        {
          key: 'none',
          label: 'No ruling',
          value: record.noRuling,
          tone: 'neutral',
        },
        {
          key: 'court',
          label: 'Still in court',
          value: record.inCourt,
          tone: 'contested',
        },
      ]
    : []

  return (
    <Featured
      $featured
      $padding="none"
      aria-label="Curator profile"
      style={{ ['--i' as string]: 0 }}
    >
      <IdentityBar>
        <Identity>
          <Avatar aria-hidden>
            <span>
              <ReactBlockies seed={address} size={8} scale={8} />
            </span>
          </Avatar>
          <IdentityText>
            <Eyebrow>
              {roles === undefined ? (
                <SkeletonBlock $width="56px" $height="12px" aria-hidden />
              ) : (
                <Label $tone="faint">
                  {roles.length > 0 ? roles.join(' · ') : 'Address'}
                </Label>
              )}
              {isYou && (
                <Chip $selected title="The connected wallet">
                  <CurateIcon name="user" size={12} />
                  This is you
                </Chip>
              )}
              {isZero && <Chip>Zero address</Chip>}
            </Eyebrow>
            <AddressLine>
              <AddressTitle title={address}>
                <span className="full">{address}</span>
                <span className="short">{truncateMiddle(address, 10, 8)}</span>
              </AddressTitle>
              <AddressTools>
                <CopyValue value={address} variant="round" />
                {loading && <MarkSkeleton aria-hidden />}
                {explorers.map((explorer) => (
                  <Tooltip
                    key={explorer.chainId}
                    title={`View on ${explorer.name} (${explorer.place})`}
                  >
                    <ExplorerMark
                      href={explorer.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`View on ${explorer.name}, ${explorer.place} (opens in a new tab)`}
                      data-testnet={
                        explorer.chainId === NETWORKS.sepolia || undefined
                      }
                    >
                      <ChainLogo chainId={explorer.chainId} size={28} />
                      <CurateIcon name="external" size={9} />
                    </ExplorerMark>
                  </Tooltip>
                ))}
              </AddressTools>
            </AddressLine>
            {covered && (
              <IdentityMeta>
                <span>
                  Last action <When timestamp={covered.newest} now={now} />
                </span>
              </IdentityMeta>
            )}
          </IdentityText>
        </Identity>

        {/* The control stays while a chain is chosen, even one the address
            is not active on, so the way back to all chains is one click. */}
        {chains.length > 1 || scope !== 'all' ? (
          <ScopeSide>
            <Label $tone="faint">
              {testnetIncluded
                ? scope === 'all'
                  ? 'All chains · Sepolia is a test network'
                  : 'Test network'
                : 'Scope'}
            </Label>
            <SegmentedControl
              ariaLabel="Scope"
              value={scope === 'all' ? 'all' : String(scope)}
              onChange={onScope}
              options={scopeOptions}
            />
          </ScopeSide>
        ) : chains.length === 1 ? (
          <ScopeSide>
            <Label $tone="faint">
              {chains[0].chainId === NETWORKS.sepolia
                ? 'Active on a test network'
                : 'Active on'}
            </Label>
            <ChainChip chainId={chains[0].chainId} />
          </ScopeSide>
        ) : loading ? (
          <ScopeSide aria-hidden>
            <SkeletonBlock $width="64px" $height="12px" />
            <PillSkeleton />
          </ScopeSide>
        ) : null}
      </IdentityBar>

      {error ? (
        <QuietState
          icon="activity"
          title="This profile could not be loaded"
          level={2}
          role="status"
          action={
            <Button
              type="button"
              $variant="secondary"
              $size="sm"
              onClick={onRetry}
            >
              Try again
            </Button>
          }
        >
          {failed.length > 0
            ? `The indexer did not answer for ${failedOn}, so this address’s actions there are unknown. Try again in a moment.`
            : 'The indexers did not answer. Try again in a moment.'}
        </QuietState>
      ) : (
        <>
          <Body $gauge={showGauge}>
            <Main>
              {showFigures && (
                <FiguresRow>
                  <HeadlineFigure>
                    {jurorLeads ? (
                      <Tooltip title={jurorTip(juror)}>
                        <TipLabel tabIndex={0}>
                          <Label $tone="faint">{headline.label}</Label>
                          <CurateIcon name="help" size={12} />
                        </TipLabel>
                      </Tooltip>
                    ) : (
                      <Label $tone="faint">{headline.label}</Label>
                    )}
                    {bodyLoading ? (
                      <SkeletonBlock
                        $width="140px"
                        $height="clamp(48px, 3.2vw + 22px, 76px)"
                        aria-hidden
                        style={{ borderRadius: 12 }}
                      />
                    ) : headline.unavailable ? (
                      <Unavailable title={headline.unavailable}>
                        unavailable
                      </Unavailable>
                    ) : (
                      <Big title={headline.title}>
                        <Odometer value={headline.value} />
                        {headline.lower && <OrMore />}
                      </Big>
                    )}
                  </HeadlineFigure>
                  {inline.length > 0 && (
                    <InlineStats>
                      {inline.map((figure) => (
                        <div key={figure.label}>
                          <Label as="dt" $tone="faint">
                            {figure.label}
                          </Label>
                          <dd title={figure.title}>
                            {figure.unavailable ? (
                              <Unavailable title={figure.unavailable}>
                                unavailable
                              </Unavailable>
                            ) : bodyLoading || figure.value === undefined ? (
                              <SkeletonBlock
                                $width="32px"
                                $height="20px"
                                aria-hidden
                                style={{ margin: '2px 0' }}
                              />
                            ) : (
                              <>
                                <AnimatedNumber value={figure.value} />
                                {figure.lower && <OrMore />}
                              </>
                            )}
                          </dd>
                        </div>
                      ))}
                    </InlineStats>
                  )}
                </FiguresRow>
              )}

              <ChartBlock>
                {(bodyLoading || buckets) && (
                  <ChartHead>
                    <Label $tone="faint">
                      {buckets
                        ? `Actions per ${unit} · ${rangeLabel(
                            buckets.starts[0],
                            now,
                          )}`
                        : 'Actions over time'}
                    </Label>
                    {buckets && (
                      <Legend aria-label="Chart series">
                        <li style={{ color: 'var(--color-primary)' }}>
                          <i
                            style={{ background: 'var(--color-primary)' }}
                            aria-hidden
                          />
                          <span style={{ color: 'var(--color-muted)' }}>
                            Submissions and removals
                          </span>
                        </li>
                        <li style={{ color: 'var(--status-contested)' }}>
                          <i
                            style={{ background: 'var(--status-contested)' }}
                            aria-hidden
                          />
                          <span style={{ color: 'var(--color-muted)' }}>
                            Challenges
                          </span>
                        </li>
                      </Legend>
                    )}
                  </ChartHead>
                )}
                {bodyLoading ? (
                  <SkeletonBlock $height="252px" />
                ) : buckets ? (
                  <ActivityChart
                    key={`${scope}-${buckets.unit}-${buckets.starts.length}`}
                    height={220}
                    labels={buckets.labels}
                    axisLabels={buckets.axisLabels}
                    requests={buckets.requests}
                    challenges={buckets.challenges}
                    ariaLabel={`Submissions and removal requests (above) and challenges (below) per ${unit} from ${formatDate(
                      buckets.starts[0],
                    )}: ${formatInt(
                      buckets.requests.reduce((sum, v) => sum + v, 0),
                    )} submissions and removals, ${formatInt(
                      buckets.challenges.reduce((sum, v) => sum + v, 0),
                    )} challenges, from ${chartSource}`}
                  />
                ) : (
                  <QuietLine role="status">
                    {isZero
                      ? 'The zero address is the empty placeholder on chain; no one can submit or challenge from it.'
                      : stats && stats.activity > 0
                        ? 'No dated action in this scope.'
                        : `No submission, removal or challenge by this address on ${
                            scope === 'all'
                              ? chainNames(SUPPORTED_CHAIN_IDS)
                              : chainName(scope)
                          }.${quietUnread ? ` Its ${quietUnread} could not be read.` : ''}`}
                  </QuietLine>
                )}
              </ChartBlock>
            </Main>

            {showGauge && record && (
              <GaugeBlock aria-label="Challenge record">
                <Label $tone="faint">Challenge record</Label>
                <ChallengeRing
                  key={`ring-${scope}`}
                  size={208}
                  segments={outcomes.map(({ key, value, tone }) => ({
                    key,
                    value,
                    tone,
                  }))}
                  {...(record.decided > 0
                    ? {
                        value: formatInt(record.won),
                        unit: `of ${formatInt(record.decided)}`,
                        caption: 'decided challenges won',
                      }
                    : {
                        value: formatInt(record.inCourt),
                        caption: 'in court, none decided yet',
                      })}
                  label={`Challenge record of ${formatInt(record.total)} ${
                    record.total === 1 ? 'challenge' : 'challenges'
                  }: ${outcomes
                    .filter((outcome) => outcome.always || outcome.value > 0)
                    .map(
                      (outcome) =>
                        `${outcome.label.toLowerCase()} ${formatInt(outcome.value)}`,
                    )
                    .join(', ')}`}
                />
                <Outcomes aria-label="Challenges by outcome">
                  {outcomes
                    .filter((outcome) => outcome.always || outcome.value > 0)
                    .map((outcome) => (
                      <div key={outcome.key}>
                        <dt>
                          <StatusDot $tone={outcome.tone} aria-hidden />
                          {outcome.label}
                        </dt>
                        <dd>{formatInt(outcome.value)}</dd>
                      </div>
                    ))}
                </Outcomes>
              </GaugeBlock>
            )}
          </Body>

          <Footnote>
            {generatedAt
              ? refreshFailed
                ? `Couldn’t refresh; showing data from ${formatAgo(Math.floor(generatedAt / 1000), now)}.`
                : `Updated ${formatAgo(Math.floor(generatedAt / 1000), now)}.`
              : loading
                ? 'Reading the indexers.'
                : ''}
            {governedStaleSince !== undefined &&
              ` Couldn’t refresh the governed lists; showing them as of ${formatAgo(Math.floor(governedStaleSince / 1000), now)}.`}
            {isCapped && (
              <span title={limits}>
                {` On ${cappedOn} the read stopped before the oldest requests (a read limit or an indexer timeout): figures marked + are lower bounds.`}
              </span>
            )}
            {isPartial &&
              ` The indexer did not answer for ${failedOn}: its actions are missing and figures marked + are lower bounds.`}
            {governedPartial &&
              !governedError &&
              ' Some lists’ governor could not be read: the lists governed are a lower bound.'}
            {buckets?.partialFrom !== undefined &&
              ` The first ${unit} holds only the listed actions.`}
          </Footnote>
        </>
      )}
    </Featured>
  )
}

export default ProfilePanel
