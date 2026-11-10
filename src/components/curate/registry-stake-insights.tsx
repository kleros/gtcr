import React, { useEffect, useId, useRef, useState } from 'react'
import styled, { keyframes } from 'styled-components'
import { formatDate, formatDuration } from 'utils/time'
import { Label, SkeletonBlock, StatusDot, Surface } from './primitives'
import type { StatusTone } from './primitives'
import { RingGauge } from './motion/ring-gauge'
import { reveal } from './motion/reveal'
import { CountUpText } from './registry-shared-count'
import type { StakeLane, StakeSummary } from './registry-stake-summary'

/*
 * The Stake registry's three drawings, all from the list's own entries:
 * - Listing history: one lane per entry on a shared time axis, from its
 *   submission to its removal, its withdrawal or today. An open listing is
 *   drawn in the listed colour (its stake is still locked) and its head dot
 *   carries the status the list rows show; amber where it sat in court;
 *   closed listings are muted. The keys name only the marks drawn. Each lane
 *   is a link: hover, focus or a first tap shows its dates; a click, Enter
 *   or a second tap opens the entry; the arrow keys move between lanes.
 * - Where they stand: the entries by the status the list rows show.
 * - Challenges: the share of resolved challenges that removed the entry.
 */

const integer = new Intl.NumberFormat('en-US')
const MAX_LANES = 24

const Bento = styled.section`
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  margin-top: 16px;

  @media (max-width: 1180px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));

    > :first-child {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 720px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
`

const Panel = styled(Surface)`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 22px;
  ${reveal}

  @media (max-width: 720px) {
    padding: 18px 16px;
  }
`

/* Placeholders sized to the panels they stand in for, per breakpoint, so the
   toolbar and the list do not jump when the summary arrives. */
const PanelSkeleton = styled(SkeletonBlock)`
  min-height: 274px;
  border-radius: var(--radius-lg);

  @media (max-width: 1180px) {
    min-height: 232px;

    &:first-child {
      min-height: 256px;
    }
  }

  @media (max-width: 720px) {
    min-height: 228px;

    &:first-child {
      min-height: 296px;
    }
  }
`

const PanelTop = styled.header`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px 20px;
`

const PanelTitle = styled.h3`
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: var(--fs-heading);
  line-height: var(--lh-heading);
  font-weight: 600;
  letter-spacing: -0.02em;
`

const PanelLine = styled.p`
  margin: 4px 0 0;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

/* ---------- Keys (legend) ---------- */

const Keys = styled.ul`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 16px;
  margin: 0;
  padding: 2px 0 0;
  list-style: none;

  li {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: var(--color-muted);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
    white-space: nowrap;
  }
`

const KeyLine = styled.i<{ $color: string }>`
  width: 14px;
  height: 4px;
  border-radius: var(--radius-pill);
  background: ${({ $color }) => $color};
`

const KeyDot = styled.i<{ $color: string }>`
  width: 8px;
  height: 8px;
  border-radius: var(--radius-pill);
  background: ${({ $color }) => $color};
  box-shadow: 0 0 0 3px
    color-mix(in srgb, ${({ $color }) => $color} 22%, transparent);
`

/* The withdrawal mark: a stop bar across the end of the lane. */
const KeyTick = styled.i`
  width: 2px;
  height: 11px;
  border-radius: var(--radius-pill);
  background: var(--color-muted);
`

/* ---------- Listing history ---------- */

const TONE_COLOR: Record<StatusTone, string> = {
  registered: 'var(--status-registered)',
  window: 'var(--status-window)',
  contested: 'var(--status-contested)',
  neutral: 'var(--status-neutral)',
  off: 'var(--status-off)',
}

/** An open listing: on the list, with its stake locked. */
const LISTED_COLOR = 'var(--status-registered)'
/** A closed listing: the listed colour, muted, and opaque. */
const CLOSED_COLOR =
  'color-mix(in srgb, var(--status-registered) 42%, var(--color-surface))'

const pulse = keyframes`
  0% { transform: scale(0.8); opacity: 0.6; }
  70%, 100% { transform: scale(2.8); opacity: 0; }
