import React, { useEffect, useRef, useState } from 'react'
import styled, { keyframes } from 'styled-components'
import { Label } from 'components/curate/primitives'
import { LANE_BAR, LaneBar, laneDuration } from 'components/curate/lane-bar'
import { useInView } from './use-in-view'

/*
 * Two of the original lifecycle's three lanes, without its steps: the base
 * branch's drawing (lifecycle.tsx) with its Status lane, its durations and
 * its axis break taken out, which is what the owner asked for in round 4
 * ("the old bars … without all the steps").
 *
 * The first lane is Open to challenge: the 10px bar (LaneBar), drawn left to
 * right once with a light riding its end. The second is the money: a hairline
 * in the muted ink from a small dot where the deposit or stake goes in to a
 * haloed registered-green node where it comes back, set exactly under the
 * bar's end and named with the event that releases it. The two cards differ
 * in one thing, read at a glance: a Standard bar stops part of the way
 * across, because anyone can challenge only until the entry is registered and
 * the deposit comes back then; a Stake bar runs the width, because the stake
 * stays in, and open to a challenger, until the submitter withdraws it.
 *
 * A Standard lane goes on past its bar the way the base's did: at its far end
 * a dashed, outlined band the bar's thickness and length (the base's optional
 * run: a 1.25px 3/3 dashed window-blue outline round a soft window fill),
 * named above it, for the removal request that can open the entry to a
 * challenge again, on the same challenge period, but only if someone asks.
 * Dashed is the base's word for "only if someone acts". The money lane does
 * not follow it: a removal request is backed by the requester's deposit, not
 * the submitter's, which came back at registration.
 *
 * Nothing here is a measurement. There is no axis, no tick and no figure on
 * either lane: the periods are the list creator's to set in the factory, and
 * no one can say how long an entry lives. The drawing is ordered by event,
 * not scaled; its aria-label says so, and names the coin.
 *
 * It draws once, when it comes into view, on the base's timeline: the bar
 * first, the money lane 130ms behind it at the same speed, so the node lands
 * as the line reaches it, just under where the bar's light goes out. The
 * removal band fades in, as the base's did, when a sweep at the bar's speed
 * would reach its left end, after the bar has drawn. No mark paints before
 * the drawing is armed, the dot where the money goes in and the band
 * included; only the lanes' names and the coin, which are text, show at
 * once. With reduced motion it appears in its final state once armed; in
 * print it is always in its final state.
 */

export type FateSpec = {
  /** The money lane's name: what is locked. */
  lane: string
  /**
   * Where along the lanes the money comes back and the window closes: a
   * share of the width, or 'end' for the whole of it.
   */
  release: number | 'end'
  /** The event that releases the money, named under its node. */
  event: string
  /**
   * A window that opens again only if someone acts, drawn dashed at the far
   * end of the Open to challenge lane and as long as the bar, named above it
   * in at most two words ("Removal request"). Leave it out where the bar
   * runs the width.
   */
  removal?: string
  /**
   * What the drawing shows, in words, for screen readers, the removal
   * window included. The money lane's name and the coin are added after it
   * ("Deposit locked in xDAI."), so it need not repeat them.
   */
  description: string
}

/** ms between the bar and the money lane: the base's LANE_LAG. */
const LANE_LAG = 130
/** ms a node takes to arrive: the base's pop. */
const POP = 460
/** ms a label takes to settle in: the base's fade. */
const FADE = 420

const CAP = LANE_BAR / 2
const START = 7 // the dot where the money goes in: the base's r3.5
const NODE = 9 // the release node's core: the base's r4.5
const HALO = 3.5 // the node's halo past its core: the base's r8

const pop = keyframes`
  from { opacity: 0; transform: scale(0.4); }
  to { opacity: 1; transform: none; }
`

const fade = keyframes`
  from { opacity: 0; transform: translateY(3px); }
  to { opacity: 1; transform: none; }
`

const grow = keyframes`
  from { transform: scaleX(0); }
  to { transform: none; }
`

const Lane = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
`

/*
 * A lane's name, then what it needs beside it: on the money lane the coin,
 * right after the name ("Deposit locked · in xDAI"), never justified to the
 * card's far edge, where it floated over empty lane.
 */
const LaneHead = styled.div`
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-height: 16px;
  min-width: 0;
