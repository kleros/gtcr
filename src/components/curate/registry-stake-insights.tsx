import React from 'react'
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
  StatusRing,
  integer,
  onListFor,
  ordinal,
  scopeText,
  type InsightKey,
} from './registry-insights-kit'
import {
  LANE_COLOR,
  LanePlot,
  laneStart,
  pickLanes,
  type LaneMark,
  type LaneSegment,
  type PlotLane,
} from './registry-lane-plot'
import type { StakeLane, StakeSummary } from './registry-stake-summary'

/*
 * The Stake registry's three drawings, all from the list's own entries:
 * - Listing history: one lane per entry (the shared drawing in
 *   registry-lane-plot.tsx), from its submission to its removal, its
 *   withdrawal or today. A Stake entry is listed from the moment it was
 *   submitted — the list has no requests — so its lane opens in the listed
 *   colour, its head dot carries the status the list rows show, and the
 *   stretches it spent in court are drawn over it. The keys name only the
 *   marks drawn.
 * - Where they stand: the entries by the status the list rows show.
 * - Challenges: the share of resolved challenges that removed the entry.
 */

/** A lane the plot can draw, keeping the entry it was built from. */
type StakePlotLane = PlotLane & { source: StakeLane }

/** The tone of an open listing's head: the status the list row shows. */
const headTone = (lane: StakeLane): StatusTone => {
  const tone = lane.tone ?? 'registered'
  return tone === 'off' ? 'registered' : tone
}

/** What the tooltip (and the lane's accessible name) says about one lane. */
const laneLines = (lane: StakeLane, now: number): string[] => {
  const listing = lane.listings[lane.listings.length - 1]
  if (!listing) return []
  const count = lane.listings.length
  const lines: string[] = [
    listing.end === undefined
      ? `Listed since ${formatDate(listing.start)}`
      : `Listed ${formatDate(listing.start)} to ${formatDate(listing.end)}`,
  ]
  if (listing.end === undefined)
    lines.push(
      `${onListFor(now - listing.start)} on the list${lane.statusLabel ? ` · ${lane.statusLabel}` : ''}`,
    )
  else
    lines.push(
      listing.endedBy === 'removed' ? 'Removed by a ruling' : 'Withdrawn',
    )
  const open = lane.challenges.find((challenge) => challenge.end === undefined)
  const last = lane.challenges[lane.challenges.length - 1]
  if (open) lines.push(`In court since ${formatDate(open.start)}`)
  else if (last)
    lines.push(
      lane.challenges.length === 1
        ? `Challenged ${formatDate(last.start)}`
        : `Challenged ${lane.challenges.length} times, last ${formatDate(last.start)}`,
    )
  if (count > 1) lines.push(`${ordinal(count)} time on the list`)
  return lines
}

/**
 * A Stake entry as the drawing sees it: one stretch per listing (the open
 * one glowing, with the row's status at its head), the challenges painted
 * over them, and a red dot or a stop bar where a listing ended.
 */
const stakeLanes = (
  lanes: StakeLane[],
  now: number,
  itemName: string,
  isHidden: (lane: StakeLane) => boolean,
): StakePlotLane[] =>
  // An entry with no listing has nothing to draw: it never reached the list.
  lanes
    .filter((lane) => lane.listings.length > 0)
    .map((lane) => {
      const segments: LaneSegment[] = []
      const marks: LaneMark[] = []
      lane.listings.forEach((listing) => {
        if (listing.end === undefined) {
          segments.push({ start: listing.start, kind: 'listed', glow: true })
          marks.push({ at: 'now', kind: 'status', tone: headTone(lane) })
          return
        }
        segments.push({
          start: listing.start,
          end: listing.end,
          kind: 'was-listed',
        })
        marks.push({
          at: listing.end,
          kind: listing.endedBy === 'removed' ? 'off' : 'stop',
        })
      })
      lane.challenges.forEach((challenge) =>
        segments.push({
          start: challenge.start,
          end: challenge.end,
          kind: 'court',
        }),
      )
      return {
        id: lane.id,
        name: isHidden(lane)
          ? `Hidden ${itemName}`
          : (lane.name ?? `Unnamed ${itemName}`),
        lines: laneLines(lane, now),
        segments,
        marks,
        source: lane,
      }
    })

