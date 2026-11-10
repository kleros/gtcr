import React, { useCallback, useId, useMemo, useRef, useState } from 'react'
import styled, { keyframes } from 'styled-components'
import { formatAbsolute, formatDate } from 'utils/time'
import { Label } from './primitives'

/*
 * The life of a Classic list at a glance: every entry counted once, in the
 * quarter of its latest request (years when the span is long), up to today,
 * so a quiet list shows its quiet stretch. The caption says what a bar
 * counts, the scale shows the peak, and each column is a button: hover,
 * tap or arrow keys show its quarter and count in a tooltip. The bucket
 * holding the latest request is the bright one with a lit head, and that
 * request's date sits above the plot (absolute UTC on hover).
 *
 * When the page could not load every entry (`complete` false) the times are
 * the newest entries only: the oldest bucket then holds just part of its
 * entries, so it is dropped and the caption says "Newest N". Every bucket
 * left is an exact count.
 */

const MAX_QUARTERS = 40

interface Bucket {
  key: number
  label: string
  count: number
}

const quarterIndex = (seconds: number) => {
  const date = new Date(seconds * 1000)
  return date.getUTCFullYear() * 4 + Math.floor(date.getUTCMonth() / 3)
}

const yearOf = (seconds: number) => new Date(seconds * 1000).getUTCFullYear()

const integer = new Intl.NumberFormat('en-US')

/** Quarters from the first activity to today; years when that is too many. */
const toBuckets = (times: number[], now: number, complete: boolean) => {
  const first = Math.min(...times)
  const byYear = quarterIndex(now) - quarterIndex(first) + 1 > MAX_QUARTERS
  const keyOf = byYear ? yearOf : quarterIndex
  const labelOf = (key: number) =>
    byYear ? String(key) : `Q${(key % 4) + 1} ${Math.floor(key / 4)}`
  const start = keyOf(first)
  const end = Math.max(keyOf(now), keyOf(Math.max(...times)))
  const counts = new Map<number, number>()
  times.forEach((time) => {
    const key = keyOf(time)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })
  const buckets: Bucket[] = []
  // Newest first, every entry after the oldest loaded one is loaded too, so
  // only the oldest bucket can be partial.
  for (let key = complete ? start : start + 1; key <= end; key += 1)
    buckets.push({ key, label: labelOf(key), count: counts.get(key) ?? 0 })
  return {
    buckets,
    keyOf,
    shown: buckets.reduce((sum, bucket) => sum + bucket.count, 0),
  }
}

const grow = keyframes`
  from { transform: scaleY(0); }
`

const pop = keyframes`
  from { opacity: 0; transform: scale(0.4); }
`

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1 1 420px;
  max-width: 560px;
  min-width: 0;

  @media (max-width: 860px) {
    max-width: none;
  }
`

const Head = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px 24px;
`

const Caption = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`

const Note = styled.span`
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  text-wrap: pretty;
`

const Latest = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex: 0 0 auto;
  margin-left: auto;

  time {
    color: var(--color-text);
    font-family: var(--font-figure);
    font-size: 18px;
    line-height: 22px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
`

/* The scale sits in the first column, the bars and the dates in the second,
   so the dates line up under the bars. */
const Plot = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: 10px;
  row-gap: 6px;
`

/* 10px of headroom keep the latest bucket's head inside the plot. */
const HEADROOM = 10
const BAR_HEIGHT = 56

const Scale = styled.div`
  position: relative;
  min-width: 12px;
  height: ${HEADROOM + BAR_HEIGHT}px;
  color: var(--color-faint);
  font-family: var(--font-mono);
  font-size: 10px;
  line-height: 12px;
  font-variant-numeric: tabular-nums;
  text-align: right;

  span {
    position: absolute;
    right: 0;
  }

  /* Each label is centred on the level it names. */
  span:first-child {
    top: ${HEADROOM - 6}px;
  }

  span:last-child {
    bottom: -6px;
  }
`

const Bars = styled.div`
  position: relative;
  display: flex;
  align-items: stretch;
  height: ${HEADROOM + BAR_HEIGHT}px;
  padding-top: ${HEADROOM}px;
  box-sizing: border-box;
  /* Horizontal drags scrub the columns; vertical ones still scroll. */
  touch-action: pan-y;