`

/*
 * The coin the money is in, in sentence case after the lane's name so that
 * "xDAI" keeps its spelling, which the uppercase label would lose. The middot
 * that joins them is its own.
 */
const Coin = styled.span`
  color: var(--color-faint);
  font-size: var(--fs-meta);
  line-height: 16px;
  white-space: nowrap;

  &::before {
    content: '·';
    margin-right: 6px;
  }
`

/*
 * The removal window's name, over its band: as wide as the band and pushed
 * to the lane's end, so it starts where the band starts; where the band is
 * narrower than the words, it grows to the left and keeps its right edge on
 * the lane's, inside the card.
 */
const BandName = styled.span`
  flex: 0 0 auto;
  min-width: max-content;
  margin-left: auto;
  color: var(--color-muted);
  font-size: var(--fs-meta);
  line-height: 16px;
  white-space: nowrap;
  opacity: 0;
`

/* The Open to challenge lane: the bar, and the removal band at its end. */
const BarLane = styled.div`
  position: relative;
`

/*
 * The removal window: the base's optional run, a capsule of the bar's
 * thickness outlined in a 1.25px 3/3 dash of the window blue round its soft
 * fill, the stroke centred on the edge as the base's rect drew it. It sits at
 * the lane's far end, as long as the bar, because a removal request runs on
 * the same challenge period as a submission.
 */
const Band = styled.svg`
  position: absolute;
  top: 0;
  right: 0;
  display: block;
  height: ${LANE_BAR}px;
  overflow: visible;
  opacity: 0;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;

  rect {
    fill: var(--status-window-soft);
    stroke: var(--status-window);
    stroke-width: 1.25px;
    stroke-dasharray: 3 3;
  }
`

/* The money lane, as tall as the bar above so the two read as a pair. */
const Track = styled.div`
  position: relative;
  height: ${LANE_BAR}px;
`

/*
 * The money while it is locked: a 2px hairline in the muted ink, round
 * capped, from the centre of the dot where it goes in to the centre of the
 * node where it comes back, which covers its end. It grows from its left end
 * on a linear clock, like the bar above it; a horizontal scale cannot be seen
 * to squash a 1px cap, which on the 10px bar it would.
 */
const Line = styled.i`
  position: absolute;
  top: 50%;
  left: ${CAP}px;
  width: calc(var(--at) - ${LANE_BAR}px);
  height: 2px;
  margin-top: -1px;
  border-radius: var(--radius-pill);
  background: var(--color-muted);
  transform-origin: left center;
  transform: scaleX(0);
`

/* Where the money goes in, under the bar's first cap. */
const Start = styled.i`
  position: absolute;
  top: 50%;
  left: ${CAP}px;
  width: ${START}px;
  height: ${START}px;
  border-radius: 50%;
  background: var(--color-muted);
  translate: -50% -50%;
  opacity: 0;
`

/*
 * Where the money comes back: the registered green, haloed the way every
 * status dot in the app is haloed, centred under the bar's last cap, so the
 * one event the card is about is the one thing on the lane in a status
 * colour, and it sits where the window closes.
 */
const Node = styled.i`
  position: absolute;
  top: 50%;
  left: calc(var(--at) - ${CAP}px);
  width: ${NODE}px;
  height: ${NODE}px;
  border-radius: 50%;
  background: var(--status-registered);
  box-shadow: 0 0 0 ${HALO}px
    color-mix(in srgb, var(--status-registered) 22%, transparent);
  translate: -50% -50%;
  opacity: 0;
`

/*
 * The event's name, under its node: centred on it, or, at the lanes' end,
 * hung back from the edge so it stays inside the card.
 */
const Events = styled.div`
  position: relative;
  height: 16px;
  margin-top: 6px;
`

const Event = styled.span<{ $end: boolean }>`
  position: absolute;
  top: 0;
  ${({ $end }) =>
    $end ? 'right: 0;' : `left: calc(var(--at) - ${CAP}px); translate: -50% 0;`}
  color: var(--color-muted);
  font-size: var(--fs-meta);
  line-height: 16px;
  white-space: nowrap;
  opacity: 0;
