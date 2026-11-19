import React from 'react'
import styled, { keyframes } from 'styled-components'

/*
 * LaneBar: the one bar the app draws. It is the "Open to challenge" lane of
 * the list lifecycles on the base branch (lifecycle.tsx), lifted out of its
 * SVG so that two places can share it: the launch page's Open to challenge
 * lane (pages/launch-list/deposit-fate.tsx), where a Standard bar stops part
 * of the way across and a Stake bar runs the full width, and the jury's vote
 * tally (components/curate/dispute-jury.tsx), where each side's votes are a
 * run of their own. Every round before this one reinvented the bar (a pastel,
 * a lit groove, a glowing band, a hairline) and each read worse than the
 * base, so the look is fixed here and nowhere else: a 10px solid run with
 * round caps, in a flat hue, with no track behind it, no gradient and no
 * glow.
 *
 * It draws once, left to right, at a constant speed per full width, so a
 * short bar finishes sooner than a long one and two bars on a page stay in
 * step: that is the base's linear time sweep, not an eased grow. One edge
 * reveals every run at once. An earlier version scaled each run inside its
 * own slot on its own delay, which tore a bar of several runs into detached
 * chunks halfway through; a single edge cannot do that.
 *
 * That edge is two opposite slides, not a moving clip-path. A mask with round
 * ends slides in from the left while the runs inside it slide back by the
 * same distance, so the runs hold still and the mask's round right end is the
 * leading cap. The version before this animated a clip-path, which runs on
 * the main thread in Safari and Firefox, and in Chrome too unless its
 * composited clip-path animations are on, while the head's transform runs on
 * the compositor everywhere. Any stall on the page (a render, a font swap, a
 * wallet waking up) froze the edge while the head kept gliding over lane not
 * yet drawn, and then the bar jumped to catch up. Transforms alone put the
 * mask, the runs and the head on the compositor's one clock, so the head
 * cannot leave its edge, and the leading cap stays round, which a horizontal
 * scale would have squashed.
 *
 * A bloom head may ride the leading edge once and then go out: the base's
 * light for a window that is open. It is centred on the leading cap, where
 * the base's head sat, so on the launch page it goes out right above the
 * green node drawn under the bar's end. It takes the last run's hue.
 *
 * Nothing paints until `armed` is true, neither a run nor the head; the
 * launch page's first pass painted a dot before its line had drawn, and this
 * is where that stops. With reduced motion the bar appears in its final state
 * once armed, without the sweep or the head; in print it is always in its
 * final state. The drawing is hidden from assistive technology: the caller
 * says in words what it shows.
 */

/** The bar's thickness in px: the base's 10px challenge band. */
export const LANE_BAR = 10

/** ms the sweep takes across the full available width, by default. */
export const LANE_SPEED = 1500

/** px between two runs. */
export const LANE_GAP = 4

const CAP = LANE_BAR / 2
const BLOOM = 18 // the head's soft light: the base's r9 bloom
const CORE = 6 // its bright centre: the base's r3 core
const SPILL = BLOOM / 2 - CAP // px the bloom reaches past the bar's edges
const FADE = 380 // ms the head takes to go out once it has arrived

const finite = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback

const shareOf = (extent: number) => Math.min(1, Math.max(0, finite(extent, 1)))

/**
 * ms a bar covering `extent` of the available width takes to draw at `speed`:
 * the sweep's own duration, never below 1ms. A caller that starts something
 * when a bar has drawn, such as the launch page's second lane, takes the time
 * from here rather than working it out again, so the two cannot drift apart.
 */
export const laneDuration = (extent = 1, speed = LANE_SPEED): number =>
  Math.max(
    1,
    Math.round(Math.max(0, finite(speed, LANE_SPEED)) * shareOf(extent)),
  )

export type LaneRun = {
  /** Stable identity among the runs, such as a ruling choice. */
  key: string | number
  /** The run's share of the bar, in any unit: only the ratios matter. */
  weight: number
  /** A CSS colour, normally a token: var(--status-window), var(--viz-1). */
  hue: string
}

export type LaneBarProps = {
  /**
   * The runs, laid out left to right in this order. A run whose weight is
   * not above zero is left out; any other keeps at least the bar's own
   * thickness, so the smallest share still shows as a round dot.
   * Defaults to one run in var(--status-window).
   */
  runs?: LaneRun[]
  /** The share of the available width the whole bar covers, 0 to 1. */
  extent?: number
  /** Nothing paints until this is true; the sweep starts when it turns true. */
  armed: boolean
  /** ms between arming and the start of the sweep. */
  delay?: number
  /**
   * ms the sweep would take across the full available width; a bar covering
   * part of it takes that share of the time (see laneDuration). Defaults to
   * LANE_SPEED.
   */
  speed?: number
  /** A bloom head, in the last run's hue, that rides the edge once. */
  head?: boolean
  className?: string
}

const WINDOW: LaneRun[] = [
  { key: 'window', weight: 1, hue: 'var(--status-window)' },
]

const reveal = keyframes`
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
`

const counter = keyframes`
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
`

const travel = keyframes`
  from { opacity: 1; transform: translateX(-100%); }
  to { opacity: 1; transform: translateX(0); }
`

const vanish = keyframes`
  from { opacity: 1; transform: translateX(0); }
  to { opacity: 0; transform: translateX(0); }
`

/*
 * The window the runs show through: the bar's own box, round at both ends,
 * clipping what it holds. It slides in from one bar's length to the left of
 * its place while the runs inside it slide back by as much, so its round
 * right end is the one edge moving across every run, gaps included. Its left
 * end stays out beyond the bar until the sweep is over, and then it lies
 * exactly on the first run's own cap. Before arming nothing in it paints.
 */