/** One key per kind of mark the drawing actually holds. */
const historyKeys = (lanes: StakePlotLane[]): InsightKey[] => {
  const heads = new Set<StatusTone>()
  const ends = new Set<string>()
  let closed = false
  let challenged = false
  lanes.forEach((lane) => {
    lane.source.listings.forEach((listing) => {
      if (listing.end === undefined) heads.add(headTone(lane.source))
      else {
        closed = true
        if (listing.endedBy) ends.add(listing.endedBy)
      }
    })
    if (lane.source.challenges.length > 0) challenged = true
  })
  // Lines first (what a lane is made of), then the marks at its head or end.
  const keys: InsightKey[] = []
  if (heads.size > 0)
    keys.push({
      key: 'listed',
      label: 'Listed',
      mark: <KeyLine $color={LANE_COLOR.listed} />,
    })
  if (closed)
    keys.push({
      key: 'closed',
      label: 'Was listed',
      mark: <KeyLine $color={LANE_COLOR['was-listed']} />,
    })
  if (challenged || heads.has('contested'))
    keys.push({
      key: 'court',
      label: 'In court',
      mark: <KeyLine $color={LANE_COLOR.court} />,
    })
  if (heads.has('window'))
    keys.push({
      key: 'pending',
      label: 'Pending',
      mark: <KeyDot $color={TONE_COLOR.window} />,
    })
  if (heads.has('neutral'))
    keys.push({
      key: 'ready',
      label: 'Withdrawal ready',
      mark: <KeyDot $color={TONE_COLOR.neutral} />,
    })
  if (ends.has('removed'))
    keys.push({
      key: 'removed',
      label: 'Removed',
      mark: <KeyDot $color={TONE_COLOR.off} />,
    })
  if (ends.has('withdrawn'))
    keys.push({ key: 'withdrawn', label: 'Withdrawn', mark: <KeyTick /> })
  return keys
}

/** What the drawing measures, for readers who cannot see it. */
const historyLabel = (
  lanes: StakePlotLane[],
  itemName: string,
  itemNamePlural: string,
) => {
  const lastEnd = (lane: StakePlotLane) =>
    lane.source.listings[lane.source.listings.length - 1]?.endedBy
  const n = lanes.length
  const removed = lanes.filter((lane) => lastEnd(lane) === 'removed').length
  const withdrawn = lanes.filter((lane) => lastEnd(lane) === 'withdrawn').length
  const since = Math.min(...lanes.map(laneStart))
  return `Listing history of ${integer.format(n)} ${
    n === 1 ? itemName : itemNamePlural
  } since ${formatDate(since)}: ${integer.format(n - removed - withdrawn)} still listed, ${integer.format(
    removed,
  )} removed by a ruling, ${integer.format(withdrawn)} withdrawn.`
}

/* ---------- Where they stand ---------- */

const STANDING: { tone: StatusTone; label: string }[] = [
  { tone: 'registered', label: 'Accepted' },
  { tone: 'window', label: 'Pending' },
  { tone: 'contested', label: 'Disputed' },
  { tone: 'neutral', label: 'Withdrawal ready' },
  { tone: 'off', label: 'Off the list' },
]

const Standing = ({
  summary,
  itemNamePlural,
}: {
  summary: StakeSummary
  itemNamePlural: string
}) => {
  const segments = STANDING.map(({ tone, label }) => ({
    key: tone,
    label,
    value: summary.tones[tone],
    color: TONE_COLOR[tone],
  }))
  const listed = summary.buckets.listed
  return (
    <Split>
      <StatusRing
        segments={segments}
        figure={integer.format(listed)}
        caption="listed"
        label={`${integer.format(summary.total)} ${itemNamePlural} by status: ${segments
          .map((segment) => `${segment.label} ${segment.value}`)
          .join(', ')}`}
      />
      <Tally aria-label="Entries by status">
        {segments.map((segment) => (
          <div
            key={segment.key}
            data-zero={segment.value === 0 ? true : undefined}
          >
            <StatusDot $tone={segment.key} aria-hidden />
            <dt>{segment.label}</dt>
            <dd>{integer.format(segment.value)}</dd>
          </div>
        ))}
      </Tally>
    </Split>
  )
}