`

const Plot = styled.figure`
  position: relative;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 8px;
  min-height: 0;
  margin: 0;

  svg {
    display: block;
    width: 100%;
    overflow: visible;
  }

  /* The lanes wipe in from the left once the plot is in view; the heads
     land after them. */
  .lanes {
    clip-path: inset(-24px 100% -24px -24px);
    transition: clip-path 1200ms cubic-bezier(0.16, 1, 0.3, 1) 150ms;
  }

  &[data-in='true'] .lanes {
    clip-path: inset(-24px -24px -24px -24px);
  }

  .head {
    opacity: 0;
    transition: opacity 420ms cubic-bezier(0.16, 1, 0.3, 1) 1100ms;
  }

  &[data-in='true'] .head {
    opacity: 1;
  }

  .lane {
    transition: opacity 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  &[data-active] .lane:not([data-on]) {
    opacity: 0.32;
  }

  .ping {
    transform-box: fill-box;
    transform-origin: center;
    animation: ${pulse} 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
  }

  .hit {
    cursor: pointer;
    outline: none;
    stroke: transparent;
    stroke-width: 1.5;
    transition: stroke 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .hit:focus-visible {
    stroke: var(--color-primary);
  }

  @media (prefers-reduced-motion: reduce) {
    .lanes,
    .head {
      transition: none;
    }

    .ping {
      animation: none;
      opacity: 0;
    }
  }
`

const Axis = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--color-faint);
  font-size: var(--fs-label);
  line-height: var(--lh-label);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

const Tip = styled.div`
  position: absolute;
  z-index: 3;
  width: max-content;
  max-width: 300px;
  padding: 10px 12px;
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  /* The raised tint over a solid surface: never see-through. */
  background:
    linear-gradient(var(--color-raised), var(--color-raised)),
    var(--color-surface);
  box-shadow: var(--shadow-overlay);
  pointer-events: none;
  transform: translate(-50%, calc(-100% - 12px));
  transition:
    left 160ms cubic-bezier(0.16, 1, 0.3, 1),
    top 160ms cubic-bezier(0.16, 1, 0.3, 1);

  b,
  span,
  em {
    display: block;
    overflow: hidden;
    font-size: var(--fs-small);
    line-height: var(--lh-small);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  b {
    color: var(--color-text);
    font-weight: 500;
  }

  span {
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
  }

  em {
    margin-top: 4px;
    color: var(--color-primary);
    font-style: normal;
    font-weight: 500;
  }
`

const useInView = <T extends Element>() => {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold: 0.35 },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [])
  return [ref, inView] as const
}

const useWidth = <T extends Element>() => {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    setWidth(node.getBoundingClientRect().width)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width
      if (next) setWidth(next)
    })
    ro.observe(node)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

const laneStart = (lane: StakeLane) =>
  Math.min(...lane.listings.map((listing) => listing.start))
const laneLatest = (lane: StakeLane, now: number) =>
  Math.max(
    ...lane.listings.map((listing) => listing.end ?? now),
    ...lane.challenges.map((challenge) => challenge.end ?? now),
  )

/** The most recently active lanes, then oldest first: a waterfall. */
const pickLanes = (allLanes: StakeLane[], now: number): StakeLane[] => {
  const recent = allLanes
    .filter((lane) => lane.listings.length > 0)
    .sort((a, b) => laneLatest(b, now) - laneLatest(a, now))
    .slice(0, MAX_LANES)
  return recent.sort((a, b) => laneStart(a) - laneStart(b))
}

/** The tone of an open listing's head: the status the list row shows. */
const headTone = (lane: StakeLane): StatusTone => {
  const tone = lane.tone ?? 'registered'
  return tone === 'off' ? 'registered' : tone
}

/** One key per kind of mark the drawing actually holds. */
const historyKeys = (lanes: StakeLane[]) => {
  const heads = new Set<StatusTone>()
  const ends = new Set<string>()
  let closed = false
  let challenged = false
  lanes.forEach((lane) => {
    lane.listings.forEach((listing) => {
      if (listing.end === undefined) heads.add(headTone(lane))
      else {
        closed = true
        if (listing.endedBy) ends.add(listing.endedBy)
      }
    })
    if (lane.challenges.length > 0) challenged = true
  })
  // Lines first (what a lane is made of), then the marks at its head or end.
  const keys: { key: string; label: string; mark: React.ReactNode }[] = []
  if (heads.size > 0)
    keys.push({
      key: 'listed',
      label: 'Listed',
      mark: <KeyLine $color={LISTED_COLOR} />,
    })
  if (closed)
    keys.push({
      key: 'closed',
      label: 'Was listed',
      mark: <KeyLine $color={CLOSED_COLOR} />,
    })
  if (challenged || heads.has('contested'))
    keys.push({
      key: 'court',
      label: 'In court',
      mark: <KeyLine $color={TONE_COLOR.contested} />,
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

const ordinal = (n: number) => {
  const tail = n % 100
  if (tail >= 11 && tail <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

/** "236 days"; under a day, "13h 20m". */
const onListFor = (seconds: number) => {
  const days = Math.floor(seconds / 86400)
  if (days < 1) return formatDuration(seconds)
  return `${integer.format(days)} day${days === 1 ? '' : 's'}`
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

const ListingHistory = ({
  lanes,
  totalLanes,
  now,
  itemName,
  itemNamePlural,
  isHidden,
  onOpen,
}: {
  /** The lanes to draw, from `pickLanes`. */
  lanes: StakeLane[]
  /** Every lane of the list, drawn or not. */
  totalLanes: number
  now: number
  itemName: string
  itemNamePlural: string
  isHidden: (lane: StakeLane) => boolean
  onOpen?: (lane: StakeLane) => void
}) => {
  const uid = useId().replace(/:/g, '')
  const [viewRef, inView] = useInView<HTMLElement>()
  const [boxRef, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  // The lane whose dates a touch tap has shown: a second tap opens it.
  const [armed, setArmed] = useState<number | null>(null)
  // The one lane in the tab order; the arrow keys move it.
  const [focusIndex, setFocusIndex] = useState(0)
  const pointerType = useRef('mouse')
  const hits = useRef<(SVGRectElement | null)[]>([])

  if (lanes.length === 0) return null

  const t0 = Math.min(...lanes.map(laneStart))
  const span = Math.max(now - t0, 86400)
  const n = lanes.length
  const plotH = Math.max(112, n * 14)
  const pitch = Math.min(34, plotH / n)
  const top = (plotH - pitch * n) / 2
  const stroke = n <= 4 ? 8 : Math.max(4, Math.min(7, pitch * 0.3))
  const padL = stroke
  const padR = 14
  const plotW = Math.max(0, width - padL - padR)
  const x = (t: number) => padL + ((t - t0) / span) * plotW
  const y = (i: number) => top + i * pitch + pitch / 2

  const lastEnd = (lane: StakeLane) =>
    lane.listings[lane.listings.length - 1]?.endedBy
  const removed = lanes.filter((lane) => lastEnd(lane) === 'removed').length
  const withdrawn = lanes.filter((lane) => lastEnd(lane) === 'withdrawn').length
  const listed = n - removed - withdrawn
  const ariaLabel = `Listing history of ${integer.format(n)} ${
    n === 1 ? itemName : itemNamePlural
  } since ${formatDate(t0)}: ${integer.format(listed)} still listed, ${integer.format(
    removed,
  )} removed by a ruling, ${integer.format(withdrawn)} withdrawn.`

  const nameOf = (lane: StakeLane) =>
    isHidden(lane) ? `Hidden ${itemName}` : (lane.name ?? `Unnamed ${itemName}`)

  const open = (index: number) => {
    const lane = lanes[index]
    if (lane && onOpen) onOpen(lane)
  }

  // A mouse opens on the first click (hover already showed the dates); a
  // touch shows the dates on the first tap and opens on the second.
  const onTap = (index: number) => {
    if (pointerType.current === 'touch' && armed !== index) {
      setArmed(index)
      setActive(index)
      return
    }
    open(index)
  }

  const focusLane = (index: number) => {
    const next = Math.min(Math.max(index, 0), n - 1)
    hits.current[next]?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    switch (event.key) {
      case 'Enter':
        event.preventDefault()
        open(index)
        break
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault()
        focusLane(index + 1)
        break
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault()
        focusLane(index - 1)
        break
      case 'Home':
        event.preventDefault()
        focusLane(0)
        break
      case 'End':
        event.preventDefault()
        focusLane(n - 1)
        break
      case 'Escape':
        setActive(null)
        break
      default:
    }
  }

  const activeLane = active === null ? undefined : lanes[active]
  const activeTip = activeLane
    ? {
        name: nameOf(activeLane),
        lines: laneLines(activeLane, now),
        tapAgain: onOpen && armed === active,
        left: Math.min(
          Math.max(x(laneLatest(activeLane, now)), 130),
          Math.max(130, width - 130),
        ),
        top: y(active ?? 0),
      }
    : undefined

  return (
    <Plot
      ref={viewRef}
      data-in={inView}
      data-active={active === null ? undefined : true}
    >
      <div ref={boxRef} style={{ position: 'relative' }}>
        {width > 0 && (
          <svg
            width={width}
            height={plotH}
            viewBox={`0 0 ${width} ${plotH}`}
            role="group"
            aria-label={ariaLabel}
            onMouseLeave={() => setActive(null)}
          >
            <defs>
              <filter
                id={`glow-${uid}`}
                filterUnits="userSpaceOnUse"
                x={0}
                y={-20}
                width={width}
                height={plotH + 40}
              >
                <feGaussianBlur stdDeviation="3" />
              </filter>
            </defs>
            {/* The active lane's track, to read it across to the axis. */}
            {active !== null && (
              <path
                aria-hidden
                d={`M${padL} ${y(active)}H${padL + plotW}`}
                strokeWidth={1}
                strokeLinecap="round"
                strokeDasharray="2 4"
                style={{ stroke: 'var(--color-border-strong)' }}
              />
            )}
            <g className="lanes" aria-hidden>
              {lanes.map((lane, index) => {
                const cy = y(index)
                return (
                  <g
                    key={lane.id}
                    className="lane"
                    data-on={active === index ? true : undefined}
                  >
                    {lane.listings.map((listing) => {
                      const isOpen = listing.end === undefined
                      const x0 = x(listing.start)
                      const x1 = Math.max(x(listing.end ?? now), x0 + 0.5)
                      const color = isOpen ? LISTED_COLOR : CLOSED_COLOR
                      return (
                        <g key={listing.start}>
                          {isOpen && (
                            <path
                              d={`M${x0} ${cy}H${x1}`}
                              strokeWidth={stroke + 4}
                              strokeLinecap="round"
                              filter={`url(#glow-${uid})`}
                              style={{ stroke: color, opacity: 0.45 }}
                            />
                          )}
                          <path
                            d={`M${x0} ${cy}H${x1}`}
                            strokeWidth={stroke}
                            strokeLinecap="round"
                            style={{ stroke: color }}
                          />
                        </g>
                      )
                    })}
                    {lane.challenges.map((challenge) => {
                      const x0 = x(challenge.start)
                      const x1 = Math.max(x(challenge.end ?? now), x0 + 0.5)
                      return (
                        <path
                          key={challenge.start}
                          d={`M${x0} ${cy}H${x1}`}
                          strokeWidth={stroke}
                          strokeLinecap="round"
                          style={{ stroke: 'var(--status-contested)' }}
                        />
                      )
                    })}
                  </g>
                )
              })}
            </g>
            <g className="head" aria-hidden>
              {lanes.map((lane, index) => {
                const cy = y(index)
                const tone = headTone(lane)
                const color = TONE_COLOR[tone]
                const live = tone === 'window' || tone === 'contested'
                return (
                  <g
                    key={lane.id}
                    className="lane"
                    data-on={active === index ? true : undefined}
                  >
                    {lane.listings.map((listing) => {
                      if (listing.end === undefined)
                        return (
                          <g key={listing.start}>
                            {live && (
                              <circle
                                className="ping"
                                cx={x(now)}
                                cy={cy}
                                r={stroke * 0.7}
                                style={{ fill: color }}
                              />
                            )}
                            {tone === 'neutral' && (
                              <circle
                                cx={x(now)}
                                cy={cy}
                                r={stroke * 1.4}
                                style={{ fill: color, opacity: 0.3 }}
                              />
                            )}
                            <circle
                              cx={x(now)}
                              cy={cy}
                              r={stroke * 0.85}
                              style={{
                                fill: color,
                                stroke: 'var(--color-surface)',
                                strokeWidth: 1.5,
                              }}
                            />
                          </g>
                        )
                      const xe = x(listing.end)
                      return listing.endedBy === 'removed' ? (
                        <circle
                          key={listing.start}
                          cx={xe}
                          cy={cy}
                          r={stroke * 0.8}
                          style={{
                            fill: 'var(--status-off)',
                            stroke: 'var(--color-surface)',
                            strokeWidth: 1.5,
                          }}
                        />
                      ) : (
                        <path
                          key={listing.start}
                          d={`M${xe} ${cy - stroke * 0.95}V${cy + stroke * 0.95}`}
                          strokeWidth={2}
                          strokeLinecap="round"
                          style={{ stroke: 'var(--color-muted)' }}
                        />
                      )
                    })}
                  </g>
                )
              })}
            </g>
            {lanes.map((lane, index) => (
              <rect
                key={lane.id}
                ref={(node) => {
                  hits.current[index] = node
                }}
                className="hit"
                x={1}
                y={top + index * pitch + 1}
                width={Math.max(0, width - 2)}
                height={Math.max(0, pitch - 2)}
                rx={6}
                fill="transparent"
                role={onOpen ? 'link' : 'img'}
                tabIndex={index === focusIndex ? 0 : -1}
                aria-label={`${nameOf(lane)}. ${laneLines(lane, now).join('. ')}.`}
                onPointerDown={(event) => {
                  pointerType.current = event.pointerType
                }}
                onPointerEnter={(event) => {
                  if (event.pointerType === 'mouse') setActive(index)
                }}
                onFocus={() => {
                  setFocusIndex(index)
                  setActive(index)
                }}
                onBlur={() => {
                  setActive((current) => (current === index ? null : current))
                  setArmed((current) => (current === index ? null : current))
                }}
                onKeyDown={(event) => onKeyDown(event, index)}
                onClick={onOpen ? () => onTap(index) : undefined}
              />
            ))}
          </svg>
        )}
        {!width && <div style={{ height: plotH }} />}
        {activeTip && (
          <Tip style={{ left: activeTip.left, top: activeTip.top }} aria-hidden>
            <b>{activeTip.name}</b>
            {activeTip.lines.map((line) => (
              <span key={line}>{line}</span>
            ))}
            {activeTip.tapAgain && <em>Tap again to open</em>}
          </Tip>
        )}
      </div>
      <Axis aria-hidden>
        <span>{formatDate(t0)}</span>
        <span>{formatDate(t0 + span / 2)}</span>
        <span>Today</span>
      </Axis>
      {totalLanes > lanes.length && (
        <Label $tone="faint">
          Latest {integer.format(lanes.length)} of {integer.format(totalLanes)}
        </Label>
      )}
    </Plot>
  )
}