`

/* A column is a full-height button holding one bar, so the whole plot is
   the hit area. Past buckets are drawn at 80% of the primary (3.5:1 or more
   on the frame in every theme); the hovered or focused one and the latest
   one are full strength, and the latest also carries a glow and a head. */
const Column = styled.button`
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  flex: 1 1 0;
  min-width: 4px;
  height: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: none;
  cursor: pointer;

  &::after {
    content: '';
    display: block;
    width: 62%;
    min-width: 2px;
    max-width: 12px;
    height: max(2px, calc(var(--v) * 100%));
    border-radius: 2px;
    background: color-mix(in srgb, var(--color-primary) 80%, transparent);
    transform-origin: bottom;
    transition: background var(--dur-hover) var(--ease-out);
    animation: ${grow} 520ms var(--ease-out) both;
    animation-delay: calc(240ms + var(--i) * 16ms);
  }

  &[data-zero]::after {
    height: 2px;
    background: color-mix(in srgb, var(--color-faint) 60%, transparent);
  }

  &[data-active]::after {
    background: var(--color-primary);
  }

  &[data-active][data-zero]::after {
    background: var(--color-faint);
  }

  &[data-latest]::after {
    background: var(--color-primary);
    box-shadow: 0 0 10px
      color-mix(in srgb, var(--color-primary) 70%, transparent);
  }

  /* The latest request's bucket carries a lit head, so it reads even when
     its bar is a few pixels tall next to a busy past. */
  &[data-latest]::before {
    content: '';
    position: absolute;
    left: 50%;
    bottom: calc(max(2px, var(--v) * 100%) + 3px);
    width: 5px;
    height: 5px;
    margin-left: -2.5px;
    border-radius: 50%;
    background: var(--color-primary);
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--color-primary) 22%, transparent),
      0 0 8px var(--color-primary);
    animation: ${pop} 420ms var(--ease-out) both;
    animation-delay: calc(560ms + var(--i) * 16ms);
  }

  @media (prefers-reduced-motion: reduce) {
    &::after,
    &::before {
      animation: none;
    }
  }
`

/* Anchored over its column; --x (0 to 1) slides the anchor from the
   tooltip's left edge to its right edge, so it never leaves the plot. */
const Tip = styled.div`
  position: absolute;
  z-index: 2;
  bottom: calc(100% + 6px);
  left: calc(var(--x) * 100%);
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  background: var(--color-surface);
  box-shadow: var(--shadow-overlay);
  pointer-events: none;
  transform: translateX(calc(var(--x) * -100%));
  white-space: nowrap;

  span {
    color: var(--color-muted);
    font-size: 12px;
    line-height: 16px;
  }

  strong {
    color: var(--color-text);
    font-family: var(--font-figure);
    font-size: 13px;
    line-height: 18px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
`

const Axis = styled.div`
  grid-column: 2;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--color-faint);
  font-family: var(--font-mono);
  font-size: 10px;
  line-height: 12px;
  font-variant-numeric: tabular-nums;