/* ---------- Challenges ---------- */

const Challenges = ({
  summary,
  itemName,
}: {
  summary: StakeSummary
  itemName: string
}) => {
  const { removed, kept, open } = summary.challenges
  const resolved = removed + kept
  const rows: { tone: StatusTone; label: string; value: number }[] = [
    { tone: 'off', label: 'Removed', value: removed },
    { tone: 'registered', label: 'Kept', value: kept },
    { tone: 'contested', label: 'In court', value: open },
  ]
  return (
    <Split>
      {resolved > 0 ? (
        <RingGauge
          size={RING_SIZE}
          ratio={removed / resolved}
          from="var(--status-contested)"
          to="var(--status-off)"
          label={`Challenges that removed the ${itemName}: ${removed} of ${resolved} resolved`}
          caption="removed"
        />
      ) : null}
      <Tally aria-label="Challenges by outcome">
        {rows.map((row) => (
          <div key={row.tone} data-zero={row.value === 0 ? true : undefined}>
            <StatusDot $tone={row.tone} aria-hidden />
            <dt>{row.label}</dt>
            <dd>{integer.format(row.value)}</dd>
          </div>
        ))}
      </Tally>
    </Split>
  )
}

/* ---------- Bento ---------- */

export const StakeInsights = ({
  summary,
  loading,
  now,
  itemName,
  itemNamePlural,
  isHidden,
  onOpen,
}: {
  summary?: StakeSummary
  loading?: boolean
  now: number
  itemName: string
  itemNamePlural: string
  isHidden: (lane: StakeLane) => boolean
  onOpen?: (lane: StakeLane) => void
}) => {
  if (loading)
    return (
      <Bento aria-busy>
        <PanelSkeleton />
        <PanelSkeleton />
        <PanelSkeleton />
      </Bento>
    )
  if (!summary || summary.total === 0) return null
  const { challenges, partial } = summary
  const lanes = pickLanes(
    stakeLanes(summary.lanes, now, itemName, isHidden),
    now,
  )
  const keys = historyKeys(lanes)
  // A partial summary holds only the latest entries: say so wherever a
  // figure is drawn from it.
  const scope = scopeText(summary.total, itemName, itemNamePlural)
  const raised = (count: number) =>
    partial
      ? `${count === 0 ? 'None' : integer.format(count)} raised on the latest ${scope}.`
      : count === 0
        ? 'None raised yet.'
        : `${integer.format(count)} raised on this list.`
  return (
    <Bento aria-label={`${itemNamePlural} at a glance`}>
      <Panel $padding="none" style={{ ['--i' as string]: 1 }}>
        <PanelTop>
          <div>
            <PanelTitle>Listing history</PanelTitle>
            <PanelLine>
              One line per {itemName}, from submission to removal, withdrawal or
              today.
            </PanelLine>
          </div>
          <KeyList keys={keys} />
        </PanelTop>
        <LanePlot
          lanes={lanes}
          totalLanes={summary.lanes.length}
          now={now}
          ariaLabel={historyLabel(lanes, itemName, itemNamePlural)}
          onOpen={onOpen && ((lane: StakePlotLane) => onOpen(lane.source))}
        />
      </Panel>

      <Panel $padding="none" style={{ ['--i' as string]: 2 }}>
        <PanelTop>
          <div>
            <PanelTitle>Where they stand</PanelTitle>
            <PanelLine>
              {partial ? 'The latest ' : 'All '}
              {scope}, by status now.
            </PanelLine>
          </div>
        </PanelTop>
        {summary.tonesReady ? (
          <Standing summary={summary} itemNamePlural={itemNamePlural} />
        ) : (
          <SkeletonBlock $height="132px" />
        )}
      </Panel>

      <Panel $padding="none" style={{ ['--i' as string]: 3 }}>
        <PanelTop>
          <div>
            <PanelTitle>Challenges</PanelTitle>
            <PanelLine>{raised(challenges.total)}</PanelLine>
          </div>
        </PanelTop>
        <Challenges summary={summary} itemName={itemName} />
      </Panel>
    </Bento>
  )
}

export default StakeInsights