/* ---------- Where they stand ---------- */

const Split = styled.div`
  display: flex;
  align-items: center;
  gap: 18px;
  flex: 1 1 auto;

  @media (max-width: 380px) {
    gap: 14px;
  }
`

/* A ring of the entries by status: one arc per status, sized by its count,
   on a faint halo of its own colour; a single status closes the ring. The
   arcs wait, paused on their first frame, until the ring is in view. */
const ringIn = keyframes`
  from { stroke-dasharray: 0 400; }
`

/** The ring's size; its figure scales with it, as RingGauge's does. */
const RING_SIZE = 124

const RingWrap = styled.figure`
  position: relative;
  flex: 0 0 auto;
  width: ${RING_SIZE}px;
  height: ${RING_SIZE}px;
  margin: 0;

  svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
    transform: rotate(-90deg);
  }

  .seg {
    animation: ${ringIn} 1100ms cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-delay: var(--d, 0ms);
    animation-play-state: paused;
  }

  &[data-in='true'] .seg {
    animation-play-state: running;
  }

  figcaption {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    pointer-events: none;
  }

  b {
    color: var(--color-text);
    font-family: var(--font-figure);
    font-size: ${RING_SIZE * 0.2}px;
    line-height: 1;
    font-weight: 500;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
  }

  figcaption > span {
    color: var(--color-faint);
    font-size: var(--fs-label);
    line-height: var(--lh-label);
  }

  @media (prefers-reduced-motion: reduce) {
    .seg {
      animation: none;
    }
  }
`