const Mask = styled.span`
  display: block;
  height: 100%;
  overflow: hidden;
  border-radius: ${CAP}px;
  visibility: hidden;
`

const Runs = styled.span`
  display: flex;
  gap: ${LANE_GAP}px;
  height: 100%;
`

const Run = styled.span`
  display: block;
  flex: 1 1 0;
  min-width: ${LANE_BAR}px;
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--hue);
`

/*
 * The head's bounds: the bar's box, widened by what the bloom spills on
 * every side but the left. The head is centred on the leading cap, and when
 * the sweep starts that cap is still coming in from the left of the bar, so
 * without this the light would paint for a frame beside a bar not yet drawn.
 * It is a plain rectangle that never moves, so it costs the compositor
 * nothing, and it spills no further than the head itself did.
 */
const HeadClip = styled.span`
  position: absolute;
  top: -${SPILL}px;
  right: -${SPILL}px;
  bottom: -${SPILL}px;
  left: 0;
  overflow: hidden;
  pointer-events: none;
`

/*
 * The head travels on a rail the size of the bar, moved from one bar's
 * length to the left of it to its place, on the same timing as the mask.
 * Moving the rail rather than the head keeps the travel a transform in
 * percent of the bar, so it needs no measured width, and keeps it on the
 * compositor with the edge it rides.
 */
const Rail = styled.span`
  position: absolute;
  top: ${SPILL}px;
  right: ${SPILL}px;
  bottom: ${SPILL}px;
  left: 0;
  opacity: 0;
  transform: translateX(-100%);
`

const Head = styled.span`
  position: absolute;
  top: 50%;
  right: ${CAP - BLOOM / 2}px;
  width: ${BLOOM}px;
  height: ${BLOOM}px;
  margin-top: -${BLOOM / 2}px;
  border-radius: 50%;
  background: radial-gradient(closest-side, var(--head), transparent);

  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: ${CORE}px;
    height: ${CORE}px;
    margin: -${CORE / 2}px 0 0 -${CORE / 2}px;
    border-radius: 50%;
    background: var(--color-on-primary);
  }
`

const Root = styled.span`
  position: relative;
  display: block;
  height: ${LANE_BAR}px;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;

  /* Armed is the final state; the sweep below is added only for motion. */
  &[data-armed] ${Mask} {
    visibility: visible;
  }

  /*
   * The three share a timing function, a duration and a delay, and start in
   * the same frame, so the mask and the runs cancel out at every instant and
   * the head stays on the cap they draw.
   */
  @media (prefers-reduced-motion: no-preference) {
    &[data-armed] ${Mask} {
      animation: ${reveal} var(--t) linear var(--d) both;
    }

    &[data-armed] ${Runs} {
      animation: ${counter} var(--t) linear var(--d) both;
    }

    &[data-armed] ${Rail} {
      animation:
        ${travel} var(--t) linear var(--d) forwards,
        ${vanish} ${FADE}ms ease-out calc(var(--d) + var(--t)) forwards;
    }
  }

  @media print {
    ${Mask}, &[data-armed] ${Mask} {
      visibility: visible;
      animation: none;
    }

    ${Runs}, &[data-armed] ${Runs} {
      animation: none;
    }

    ${HeadClip} {
      display: none;
    }
  }

  /* Forced colours would turn the runs into the page colour: keep them ink.
     A run drawn transparent (an empty stretch of lane, such as the jury's
     seats with no vote) stays empty, so it never reads as a side's ink. */
  @media (forced-colors: active) {
    ${Run} {
      forced-color-adjust: none;
      background: CanvasText;
    }

    ${Run}[data-empty] {
      background: transparent;
    }

    ${HeadClip} {
      display: none;
    }
  }
`

export const LaneBar = ({
  runs = WINDOW,
  extent = 1,
  armed,
  delay = 0,
  speed = LANE_SPEED,
  head = false,
  className,
}: LaneBarProps) => {
  const shown = runs.filter(
    (run) => Number.isFinite(run.weight) && run.weight > 0,
  )
  // Grow factors relative to the largest run: the ratios are the weights',
  // and they sum to at least 1, so the runs always fill the bar.
  const largest = Math.max(0, ...shown.map((run) => run.weight))
  // Wide enough for every run to keep its dot and the gaps between them.
  const floor = Math.max(
    LANE_BAR,
    shown.length * LANE_BAR + Math.max(0, shown.length - 1) * LANE_GAP,
  )
  const style = {
    width: `${shareOf(extent) * 100}%`,
    minWidth: `${floor}px`,
    '--d': `${Math.max(0, Math.round(finite(delay, 0)))}ms`,
    '--t': `${laneDuration(extent, speed)}ms`,
    '--head': shown[shown.length - 1]?.hue ?? 'var(--status-window)',
  } as React.CSSProperties

  return (
    <Root
      aria-hidden
      className={className}
      data-armed={armed ? '' : undefined}
      style={style}
    >
      <Mask>
        <Runs>
          {shown.map((run) => (
            <Run
              key={run.key}
              data-empty={run.hue === 'transparent' ? '' : undefined}
              style={
                {
                  flexGrow: run.weight / largest,
                  '--hue': run.hue,
                } as React.CSSProperties
              }
            />
          ))}
        </Runs>
      </Mask>
      {head && shown.length > 0 && (
        <HeadClip>
          <Rail>
            <Head />
          </Rail>
        </HeadClip>
      )}
    </Root>
  )
}

export default LaneBar