`

const NAV_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End'])

export const ClassicLifetime = ({
  times,
  complete,
  now,
  itemName,
  itemNamePlural,
}: {
  /** Unix seconds of each entry's latest request. */
  times: number[]
  /** False when `times` covers only the newest entries of the list. */
  complete: boolean
  now: number
  itemName: string
  itemNamePlural: string
}) => {
  const captionId = useId()
  const barsRef = useRef<HTMLDivElement>(null)
  const focused = useRef(false)
  const [active, setActive] = useState<number | null>(null)
  const [focusIndex, setFocusIndex] = useState<number | null>(null)

  const valid = useMemo(
    () => times.filter((time) => Number.isFinite(time) && time > 0),
    [times],
  )
  // Buckets move with the calendar, not with the ticking clock.
  const currentQuarter = quarterIndex(now)
  const view = useMemo(
    () => (valid.length > 0 ? toBuckets(valid, now, complete) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [valid, complete, currentQuarter],
  )

  const count = view?.buckets.length ?? 0
  const columnAt = useCallback(
    (index: number) =>
      barsRef.current?.querySelectorAll<HTMLButtonElement>('button')[index],
    [],
  )
  const indexAt = (clientX: number) => {
    const rect = barsRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || count === 0) return null
    const index = Math.floor(((clientX - rect.left) / rect.width) * count)
    return Math.min(count - 1, Math.max(0, index))
  }

  if (!view) return null

  const latest = Math.max(...valid)
  const latestKey = view.keyOf(latest)
  const latestIndex = view.buckets.findIndex(
    (bucket) => bucket.key === latestKey,
  )
  const rovingIndex = focusIndex ?? (latestIndex >= 0 ? latestIndex : count - 1)
  const max = Math.max(0, ...view.buckets.map((bucket) => bucket.count))
  const nameFor = (value: number) => (value === 1 ? itemName : itemNamePlural)
  const activeBucket = active !== null ? view.buckets[active] : undefined

  const onPointerMove = (event: React.PointerEvent) => {
    const index = indexAt(event.clientX)
    if (index !== null) setActive(index)
  }
  const onPointerLeave = (event: React.PointerEvent) => {
    // A tap leaves its tooltip up until focus moves away.
    if (event.pointerType === 'mouse')
      setActive(focused.current ? rovingIndex : null)
  }
  const onBlur = (event: React.FocusEvent) => {
    if (barsRef.current?.contains(event.relatedTarget as Node | null)) return
    focused.current = false
    setActive(null)
  }
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setActive(null)
      return
    }
    if (!NAV_KEYS.has(event.key) || count === 0) return
    event.preventDefault()
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? count - 1
          : Math.min(
              count - 1,
              Math.max(0, rovingIndex + (event.key === 'ArrowRight' ? 1 : -1)),
            )
    columnAt(next)?.focus()
  }

  const first = view.buckets[0]
  const last = view.buckets[count - 1]

  return (
    <Wrap>
      <Head>
        {count > 0 && (
          <Caption id={captionId}>
            <Label $tone="faint">{itemNamePlural} by latest request</Label>
            <Note>
              {complete ? 'All' : 'Newest'} {integer.format(view.shown)}, each
              counted once at its latest request
            </Note>
          </Caption>
        )}
        <Latest>
          <Label $tone="faint">Latest request</Label>
          <time
            dateTime={new Date(latest * 1000).toISOString()}
            title={formatAbsolute(latest)}
          >
            {formatDate(latest)}
          </time>
        </Latest>
      </Head>

      {count > 0 && (
        <Plot>
          <Scale aria-hidden>
            <span>{integer.format(max)}</span>
            <span>0</span>
          </Scale>
          <Bars
            ref={barsRef}
            role="group"
            aria-labelledby={captionId}
            onPointerMove={onPointerMove}
            onPointerLeave={onPointerLeave}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
          >
            {view.buckets.map((bucket, index) => (
              <Column
                key={bucket.key}
                type="button"
                tabIndex={index === rovingIndex ? 0 : -1}
                aria-label={`${bucket.label}: ${integer.format(bucket.count)} ${nameFor(bucket.count)}`}
                data-zero={bucket.count === 0 ? '' : undefined}
                data-latest={index === latestIndex ? '' : undefined}
                data-active={index === active ? '' : undefined}
                onFocus={() => {
                  focused.current = true
                  setFocusIndex(index)
                  setActive(index)
                }}
                // Safari does not focus a tapped button; focus it so the
                // tooltip closes when focus moves on.
                onClick={(event) => event.currentTarget.focus()}
                style={
                  {
                    '--v': max > 0 ? bucket.count / max : 0,
                    '--i': index,
                  } as React.CSSProperties
                }
              />
            ))}
            {activeBucket && active !== null && (
              <Tip
                aria-hidden
                style={
                  {
                    '--x': count > 1 ? active / (count - 1) : 0.5,
                  } as React.CSSProperties
                }
              >
                <span>{activeBucket.label}</span>
                <strong>
                  {integer.format(activeBucket.count)}{' '}
                  {nameFor(activeBucket.count)}
                </strong>
              </Tip>
            )}
          </Bars>
          <Axis aria-hidden>
            <span>{first.label}</span>
            <span>{last.label}</span>
          </Axis>
        </Plot>
      )}
    </Wrap>
  )
}

export default ClassicLifetime