const RING_R = 52
const RING_C = 2 * Math.PI * RING_R

const StatusRing = ({
  segments,
  figure,
  caption,
  label,
}: {
  segments: { key: string; value: number; color: string }[]
  figure: string
  caption: string
  label: string
}) => {
  const [ref, inView] = useInView<HTMLElement>()
  const sum = segments.reduce((total, segment) => total + segment.value, 0)
  const visible = segments.filter((segment) => segment.value > 0)
  const gap = visible.length > 1 ? 5 : 0
  let cursor = 0
  const arcs = visible.map((segment, index) => {
    const share = (segment.value / sum) * RING_C
    const length = Math.max(share - gap, 2)
    const arc = {
      ...segment,
      length,
      offset: -(cursor + gap / 2),
      delay: index * 120,
    }
    cursor += share
    return arc
  })
  return (
    <RingWrap ref={ref} data-in={inView} role="img" aria-label={label}>
      <svg viewBox="0 0 140 140" aria-hidden>
        <circle
          cx={70}
          cy={70}
          r={RING_R}
          fill="none"
          strokeWidth={12}
          style={{ stroke: 'var(--color-raised)' }}
        />
        {arcs.map((arc) => (
          <circle
            key={`${arc.key}-halo`}
            className="seg"
            cx={70}
            cy={70}
            r={RING_R}
            fill="none"
            strokeWidth={26}
            style={
              {
                stroke: arc.color,
                opacity: 0.14,
                strokeDasharray: `${arc.length} ${RING_C - arc.length}`,
                strokeDashoffset: arc.offset,
                '--d': `${arc.delay}ms`,
              } as React.CSSProperties
            }
          />
        ))}
        {arcs.map((arc) => (
          <circle
            key={arc.key}
            className="seg"
            cx={70}
            cy={70}
            r={RING_R}
            fill="none"
            strokeWidth={12}
            style={
              {
                stroke: arc.color,
                strokeDasharray: `${arc.length} ${RING_C - arc.length}`,
                strokeDashoffset: arc.offset,
                '--d': `${arc.delay}ms`,
              } as React.CSSProperties
            }
          />
        ))}
      </svg>
      <figcaption>
        {/* The figure climbs with the arcs, once the ring is in view. */}
        <b>
          <CountUpText value={inView ? figure : ''} />
        </b>
        <span>{caption}</span>
      </figcaption>
    </RingWrap>
  )
}

const Tally = styled.dl`
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;

  > div {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
  }

  dt {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    color: var(--color-muted);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  dd {
    margin: 0;
    color: var(--color-text);
    font-family: var(--font-figure);
    font-size: var(--fs-body);
    line-height: var(--lh-small);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  > div[data-zero] dd {
    color: var(--color-faint);
  }
`

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
  const lanes = pickLanes(summary.lanes, now)
  const keys = historyKeys(lanes)
  // A partial summary holds only the latest entries: say so wherever a
  // figure is drawn from it.
  const scope = `${integer.format(summary.total)} ${
    summary.total === 1 ? itemName : itemNamePlural
  }`
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
          {keys.length > 0 && (
            <Keys aria-label="Key">
              {keys.map((key) => (
                <li key={key.key}>
                  <span aria-hidden style={{ display: 'inline-flex' }}>
                    {key.mark}
                  </span>
                  {key.label}
                </li>
              ))}
            </Keys>
          )}
        </PanelTop>
        <ListingHistory
          lanes={lanes}
          totalLanes={summary.lanes.length}
          now={now}
          itemName={itemName}
          itemNamePlural={itemNamePlural}
          isHidden={isHidden}
          onOpen={onOpen}
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
