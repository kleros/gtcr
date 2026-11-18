import React from 'react'
import styled from 'styled-components'
import { formatDate } from 'utils/time'
import { SkeletonBlock, StatusDot } from './primitives'
import type { StatusTone } from './primitives'
import { RingGauge } from './motion/ring-gauge'
import {
  Bento,
  KeyDot,
  KeyLine,
  KeyList,
  KeyTick,
  Panel,
  PanelLine,
  PanelSkeleton,
  PanelTitle,
  PanelTop,
  RING_SIZE,
  Split,
  TONE_COLOR,
  Tally,
  integer,
  onListFor,
  ordinal,
  useInView,
  type InsightKey,
} from './registry-insights-kit'
import {
  LANE_COLOR,
  LanePlot,
  pickLanes,
  type PlotLane,
} from './registry-lane-plot'
import { CountUpText } from './registry-shared-count'
import {
  CHALLENGE_CAP,
  type StandardLane,
  type StandardSummary,
} from './registry-standard-summary'

/*
 * The Standard registry's three drawings. They answer the same three
 * questions the Stake page answers, from Standard's own mechanics:
 * - Listing history: one lane per entry (the shared drawing in
 *   registry-lane-plot.tsx), from its first request to today. A Standard
 *   entry is pending for its whole challenge window and reaches the list
 *   only when its request resolves, so a lane reads blue while a request's
 *   window runs, amber while the court sits, and green while the entry is
 *   registered.
 * - Where they stand: every entry by status, led by how many are on the list
 *   right now, as a bar and a tally. The figures are the registry counters
 *   the filter chips already show, so the page cannot contradict itself, and
 *   it is a bar rather than a ring because the header already draws the
 *   share registered and because two of these statuses are blue and two
 *   amber: the second of each pair is drawn in the muted mix of its own
 *   status colour, the muting LANE_COLOR gives a listing that ended.
 * - Challenges: what the challenges on this list did to the entries, from
 *   the newest page of them; at the cap every figure there reads "n+".
 */

/** The registry counters, one per status filter (the page's own figures). */
export interface StandardCounts {
  registered: number
  submitted: number
  removalRequested: number
  challengedSubmissions: number
  challengedRemovals: number
  absent: number
  total: number
}

/** A lane the plot can draw, keeping the entry it was built from. */
type StandardPlotLane = PlotLane & { source: StandardLane }

/** What the tooltip (and the lane's accessible name) says about one lane. */
const laneLines = (lane: StandardLane, now: number): string[] => {
  const lines: string[] = []
  if (lane.listedSince !== undefined) {
    lines.push(`Listed since ${formatDate(lane.listedSince)}`)
    lines.push(
      `${onListFor(now - lane.listedSince)} on the list${lane.statusLabel ? ` · ${lane.statusLabel}` : ''}`,
    )
  } else if (lane.wasListed) {
    lines.push(
      `Listed ${formatDate(lane.wasListed.start)} to ${formatDate(lane.wasListed.end)}`,
    )
    lines.push(
      lane.wasListed.by === 'ruling'
        ? 'Off the list by a ruling'
        : 'Removal executed',
    )
  } else {
    lines.push(`First requested ${formatDate(lane.since)}`)
    if (!lane.open && lane.statusLabel) lines.push(lane.statusLabel)
  }
  if (lane.open) {
    const what = lane.open.removal ? 'Removal' : 'Submission'
    lines.push(
      lane.open.inCourtSince !== undefined
        ? `${what} in court since ${formatDate(lane.open.inCourtSince)}`
        : `${what} open since ${formatDate(lane.open.start)}`,
    )
  }
  if (lane.challenges > 0 && lane.open?.inCourtSince === undefined)
    lines.push(
      lane.challenges === 1
        ? `Challenged ${lane.lastChallenge === undefined ? 'once' : formatDate(lane.lastChallenge)}`
        : `Challenged ${lane.challenges} times${
            lane.lastChallenge === undefined
              ? ''
              : `, last ${formatDate(lane.lastChallenge)}`
          }`,
    )
  if (lane.listings > 1)
    lines.push(`${ordinal(lane.listings)} time on the list`)
  return lines
}

