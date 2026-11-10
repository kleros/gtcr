import React, { useState } from 'react'
import styled from 'styled-components'
import ReactBlockies from 'react-blockies'
import { NETWORKS, NETWORKS_INFO } from 'config/networks'
import { getAddressPage } from 'utils/network-utils'
import { formatAgo, formatDate } from 'utils/time'
import { CurateIcon } from 'components/curate/icons'
import {
  Button,
  ButtonLink,
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
  challengeRecord,
  coverage,
  formatInt,
  type ChainActivity,
  type Scope,
} from './view'
import { QuietState, When } from './parts'
import { ActivityChart } from './activity-chart'
import { ChallengeRing } from './challenge-ring'

/*
 * The profile panel, the page's one featured surface: who the address is
 * (identicon, the address in mono, copy and explorer, "this is you"), the
 * entries it submitted as the headline figure with its other counts inline,
 * its requests and challenges over time, and its challenge record as a ring
 * when it has challenged anything. Every figure describes the chosen scope.
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

const Eyebrow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
`

const AddressTitle = styled.h1`
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

const pill = `
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  background: var(--glass);
  color: var(--color-muted);
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  white-space: nowrap;
  text-decoration: none;
  cursor: pointer;
  transition:
    color var(--motion),
    border-color var(--motion),
    background var(--motion);

  &:hover {
    color: var(--color-text);
    border-color: var(--color-border-strong);
  }
`

const CopyButton = styled.button`
  ${pill}
`

const ExplorerLink = styled.a`
  ${pill}
`

const LastAction = styled.span`
  margin-left: 4px;
`

/** Stands in for the explorer links until the chains are known. */
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
  line-height: 0.95;
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

const explorerLinks = (address: string, chainIds: number[]) => {
  const links = chainIds.map((chainId) => {
    const info = NETWORKS_INFO[chainId as keyof typeof NETWORKS_INFO]
    return {
      chainId,
      name: info?.explorers?.[0]?.name ?? `${chainName(chainId)} explorer`,
      href: getAddressPage({ networkId: chainId, address }),
    }
  })
  // Two chains on the same explorer brand read "Etherscan · Sepolia".
  return links.map((link) =>
    links.filter((other) => other.name === link.name).length > 1
      ? { ...link, name: `${link.name} · ${chainName(link.chainId)}` }
      : link,
  )
}

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

