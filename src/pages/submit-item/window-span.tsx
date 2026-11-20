import React from 'react'
import styled, { keyframes } from 'styled-components'
import { formatDuration, formatDurationLong } from 'utils/time'
import { useInView } from './use-in-view'

/*
 * The registry's window (challenge period, or Stake Curate's submission period)
 * drawn as what it is: a span of time on a line. The lit node on the left is
 * the moment the transaction is mined, the hollow node on the right is the
 * window's end, and the line between them is cut into one block per unit
 * (a day for a 3.5-day window: three full blocks and a half one), each
 * boundary labelled with the time since mining. Nothing has elapsed yet, so
 * the blocks are time ahead, drawn quiet rather than filled. The blocks draw
 * in left to right once the line is in view.
 */

const UNITS = [
  { seconds: 7 * 24 * 3600, name: 'week' },
  { seconds: 24 * 3600, name: 'day' },
  { seconds: 6 * 3600, name: '6 hours' },
  { seconds: 3600, name: 'hour' },
  { seconds: 600, name: '10 minutes' },
  { seconds: 60, name: 'minute' },
]

/** The unit that cuts the window into 2 to 24 blocks. */
export const segmentUnit = (seconds: number) =>
  UNITS.find(
    (unit) => seconds / unit.seconds >= 2 && seconds / unit.seconds <= 24,
  ) ?? UNITS.find((unit) => seconds / unit.seconds >= 1)

/** Room for a node plus its gap on each side of the blocks. */
const SIDE = 20

const Figure = styled.figure`
  position: relative;
  margin: 12px 0 0;
`

const Line = styled.div`
  position: relative;
  height: 14px;
`

const Blocks = styled.div`
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: ${SIDE}px;
  right: ${SIDE}px;
`

const Block = styled.span`
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--status-window) 16%, transparent);
  box-shadow: inset 0 0 0 1px
    color-mix(in srgb, var(--status-window) 42%, transparent);
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform 560ms var(--ease-out) var(--d, 0ms);

  [data-drawn='true'] & {
    transform: none;
  }

  @media (prefers-reduced-motion: reduce) {
    transform: none;
    transition: none;
  }
`

const ping = keyframes`
  from { transform: scale(1); opacity: 0.6; }
  to { transform: scale(2.6); opacity: 0; }
`

const StartNode = styled.span`
  position: absolute;
  top: 1px;
  left: 0;
  width: 12px;
  height: 12px;
  border-radius: var(--radius-pill);
  background: var(--status-window);
  box-shadow:
    0 0 0 3px var(--status-window-soft),
    0 0 12px color-mix(in srgb, var(--status-window) 60%, transparent);

  /* One ping when the line draws: the window opens here. */
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: inherit;
    opacity: 0;
  }

  [data-drawn='true'] &::after {
    animation: ${ping} 1100ms var(--ease-out) 1;
  }

  @media (prefers-reduced-motion: reduce) {
    [data-drawn='true'] &::after {
      animation: none;
    }
  }
`

const EndNode = styled.span`
  position: absolute;
  top: 1px;
  right: 0;
  width: 12px;
  height: 12px;
  border: 2px solid color-mix(in srgb, var(--status-window) 60%, transparent);
  border-radius: var(--radius-pill);
  opacity: 0;
  transition: opacity 320ms var(--ease-out) var(--d, 0ms);

  [data-drawn='true'] & {
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    opacity: 1;
    transition: none;
  }
`

const Scale = styled.div`
  position: relative;
  height: 16px;
  margin-top: 6px;
  color: var(--color-faint);
  font-size: 12px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  span {
    position: absolute;
    top: 0;
  }

  span[data-tick] {
    transform: translateX(-50%);
  }

  span[data-tick]::before {
    content: '';
    position: absolute;
    top: -6px;
    left: 50%;
    width: 1px;
    height: 4px;
    background: var(--color-border-strong);
  }
`

export const WindowSpan = ({
  seconds,
  label,
  endText,
}: {
  seconds: number
  /** "Challenge period" or "Submission period". */
  label: string
  /** "about 22 Oct 08:52 UTC", for the accessible description. */
  endText: string
}) => {
  const [ref, inView] = useInView<HTMLElement>()
  const unit = segmentUnit(seconds)
  const units = unit ? seconds / unit.seconds : 1
  const count = Math.max(1, Math.ceil(units - 1e-9))
  const stagger = Math.min(90, Math.round(900 / count))
  const blocks = Array.from({ length: count }, (_, index) => {
    const from = index / units
    const to = Math.min(1, (index + 1) / units)
    return { from, to }
  })
  // Boundaries between blocks, labelled with the time since mining. At most
  // four labels, none crowding the start label.
  const step = Math.ceil((count - 1) / 4) || 1
  const ticks = unit
    ? blocks
        .slice(1)
        .map((block, index) => ({ at: block.from, k: index + 1 }))
        .filter(({ at, k }) => k % step === 0 && at >= 0.18)
    : []

  return (
    <Figure
      ref={ref}
      role="img"
      aria-label={`${label}: ${formatDurationLong(seconds)}, from when the transaction is mined to ${endText}`}
      data-drawn={inView}
    >
      <Line aria-hidden>
        <StartNode />
        <Blocks>
          {blocks.map((block, index) => (
            <Block
              key={index}
              style={
                {
                  left: `calc(${(block.from * 100).toFixed(3)}% + 2px)`,
                  width: `calc(${((block.to - block.from) * 100).toFixed(3)}% - 4px)`,
                  '--d': `${120 + index * stagger}ms`,
                } as React.CSSProperties
              }
            />
          ))}
        </Blocks>
        <EndNode
          style={{ '--d': `${220 + count * stagger}ms` } as React.CSSProperties}
        />
      </Line>
      <Scale aria-hidden>
        <span style={{ left: 0 }}>When mined</span>
        {unit &&
          ticks.map(({ at, k }) => (
            <span
              key={k}
              data-tick
              style={{
                left: `calc(${SIDE}px + (100% - ${2 * SIDE}px) * ${at.toFixed(4)})`,
              }}
            >
              +{formatDuration(k * unit.seconds)}
            </span>
          ))}
      </Scale>
    </Figure>
  )
}

export default WindowSpan