const plotLanes = (
  lanes: StandardLane[],
  now: number,
  itemName: string,
  isHidden: (lane: StandardLane) => boolean,
): StandardPlotLane[] =>
  lanes
    .filter((lane) => lane.segments.length > 0)
    .map((lane) => ({
      id: lane.id,
      name: isHidden(lane)
        ? `Hidden ${itemName}`
        : (lane.name ?? `Unnamed ${itemName}`),
      lines: laneLines(lane, now),
      segments: lane.segments,
      marks: lane.marks,
      source: lane,
    }))

/** One key per kind of mark the drawing actually holds. */
const historyKeys = (lanes: StandardPlotLane[]): InsightKey[] => {
  const segments = new Set<string>()
  const marks = new Set<string>()
  const heads = new Set<StatusTone>()
  lanes.forEach((lane) => {
    lane.segments.forEach((segment) => segments.add(segment.kind))
    lane.marks.forEach((mark) => {
      marks.add(mark.kind)
      if (mark.kind === 'status' && mark.tone) heads.add(mark.tone)
    })
  })
  // Lines first (what a lane is made of), then the marks that close one.
  const keys: InsightKey[] = []
  if (segments.has('listed'))
    keys.push({
      key: 'listed',
      label: 'Listed',
      mark: <KeyLine $color={LANE_COLOR.listed} />,
    })
  if (segments.has('was-listed'))
    keys.push({
      key: 'was-listed',
      label: 'Was listed',
      mark: <KeyLine $color={LANE_COLOR['was-listed']} />,
    })
  if (segments.has('pending'))
    keys.push({
      key: 'pending',
      label: 'Request open',
      mark: <KeyLine $color={LANE_COLOR.pending} />,
    })
  if (segments.has('court'))
    keys.push({
      key: 'court',
      label: 'In court',
      mark: <KeyLine $color={LANE_COLOR.court} />,
    })
  if (heads.has('neutral'))
    keys.push({
      key: 'ready',
      label: 'Ready to execute',
      mark: <KeyDot $color={TONE_COLOR.neutral} />,
    })
  if (marks.has('off'))
    keys.push({
      key: 'off',
      label: 'Off the list',
      mark: <KeyDot $color={TONE_COLOR.off} />,
    })
  if (marks.has('stop'))
    keys.push({
      key: 'stop',
      label: 'Removal executed',
      mark: <KeyTick />,
    })
  return keys
}

/** What the drawing measures, for readers who cannot see it. */
const historyLabel = (
  lanes: StandardPlotLane[],
  itemName: string,
  itemNamePlural: string,
) => {
  const n = lanes.length
  const listed = lanes.filter(
    (lane) => lane.source.listedSince !== undefined,
  ).length
  const open = lanes.filter((lane) => !!lane.source.open).length
  const since = Math.min(...lanes.map((lane) => lane.source.since))
  return `Listing history of ${integer.format(n)} ${
    n === 1 ? itemName : itemNamePlural
  } since ${formatDate(since)}: ${integer.format(listed)} on the list now, ${integer.format(
    n - listed,
  )} off it${open > 0 ? `, ${integer.format(open)} with a request open` : ''}.`
}

/* ---------- Where they stand ---------- */

/* Every entry by status on one track: a stretch per status, sized by its
   share, each with a halo of its own colour and gaps wide enough to tell
   two blues or two ambers apart. The stretches grow out from the left once
   the track is in view, and stand at full size at once under reduced
   motion. */
const Bar = styled.div`
  display: flex;
  gap: 3px;
  width: 100%;
  height: 16px;
  border-radius: var(--radius-pill);
  background: var(--color-raised);
  box-shadow: var(--recess-shadow);
`

const Stretch = styled.i<{ $color: string }>`
  flex-grow: var(--share, 0);
  flex-shrink: 0;
  flex-basis: 0;
  min-width: 3px;
  height: 100%;
  border-radius: var(--radius-pill);
  background: ${({ $color }) => $color};
  box-shadow: 0 0 10px -2px
    color-mix(in srgb, ${({ $color }) => $color} 60%, transparent);
  transition: flex-grow 900ms var(--ease-out);

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const BarWrap = styled.figure`
  margin: 0;