export const ProfilePanel = ({
  address,
  isYou,
  isZero,
  loading,
  error,
  onRetry,
  generatedAt,
  scope,
  onScope,
  chains,
  stats,
  governedCount,
  governedError,
  activities,
  complete,
  listed,
  capped,
  now,
}: {
  address: string
  isYou: boolean
  isZero: boolean
  loading: boolean
  error: boolean
  onRetry: () => void
  /** When the profile was read, ms. */
  generatedAt?: number
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
  /** Listed actions in the scope, newest first. */
  activities: ProfileActivity[]
  /** True when every indexed action is listed (no cut at the list limit). */
  complete: boolean
  /** How many actions the list holds across every scope. */
  listed: number
  /** Chains in the scope where the query limit was reached. */
  capped: number[]
  now: number
}) => {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  // Until the chains are known a skeleton pill stands in, so the links do
  // not jump from every supported chain to the one the address uses.
  const explorers = loading
    ? []
    : explorerLinks(
        address,
        chains.length > 0
          ? chains.map((chain) => chain.chainId)
          : SUPPORTED_CHAIN_IDS,
      )
  const covered = coverage(activities)
  const buckets = activityBuckets(activities, now, complete)
  const record = stats ? challengeRecord(stats) : undefined
  const showGauge = !loading && !error && (record?.total ?? 0) > 0
  const isCapped = !loading && capped.length > 0
  const cappedOn = capped.map(chainName).join(' and ')
  // Nothing indexed and no list governed: the empty state leads the panel
  // instead of a row of zeros. A capped read keeps its figures, which are
  // lower bounds, and a failed governance scan keeps "unavailable".
  const quiet =
    !loading &&
    !isCapped &&
    stats !== undefined &&
    stats.activity === 0 &&
    !governedError &&
    !(governedCount && governedCount > 0)
  const testnetIncluded =
    scope === 'all'
      ? chains.some((chain) => chain.chainId === NETWORKS.sepolia)
      : scope === NETWORKS.sepolia
  const scopeOptions = [
    { value: 'all', label: 'All chains' },
    ...chains.map((chain) => ({
      value: String(chain.chainId),
      label: chainName(chain.chainId),
    })),
  ]
  if (scope !== 'all' && !chains.some((chain) => chain.chainId === scope))
    scopeOptions.push({ value: String(scope), label: chainName(scope) })

  // The exact read limits, on hover: the footnote only names them.
  const limits = `The read stops at ${formatInt(PROFILE_LIMIT)} requests per chain and list type (${formatInt(PERMANENT_PROFILE_LIMIT)} on Stake Curate) or when an indexer does not answer.`
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
              <Label $tone="faint">Curator</Label>
              {isYou && (
                <Chip $selected title="The connected wallet">
                  <CurateIcon name="user" size={12} />
                  This is you
                </Chip>
              )}
              {isZero && <Chip>Zero address</Chip>}
            </Eyebrow>
            <AddressTitle title={address}>
              <span className="full">{address}</span>
              <span className="short">{truncateMiddle(address, 10, 8)}</span>
            </AddressTitle>
            <IdentityMeta>
              <CopyButton
                type="button"
                onClick={copy}
                aria-label={copied ? 'Copied' : 'Copy address'}
                title={copied ? 'Copied' : 'Copy address'}
              >
                <CurateIcon name={copied ? 'check' : 'copy'} size={13} />
                {copied ? 'Copied' : 'Copy'}
              </CopyButton>
              {loading && <PillSkeleton aria-hidden />}
              {explorers.map((explorer) => (
                <ExplorerLink
                  key={explorer.chainId}
                  href={explorer.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Open on ${explorer.name} (${chainName(explorer.chainId)})`}
                >
                  {explorer.name}
                  <CurateIcon name="external" size={12} />
                </ExplorerLink>
              ))}
              {covered && (
                <LastAction>
                  Last action <When timestamp={covered.newest} now={now} />
                </LastAction>
              )}
            </IdentityMeta>
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
          The indexers did not answer. Try again in a moment.
        </QuietState>
      ) : (
        <>
          <Body $gauge={showGauge}>
            <Main>
              {!quiet && (
                <FiguresRow>
                  <HeadlineFigure>
                    <Label $tone="faint">Entries submitted · all time</Label>
                    {loading ? (
                      <SkeletonBlock
                        $width="140px"
                        $height="clamp(46px, 3.04vw + 21px, 72px)"
                        aria-hidden
                        style={{ borderRadius: 12 }}
                      />
                    ) : (
                      <Big
                        title={
                          isCapped
                            ? `At least ${formatInt(stats?.submissions ?? 0)}: the read stopped before the oldest requests on ${cappedOn}. ${limits}`
                            : undefined
                        }
                      >
                        <Odometer value={stats?.submissions} />
                        {isCapped && <OrMore />}
                      </Big>
                    )}
                  </HeadlineFigure>
                  <InlineStats>
                    {[
                      {
                        label: 'Removals requested',
                        value: stats?.removals,
                        read: true,
                      },
                      {
                        label: 'Challenges',
                        value: stats?.challenges,
                        read: true,
                      },
                      { label: 'Disputes', value: stats?.disputes, read: true },
                      // Read from each list's governor, not from the requests,
                      // by a scan of its own that may settle later.
                      {
                        label: 'Lists governed',
                        value: governedCount,
                        unavailable: governedError,
                      },
                    ].map((figure) => (
                      <div key={figure.label}>
                        <Label as="dt" $tone="faint">
                          {figure.label}
                        </Label>
                        <dd>
                          {figure.unavailable ? (
                            <Unavailable title="The governor reads failed; try again later">
                              unavailable
                            </Unavailable>
                          ) : loading || figure.value === undefined ? (
                            <SkeletonBlock
                              $width="32px"
                              $height="20px"
                              aria-hidden
                              style={{ margin: '2px 0' }}
                            />
                          ) : (
                            <>
                              <AnimatedNumber value={figure.value} />
                              {isCapped && figure.read && <OrMore />}
                            </>
                          )}
                        </dd>
                      </div>
                    ))}
                  </InlineStats>
                </FiguresRow>
              )}

              <ChartBlock>
                {(loading || buckets) && (
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
                {loading ? (
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
                  <QuietState
                    icon="activity"
                    tight={quiet}
                    title={
                      stats && stats.activity > 0
                        ? 'No dated action in this scope'
                        : 'No actions indexed'
                    }
                    action={
                      <ButtonLink to="/browse" $variant="secondary" $size="sm">
                        Browse registries
                      </ButtonLink>
                    }
                  >
                    {isZero
                      ? 'The zero address is the empty placeholder on chain; no one can submit or challenge from it.'
                      : `No submission, removal or challenge by this address on ${
                          scope === 'all'
                            ? SUPPORTED_CHAIN_IDS.map(chainName).join(', ')
                            : chainName(scope)
                        }.`}
                  </QuietState>
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
              ? `Updated ${formatAgo(Math.floor(generatedAt / 1000), now)}.`
              : loading
                ? 'Reading the indexers.'
                : ''}
            {isCapped && (
              <span title={limits}>
                {` On ${cappedOn} the read stopped before the oldest requests (a read limit or an indexer timeout): figures marked + are lower bounds.`}
              </span>
            )}
            {buckets?.partialFrom !== undefined &&
              ` The first ${unit} holds only the listed actions.`}
          </Footnote>
        </>
      )}
    </Featured>
  )
}

export default ProfilePanel
