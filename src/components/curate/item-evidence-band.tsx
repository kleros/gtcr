import React, { useEffect, useState } from 'react'
import styled, { keyframes } from 'styled-components'
import { formatAbsolute, formatAgo, formatDate } from 'utils/time'
import { AnimatedNumber } from './motion/animated-number'
import { Label } from './primitives'

/*
 * Evidence on the open request, where evidence lives: immediately above the
 * history and the composer (the design review's point 6.1 — the count used
 * to be the largest figure on a page whose case was being decided, which is
 * not what a reader looks for first).
 *
 * A band, not a panel: the count, who filed and when the last piece landed,
 * straight above the composer, which is the only control it needs. The
 * split and the time axis are charts, so their categories come from the viz
 * set and never from a status colour.
 */

const Band = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const Lead = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`

const Count = styled.p`
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);

  b {
    color: var(--color-text);
    font-family: var(--font-figure);
    font-size: 26px;
    line-height: 1;
    font-weight: 500;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
  }
`

const Bar = styled.div`
  display: flex;
  gap: 3px;
  height: 8px;

  span {
    min-width: 5px;
    border-radius: var(--radius-pill);
    transition: flex-grow 900ms var(--ease-out);
  }

  @media (prefers-reduced-motion: reduce) {
    span {
      transition: none;
    }
  }
`

const Key = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;

  li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-muted);
    font-size: 12px;
    line-height: 16px;
  }

  i {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-pill);
  }

  b {
    color: var(--color-text);
    font-family: var(--font-figure);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
`

const dotIn = keyframes`
  from { opacity: 0; transform: translateX(-50%) scale(0.4); }
`

/* Evidence over time: one dot per piece, placed by when it was filed;
   pieces filed close together stack, so bursts read as columns. */
const Strip = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--glass-border);
`

const Axis = styled.div`
  position: relative;
  margin: 0 5px;

  &::before {
    content: '';
    position: absolute;
    inset: auto 0 4px;
    height: 2px;
    border-radius: var(--radius-pill);
    background: var(--color-raised);
    box-shadow: inset 0 0 0 1px var(--glass-border);
  }

  i {
    position: absolute;
    width: 10px;
    height: 10px;
    border: 2px solid var(--color-bg);
    border-radius: var(--radius-pill);
    transform: translateX(-50%);
    animation: ${dotIn} 420ms var(--ease-out) both;
    animation-delay: calc(300ms + var(--i, 0) * 40ms);
  }

  @media (prefers-reduced-motion: reduce) {
    i {
      animation: none;
    }
  }
`

const AxisEnds = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--color-faint);
  font-size: 12px;
  line-height: 16px;
`

/** One piece of evidence, placed in time and attributed to a side. */
export interface EvidencePiece {
  /** Unix seconds. */
  at: number
  /** Which side filed it: an index into `sides`. */
  side: number
}

/** What the band draws: the request's evidence, as the page counts it. */
export interface EvidenceSummary {
  total: number
  /** Who filed, in the page's own words; sides with nothing are left out. */
  sides: { label: string; value: number }[]
  /** Every piece whose time is known, oldest first. */
  pieces: EvidencePiece[]
  /** The newest piece's time, if any. */
  last?: number
  /** The window the figures cover: when the request was made. */
  since: number
}

/** Chart categories, never a status colour (DESIGN.md). */
const VIZ = ['var(--viz-1)', 'var(--viz-2)', 'var(--viz-3)', 'var(--viz-4)']

const LANES = 7

export const ItemEvidenceBand = ({
  evidence,
  noun = 'request',
  now,
}: {
  evidence: EvidenceSummary
  /**
   * What the evidence was filed on, in the list kind's own words: a
   * Standard entry has requests, a Stake entry has submissions.
   */
  noun?: string
  now: number
}) => {
  // Grow the split bar from nothing on the first frame.
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const { total, sides, pieces, last, since } = evidence
  const span = Math.max(1, now - since)
  // Place each dot; one that would overlap a neighbour stacks above it.
  const placed: { x: number; lane: number }[] = []
  for (const piece of pieces) {
    const x = Math.min(100, Math.max(0, ((piece.at - since) / span) * 100))
    let lane = 0
    while (
      lane < LANES - 1 &&
      placed.some((dot) => dot.lane === lane && Math.abs(dot.x - x) < 4)
    )
      lane += 1
    placed.push({ x, lane })
  }
  const lanes = placed.reduce((most, dot) => Math.max(most, dot.lane + 1), 1)

  return (
    <Band aria-label={`Evidence on this ${noun}`}>
      <Lead>
        <Label $tone="faint">Evidence</Label>
        <Count>
          <b>
            <AnimatedNumber value={total} />
          </b>
          {total === 1 ? 'piece' : 'pieces'} on this {noun}
          {last !== undefined && (
            <span title={formatAbsolute(last)}>
              · last filed {formatAgo(last, now)}
            </span>
          )}
        </Count>
      </Lead>
      {sides.length > 0 && (
        <div
          role="img"
          aria-label={`Evidence on this ${noun} by who filed it, since the ${noun} was made: ${sides
            .map((side) => `${side.label} ${side.value}`)
            .join(', ')}`}
        >
          <Bar aria-hidden>
            {sides.map((side, index) => (
              <span
                key={side.label}
                style={{
                  flexGrow: shown ? side.value : 0.0001,
                  background: VIZ[index % VIZ.length],
                }}
              />
            ))}
          </Bar>
          <Key aria-hidden>
            {sides.map((side, index) => (
              <li key={side.label}>
                <i style={{ background: VIZ[index % VIZ.length] }} />
                {side.label} <b>{side.value}</b>
              </li>
            ))}
          </Key>
        </div>
      )}
      {pieces.length > 0 && (
        <Strip
          role="img"
          aria-label={`Evidence filed over time, from ${formatDate(
            since,
          )} to now: first ${formatAbsolute(
            pieces[0].at,
          )}, last ${formatAbsolute(pieces[pieces.length - 1].at)}`}
        >
          <Label $tone="faint">Filed over time</Label>
          <Axis aria-hidden style={{ height: 12 + lanes * 9 }}>
            {pieces.map((piece, index) => (
              <i
                key={`${piece.at}-${index}`}
                title={`${sides[piece.side]?.label ?? 'Filed'} · ${formatAbsolute(
                  piece.at,
                )}`}
                style={
                  {
                    left: `${placed[index].x}%`,
                    bottom: placed[index].lane * 9,
                    background: VIZ[piece.side % VIZ.length],
                    '--i': index,
                  } as React.CSSProperties
                }
              />
            ))}
          </Axis>
          <AxisEnds aria-hidden>
            <span title={formatAbsolute(since)}>{formatDate(since)}</span>
            <span>Now</span>
          </AxisEnds>
        </Strip>
      )}
    </Band>
  )
}

export default ItemEvidenceBand