`

/* The figure the panel leads with, as the Stake ring's centre leads its
   own: the count climbs once the panel is in view. */
const Lead = styled.p`
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 2px 8px;
  margin: 0;

  b {
    color: var(--color-text);
    font-family: var(--font-figure);
    font-size: var(--fs-title-lg);
    line-height: 1;
    font-weight: 500;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
  }

  span {
    color: var(--color-faint);
    font-size: var(--fs-label);
    line-height: var(--lh-label);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
`

/* The figure, the bar and its tally in a column, where the Stake ring sits
   beside one. */
const StandingBody = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 14px;
  flex: 1 1 auto;
`

const STANDING: {
  key: keyof StandardCounts
  tone: StatusTone
  /** The second status of a pair that share one hue, drawn muted. */
  muted?: boolean
  label: string
  /** True while the entry is on the list (the figure the panel leads with). */
  listed?: boolean
}[] = [
  {
    key: 'registered',
    tone: 'registered',
    label: 'Registered',
    listed: true,
  },
  { key: 'submitted', tone: 'window', label: 'Submitted' },
  {
    key: 'removalRequested',
    tone: 'window',
    muted: true,
    label: 'Removal requested',
    listed: true,
  },
  {
    key: 'challengedSubmissions',
    tone: 'contested',
    label: 'Challenged submissions',
  },
  {
    key: 'challengedRemovals',
    tone: 'contested',
    muted: true,
    label: 'Challenged removals',
    listed: true,
  },
  { key: 'absent', tone: 'off', label: 'Rejected or removed' },
]

/**
 * A status's colour on the bar and on its tally dot. Two statuses are blue
 * (a submission and a removal in their window) and two amber (both of them
 * challenged), so the second of each pair takes its status colour mixed
 * toward the surface, as a listing that ended does in the drawing beside it.
 * The dot carries the same mix, which is what matches a stretch to its row.
 */
const standingColor = (tone: StatusTone, muted?: boolean) =>
  muted
    ? `color-mix(in srgb, ${TONE_COLOR[tone]} 55%, var(--color-surface))`
    : TONE_COLOR[tone]

const Standing = ({
  counts,
  itemNamePlural,
}: {
  counts: StandardCounts
  itemNamePlural: string
}) => {
  const [ref, inView] = useInView<HTMLElement>()
  const rows = STANDING.map((status) => ({
    ...status,
    value: counts[status.key],
    color: standingColor(status.tone, status.muted),
  }))
  // A removal request does not take an entry off the list: it stays until
  // the request is carried out, so these three statuses are on it.
  const onList = rows
    .filter((row) => row.listed)
    .reduce((total, row) => total + row.value, 0)
  const label = `${integer.format(counts.total)} ${itemNamePlural} by status: ${rows
    .map((row) => `${row.label} ${integer.format(row.value)}`)
    .join(', ')}`
  return (
    <StandingBody>
      <Lead title="Registered, plus those with a removal request still open">
        <b>
          <CountUpText value={inView ? integer.format(onList) : ''} />
        </b>
        <span>on the list now</span>
      </Lead>
      <BarWrap ref={ref} role="img" aria-label={label}>
        <Bar aria-hidden>
          {rows
            .filter((row) => row.value > 0)
            .map((row) => (
              <Stretch
                key={row.key}
                $color={row.color}
                style={
                  { '--share': inView ? row.value : 0 } as React.CSSProperties
                }
              />
            ))}
        </Bar>
      </BarWrap>
      <Tally aria-label="Entries by status">
        {rows.map((row) => (
          <div key={row.key} data-zero={row.value === 0 ? true : undefined}>
            <KeyDot $color={row.color} aria-hidden />
            <dt>{row.label}</dt>
            <dd>{integer.format(row.value)}</dd>
          </div>
        ))}
      </Tally>
    </StandingBody>
  )
}

/* ---------- Challenges ---------- */

/*
 * The outcomes of the challenges read, with the scope the read covers. The
 * challenges come from one page of the newest of them, so at the cap every
 * figure here is a lower bound: each reads "n+" and the ring says what its
 * share is a share of (DESIGN.md: a count reads "n+" when its query hits
 * its cap).
 */
const Challenges = ({
  challenges,
  itemName,
}: {
  challenges: StandardSummary['challenges']
  itemName: string
}) => {
  const { offList, onList, inCourt, capped } = challenges
  const resolved = offList + onList
  const more = capped ? '+' : ''
  const scope = capped
    ? `, of the newest ${integer.format(CHALLENGE_CAP)} challenges`
    : ''
  const rows: { tone: StatusTone; label: string; value: number }[] = [
    { tone: 'off', label: 'Off the list', value: offList },
    { tone: 'registered', label: 'On the list', value: onList },
    { tone: 'contested', label: 'In court', value: inCourt },
  ]
  return (
    <Split>
      {resolved > 0 ? (
        <RingGauge
          size={RING_SIZE}
          ratio={offList / resolved}
          from="var(--status-contested)"
          to="var(--status-off)"
          label={`Challenges that took the ${itemName} off the list: ${integer.format(
            offList,
          )} of ${integer.format(resolved)} resolved${scope}`}
          caption="off the list"
        />
      ) : null}
      <Tally aria-label={`Challenges by outcome${scope}`}>
        {rows.map((row) => (
          <div key={row.tone} data-zero={row.value === 0 ? true : undefined}>
            <StatusDot $tone={row.tone} aria-hidden />
            <dt>{row.label}</dt>
            {/* "0+" would say nothing: a zero stands as it is read. */}
            <dd>
              {integer.format(row.value)}
              {row.value > 0 ? more : ''}
            </dd>
          </div>
        ))}
      </Tally>
    </Split>
  )
}

/* ---------- Bento ---------- */

/** "19 raised on this list."; a count that hit its page cap reads "n+". */
const raisedLine = (count: number, capped: boolean) =>
  count === 0
    ? 'None raised yet.'
    : `${integer.format(count)}${capped ? '+' : ''} raised on this list.`

export const StandardInsights = ({
  summary,
  loading,
  now,
  itemName,
  itemNamePlural,
  counts,
  isHidden,
  onOpen,
}: {
  summary?: StandardSummary
  loading?: boolean
  now: number
  itemName: string
  itemNamePlural: string
  /** The registry counters; undefined until they land. */
  counts?: StandardCounts
  isHidden: (lane: StandardLane) => boolean
  onOpen?: (lane: StandardLane) => void
}) => {
  if (loading)
    return (
      <Bento aria-busy>
        <PanelSkeleton />
        <PanelSkeleton />
        <PanelSkeleton />
      </Bento>
    )
  if (!summary || summary.lanes.length === 0) return null
  const lanes = pickLanes(
    plotLanes(summary.lanes, now, itemName, isHidden),
    now,
  )
  if (lanes.length === 0) return null
  const keys = historyKeys(lanes)
  return (
    <Bento aria-label={`${itemNamePlural} at a glance`}>
      <Panel $padding="none" style={{ ['--i' as string]: 1 }}>
        <PanelTop>
          <div>
            <PanelTitle>Listing history</PanelTitle>
            <PanelLine>
              One line per {itemName}, from its first request to today.
            </PanelLine>
          </div>
          <KeyList keys={keys} />
        </PanelTop>
        <LanePlot
          lanes={lanes}
          // The counters hold every entry; the lanes are the latest of them.
          totalLanes={counts?.total ?? lanes.length}
          now={now}
          ariaLabel={historyLabel(lanes, itemName, itemNamePlural)}
          onOpen={onOpen && ((lane: StandardPlotLane) => onOpen(lane.source))}
        />
      </Panel>

      <Panel $padding="none" style={{ ['--i' as string]: 2 }}>
        <PanelTop>
          <div>
            <PanelTitle>Where they stand</PanelTitle>
            <PanelLine>
              {counts
                ? `All ${integer.format(counts.total)} ${
                    counts.total === 1 ? itemName : itemNamePlural
                  }, by status now.`
                : `Every ${itemName} by status now.`}
            </PanelLine>
          </div>
        </PanelTop>
        {counts ? (
          <Standing counts={counts} itemNamePlural={itemNamePlural} />
        ) : (
          <SkeletonBlock $height="176px" />
        )}
      </Panel>

      <Panel $padding="none" style={{ ['--i' as string]: 3 }}>
        <PanelTop>
          <div>
            <PanelTitle>Challenges</PanelTitle>
            <PanelLine>
              {raisedLine(summary.challenges.total, summary.challenges.capped)}
            </PanelLine>
          </div>
        </PanelTop>
        <Challenges challenges={summary.challenges} itemName={itemName} />
      </Panel>
    </Bento>
  )
}

export default StandardInsights