`

const Figure = styled.figure`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 0;
  min-width: 0;

  /* Armed is the final state; the timeline below is added only for motion. */
  &[data-armed] ${Line} {
    transform: none;
  }

  &[data-armed]
    ${Start},
    &[data-armed]
    ${Node},
    &[data-armed]
    ${Event},
    &[data-armed]
    ${Band},
    &[data-armed]
    ${BandName} {
    opacity: 1;
  }

  @media (prefers-reduced-motion: no-preference) {
    &[data-armed] ${Line} {
      animation: ${grow} var(--t) linear var(--d-line) both;
    }

    &[data-armed] ${Start} {
      animation: ${pop} ${POP}ms var(--ease-out) var(--d-line) both;
    }

    &[data-armed] ${Node} {
      animation: ${pop} ${POP}ms var(--ease-out) var(--d-node) both;
    }

    &[data-armed] ${Event} {
      animation: ${fade} ${FADE}ms var(--ease-out) var(--d-node) both;
    }

    &[data-armed] ${Band}, &[data-armed] ${BandName} {
      animation: ${fade} ${FADE}ms var(--ease-out) var(--d-band) both;
    }
  }

  @media print {
    ${Line} {
      transform: none;
      animation: none;
    }

    ${Start}, ${Node}, ${Event}, ${Band}, ${BandName} {
      opacity: 1;
      animation: none;
    }
  }

  /* Forced colours would paint the hairline and its dots in the page colour
     and drop the halo, leaving the bar above with nothing under it: keep
     them ink, as LaneBar keeps its runs, and the removal band an ink dash
     round the page colour. */
  @media (forced-colors: active) {
    ${Line}, ${Start}, ${Node} {
      forced-color-adjust: none;
      background: CanvasText;
    }

    ${Node} {
      box-shadow: none;
    }

    ${Band} {
      forced-color-adjust: none;
    }

    ${Band} rect {
      fill: Canvas;
      stroke: CanvasText;
    }
  }
`

export const DepositFate = ({
  spec,
  coin,
  delay = 700,
}: {
  spec: FateSpec
  /** The coin the money is in, as the lane says it ("in xDAI"). */
  coin: string
  /** ms before the drawing, counted from mount, so the card lands first. */
  delay?: number
}) => {
  const [ref, inView] = useInView<HTMLElement>(0.35)
  const mountedAt = useRef(performance.now())
  const [start, setStart] = useState<number>()

  // Arm once in view; if that is right after mount, still let the card land
  // first (the base's arming, unchanged).
  useEffect(() => {
    if (!inView || start !== undefined) return
    setStart(
      Math.max(
        150,
        Math.round(delay - (performance.now() - mountedAt.current)),
      ),
    )
  }, [inView, start, delay])

  const end = spec.release === 'end'
  const extent = spec.release === 'end' ? 1 : spec.release
  // The money lane runs at the bar's speed, so its node lands as the line
  // reaches it: the duration is the bar's own, not worked out again.
  const sweep = laneDuration(extent)
  const base = start ?? 0
  // The removal band, where there is one: as long as the bar, at the lane's
  // end, arriving when a sweep at the bar's speed would reach its left end
  // (the base's timing for its dashed run), after the bar has drawn.
  const band = !end && spec.removal ? extent : 0
  const style = {
    '--at': `${extent * 100}%`,
    '--t': `${sweep}ms`,
    '--d-line': `${base + LANE_LAG}ms`,
    '--d-node': `${base + LANE_LAG + sweep}ms`,
    '--d-band': `${base + laneDuration(1 - band)}ms`,
  } as React.CSSProperties

  // The figure is one image to assistive technology, so its children are
  // never read: everything the drawing says in text goes into its name, the
  // removal window in the description and the coin, which the lane's head
  // row shows after its name, at the end.
  const label = `${spec.description} ${spec.lane} ${coin}.`

  return (
    <Figure
      ref={ref}
      role="img"
      aria-label={label}
      data-armed={start !== undefined ? '' : undefined}
      style={style}
    >
      <Lane>
        <LaneHead>
          <Label $tone="faint">Open to challenge</Label>
          {band > 0 && (
            <BandName style={{ width: `${band * 100}%` }}>
              {spec.removal}
            </BandName>
          )}
        </LaneHead>
        <BarLane>
          <LaneBar
            extent={extent}
            armed={start !== undefined}
            delay={base}
            head
          />
          {band > 0 && (
            <Band style={{ width: `${band * 100}%` }} aria-hidden>
              <rect width="100%" height={LANE_BAR} rx={CAP} />
            </Band>
          )}
        </BarLane>
      </Lane>
      <Lane>
        <LaneHead>
          <Label $tone="faint">{spec.lane}</Label>
          <Coin>{coin}</Coin>
        </LaneHead>
        <div>
          <Track>
            <Line />
            <Start />
            <Node />
          </Track>
          <Events>
            <Event $end={end}>{spec.event}</Event>
          </Events>
        </div>
      </Lane>
    </Figure>
  )
}

export default DepositFate
