import React, { useLayoutEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'
import ReactBlockies from 'react-blockies'
import { Popover } from 'components/ui'
import useDisputeJury, {
  MAX_SLOTS,
  type JuryJuror,
  type JuryRound,
} from 'hooks/use-dispute-jury'
import useJuryJustifications, {
  type JuryJustifications,
} from 'hooks/use-jury-justifications'
import { CuratorAddress } from './chrome-address'
import { CurateIcon } from './icons'
import { LANE_BAR, LANE_GAP, LaneBar, type LaneRun } from './lane-bar'
import { linkify } from './item-standard-linkify'
import {
  Data,
  Label,
  SegmentedControl,
  SkeletonBlock,
  truncateMiddle,
} from './primitives'
import { COURT_PERIOD, choiceLabel } from './dispute-timeline-model'
import { DisclosurePill } from './item-disclosure-pill'

/*
 * Who is judging the case, inside the case panel and inside the record of a
 * case already decided: the jurors the court drew for a round, where each
 * one is, and which way the ones who revealed voted. Secondary depth, so it
 * stays collapsed behind a pill until it is asked for (DESIGN.md: data
 * first, explainers collapse into a pill).
 *
 * A dispute that was appealed has run several rounds, each with its own
 * jury. They are tabbed rather than stacked (round 3 of the design review),
 * one round read at a time: a round costs one call per seat, so the reader
 * pays for the round they are looking at and nothing else. A dispute that
 * was never appealed has one round and therefore no tab control at all.
 *
 * Nothing is shown that the chain has not published. A juror who has not
 * revealed reads as committed or still to vote, never as a vote: before the
 * reveal `getVote` returns choice 0, which in Curate means "refused to
 * rule" (use-dispute-jury.ts keeps `choice` undefined until then), so a
 * hidden-votes court leaks nothing.
 *
 * What a juror wrote to justify their vote is read from Kleros Court's
 * public store (kleros/court-functions get-justifications, the read
 * court.kleros.io makes; use-jury-justifications.ts), keyed by the last of
 * the vote IDs the juror cast with it, and shown only once the chain shows
 * that juror's vote revealed. It sits under the juror's row as a quiet
 * quote, the history's idiom for words someone filed, clamped to a few
 * lines: a tooltip would not exist on a phone and would cap a long
 * justification at a few words, and the jury is already behind its pill, so
 * nothing is added to the page at rest.
 */

const Band = styled.section`
  display: flex;
  flex-direction: column;
  gap: 14px;
`

const Rounds = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

const Round = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`

/* The round track hugs its options: a recess pill, not a full-width bar. */
const Tabs = styled.div`
  display: flex;
  min-width: 0;
`

const RoundHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 16px;
`

const Jurors = styled.ul`
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px 14px;
    padding: 9px 0;
    border-top: 1px solid var(--glass-border);
  }

  li:first-child {
    border-top: 0;
  }

  @media (max-width: 560px) {
    li {
      grid-template-columns: 24px minmax(0, 1fr);
    }
  }
`

const Avatar = styled.span`
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  overflow: hidden;
  border-radius: var(--radius-pill);

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow: inset 0 0 0 1px var(--glass-border);
    pointer-events: none;
  }

  canvas {
    display: block;
  }
`

const Who = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  min-width: 0;
`

const Weight = styled.span`
  color: var(--color-faint);
  font-size: 12px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
`

const Vote = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  justify-self: end;

  @media (max-width: 560px) {
    grid-column: 2;
    justify-self: start;
  }
`

const DetailButton = styled.button`
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-faint);
  cursor: pointer;
  transition:
    color var(--motion),
    background var(--motion);

  &:hover,
  &[aria-expanded='true'] {
    background: var(--color-raised);
    color: var(--color-text);
  }
`

const DetailList = styled.dl`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  min-width: 200px;

  div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  dd {
    margin: 0;
    min-width: 0;
    color: var(--color-text);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
    overflow-wrap: anywhere;
  }
`

/*
 * A juror's justification, under their row: a quote in the history's idiom
 * (a 2px rule on its left, no box), the rule in the hue of the side the
 * juror voted for, so it reads as theirs. It starts under the address and
 * runs to the row's end.
 */
const Quote = styled.blockquote`
  grid-column: 2 / -1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
  margin: 0;
  padding: 1px 0 1px 10px;
  border-left: 2px solid color-mix(in srgb, var(--hue) 60%, transparent);
`

const QuoteText = styled.p<{ $clamped: boolean }>`
  margin: 0;
  max-width: 68ch;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  white-space: pre-line;
  overflow-wrap: anywhere;

  ${({ $clamped }) =>
    $clamped &&
    `
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  `}
`

const MoreButton = styled.button`
  /* A 24px tap target without moving the line: padding out, margin back. */
  padding: 3px 0;
  margin: -3px 0;
  border: 0;
  background: none;
  color: var(--color-primary);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 500;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`

/*
 * The tally leads the round, before the jurors it counts: the result first.
 * It is the app's one bar (LaneBar, lane-bar.tsx), the same component the
 * launch page draws its Open to challenge lane with, which is the base
 * branch's lifecycle lane (round 4 and round 5 of the design review: "same
 * bar for the votes of challenger and submitter"). Each side's votes are a
 * 10px run of their own in that side's chart hue, the submitter's from the
 * left and the challenger's from the right. The two sides' counts stand at
 * the bar's two ends, even at 0, the leading side's in the text colour.
 * There is no rule above it: a unanimous run under a border read as one
 * more divider.
 *
 * Between the sides, nothing belongs to either. A refusal is a vote but not
 * a side, so it is a run in the neutral role, next to the leading side's
 * run. The seats with no vote revealed (still to come while the
 * round runs, never cast once it is over) keep their share of the bar as
 * empty lane, towards the trailing side: the bar has no track (DESIGN.md),
 * so a side's run stops where its votes stop, and a bar with one vote in
 * never reads as unanimous. With no side leading (a tie, or refusals
 * only), the neutral run sits in the middle with the empty seats split
 * either side of it. They used to be a faint run, and a side at 0 seemed
 * to own it: "0 For the submitter" stood right above the grey, with its
 * caption centred under the other side's run (round 5's re-audit). Now a
 * side at 0 has no ink at its end, and what lies between the sides is
 * named right under itself (TallyCaption).
 */
const Tally = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 2px 0 6px;
`

const Ends = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 16px;
`

const Side = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  color: var(--color-muted);
  font-size: 12px;
  line-height: 16px;

  b {
    color: var(--color-muted);
    font-family: var(--font-figure);
    font-size: 20px;
    line-height: 22px;
    font-weight: 500;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }

  &[data-lead] {
    color: var(--color-text);
  }

  &[data-lead] b {
    color: var(--color-text);
  }
`

/*
 * What the two ends do not say (refusals, seats not revealed, a tie), its
 * centre under the middle of the stretch it names, moved in only as far as
 * it takes to stay inside the bar (TallyCaption measures both). Until it is
 * measured, two spacers share the free width in the proportion `--at`
 * (where that middle falls along the bar, 0 to 1), which keeps it near its
 * stretch and inside the bar whatever its width.
 */
const Caption = styled.div`
  display: flex;
  color: var(--color-faint);
  font-size: 12px;
  line-height: 16px;
  text-align: center;

  &:not([data-placed])::before,
  &:not([data-placed])::after {
    content: '';
    flex: var(--at) 1 0px;
  }

  &:not([data-placed])::after {
    flex-grow: calc(1 - var(--at));
  }

  p {
    flex: 0 1 auto;
    width: max-content;
    max-width: 100%;
    min-width: 0;
    margin: 0;
  }

  &[data-placed] p {
    transform: translateX(var(--left));
  }
`

/*
 * A juror's mark: filled when their vote is public, in the hue of the side
 * it went to (the tally's run), and hollow while it is not, as the tally
 * leaves their seat empty: a faint ring, whether the juror has committed or
 * not voted at all, and the words beside it say which. A refusal is grey
 * too, but filled, so the fill alone says the vote is public. The ring
 * never takes a side's hue or a status: the window status is the accent,
 * the same blue as the submitter's run, and a committed juror ringed in it
 * read as a lean the chain has not revealed. The same 8px as a status dot,
 * so the rows still align.
 */
const SideDot = styled.span`
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--hue);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--hue) 22%, transparent);
`

const SealDot = styled.span`
  flex: none;
  box-sizing: border-box;
  width: 8px;
  height: 8px;
  border: 1.5px solid var(--color-faint);
  border-radius: 50%;
`

const Seats = styled.p`
  margin: 0;
  color: var(--color-faint);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

const Honest = styled.p`
  margin: 0;
  padding-top: 12px;
  border-top: 1px solid var(--glass-border);
  color: var(--color-faint);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

/*
 * Where a juror is, for a vote that is not public yet: the words beside the
 * hollow mark. A revealed vote is named by its side and marked in that
 * side's hue instead (hueOf).
 */
const STATE: Record<JuryJuror['state'], string> = {
  pending: 'Not voted yet',
  committed: 'Committed',
  revealed: 'Revealed',
}

/* The same, once the round is over: what was never cast stays uncounted. */
const OVER: Partial<Record<JuryJuror['state'], string>> = {
  pending: 'Did not vote',
  committed: 'Not revealed',
}

/*
 * The chart colours, in choice order. Choice 0 is a refusal to arbitrate,
 * which is not a side, so it reads in the neutral role and the two real
 * sides take the first two chart hues, as every other drawing in the app
 * does. Curate disputes have those two sides only; a third choice, which no
 * Curate list asks for, would be a third category and take the next hue.
 */
const VIZ = [
  'var(--status-neutral)',
  'var(--viz-1)',
  'var(--viz-2)',
  'var(--viz-3)',
  'var(--viz-4)',
]

const hueOf = (choice: number): string => VIZ[choice] ?? VIZ[VIZ.length - 1]

/* The seats with no vote revealed: their share of the lane, left empty. */
const EMPTY = 'transparent'

/*
 * Where LaneBar lays these runs out across `width` px, by its own flex
 * rules: the runs share the width less the gaps between them by weight, and
 * none is narrower than the bar's thickness. Each shown run's two ends.
 */
const spansOf = (runs: LaneRun[], width: number) => {
  const shown = runs.filter((run) => run.weight > 0)
  const free = Math.max(0, width - Math.max(0, shown.length - 1) * LANE_GAP)
  const frozen = new Set<number>()
  let sizes: number[] = []
  for (let pass = 0; pass <= shown.length; pass += 1) {
    const room = Math.max(0, free - frozen.size * LANE_BAR)
    const weight = shown.reduce(
      (sum, run, index) => (frozen.has(index) ? sum : sum + run.weight),
      0,
    )
    sizes = shown.map((run, index) =>
      frozen.has(index)
        ? LANE_BAR
        : weight > 0
          ? (room * run.weight) / weight
          : 0,
    )
    const under = sizes
      .map((size, index) =>
        !frozen.has(index) && size < LANE_BAR ? index : -1,
      )
      .filter((index) => index >= 0)
    if (under.length === 0) break
    under.forEach((index) => frozen.add(index))
  }
  let edge = 0
  return shown.map((run, index) => {
    const start = edge
    edge += sizes[index] + LANE_GAP
    return { key: run.key, start, end: start + sizes[index] }
  })
}

/*
 * The tally's caption, its centre under the middle of the runs it names
 * (`names`; with none, under the meeting of the two sides, which is where a
 * tie is), moved in only as far as it takes to stay inside the bar. The
 * caption and the bar are the tally's full width, so one width serves both;
 * the text's own width is measured, and both follow a resize or a font
 * swap.
 */
const TallyCaption = ({
  runs,
  names,
  at,
  text,
}: {
  runs: LaneRun[]
  names: LaneRun['key'][]
  /** Where that middle falls by the runs' shares: the unmeasured fallback. */
  at: number
  text: string
}) => {
  const box = useRef<HTMLDivElement>(null)
  const line = useRef<HTMLParagraphElement>(null)
  const [size, setSize] = useState<{ width: number; own: number }>()
  useLayoutEffect(() => {
    const outer = box.current
    const inner = line.current
    if (!outer || !inner) return undefined
    const measure = () =>
      setSize((previous) => {
        const width = outer.clientWidth
        const own = inner.offsetWidth
        return previous?.width === width && previous.own === own
          ? previous
          : { width, own }
      })
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(outer)
    observer.observe(inner)
    return () => observer.disconnect()
  }, [text])

  let left: number | undefined
  if (size && size.width > 0) {
    const spans = spansOf(runs, size.width)
    const named = spans.filter((span) => names.includes(span.key))
    const middle =
      named.length > 0
        ? (named[0].start + named[named.length - 1].end) / 2
        : spans.length > 1
          ? spans[0].end + LANE_GAP / 2
          : size.width / 2
    left = Math.min(
      Math.max(0, middle - size.own / 2),
      Math.max(0, size.width - size.own),
    )
  }

  return (
    <Caption
      ref={box}
      aria-hidden
      data-placed={left === undefined ? undefined : ''}
      style={
        {
          '--at': at.toFixed(4),
          '--left': `${(left ?? 0).toFixed(1)}px`,
        } as React.CSSProperties
      }
    >
      <p ref={line}>{text}</p>
    </Caption>
  )
}

/*
 * A justification as the row shows it: clamped to three lines, with
 * "Read all" only when the clamp actually hides something. That is
 * measured, not guessed from the length: a 250-character text can fit in
 * three lines on a wide panel, and a button that opened nothing more read
 * as broken. The measure follows the width, so a phone that needs the
 * button gets it. URLs are links; tabbing onto one hidden by the clamp opens
 * the text first.
 */
const Justification = ({ text, hue }: { text: string; hue: string }) => {
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const ref = useRef<HTMLParagraphElement>(null)
  const content = useMemo(() => linkify(text), [text])
  useLayoutEffect(() => {
    const element = ref.current
    if (!element || expanded) return undefined
    const measure = () =>
      setOverflowing(element.scrollHeight > element.clientHeight + 1)
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [expanded, text])
  return (
    <Quote style={{ ['--hue' as string]: hue }}>
      <QuoteText
        ref={ref}
        $clamped={!expanded}
        onFocus={() => {
          if (overflowing) setExpanded(true)
        }}
      >
        {content}
      </QuoteText>
      {(overflowing || expanded) && (
        <MoreButton
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less' : 'Read all'}
        </MoreButton>
      )}
    </Quote>
  )
}

/*
 * The text a juror posted with their vote, once the chain shows the vote
 * revealed, and never before. The store keys a text by the last vote ID it
 * was cast with, so a juror holding several seats is looked up on each; two
 * different texts (two separate casts) are both kept, in seat order.
 */
const justificationOf = (
  juror: JuryJuror,
  texts: JuryJustifications | undefined,
): string | undefined => {
  if (juror.state !== 'revealed' || !texts) return undefined
  const found = juror.voteIDs
    .map((id) => texts[id])
    .filter((text): text is string => !!text)
  return found.length > 0 ? [...new Set(found)].join('\n\n') : undefined
}

const JurorRow = ({
  juror,
  requesterName,
  justification,
  over = false,
}: {
  juror: JuryJuror
  requesterName: string
  /** What the juror wrote with their vote, once it is revealed. */
  justification?: string
  /** The round is over: a vote not revealed by now never will be. */
  over?: boolean
}) => {
  const [open, setOpen] = useState(false)
  const status = (over && OVER[juror.state]) || STATE[juror.state]
  const vote =
    juror.choice === undefined
      ? undefined
      : choiceLabel(juror.choice, requesterName)
  const hue = juror.choice === undefined ? undefined : hueOf(juror.choice)

  return (
    <li>
      <Avatar aria-hidden>
        <ReactBlockies seed={juror.address.toLowerCase()} size={8} scale={3} />
      </Avatar>
      <Who>
        {/* A juror is a person: their address opens their Curate profile. */}
        <CuratorAddress address={juror.address} />
        {juror.voteIDs.length > 1 && (
          <Weight>{juror.voteIDs.length} votes</Weight>
        )}
      </Who>
      <Vote>
        {hue ? (
          <SideDot style={{ ['--hue' as string]: hue }} aria-hidden />
        ) : (
          <SealDot aria-hidden />
        )}
        <Data $weight={500} $muted={!vote}>
          {vote ?? status}
        </Data>
        <Popover
          trigger="click"
          placement="topRight"
          visible={open}
          onVisibleChange={setOpen}
          content={
            <DetailList>
              <div>
                <Label as="dt" $tone="faint">
                  Juror
                </Label>
                <dd>
                  <Data $mono>{juror.address}</Data>
                </dd>
              </div>
              <div>
                <Label as="dt" $tone="faint">
                  {juror.voteIDs.length === 1 ? 'Vote' : 'Votes'} in this round
                </Label>
                <dd>
                  <Data>{juror.voteIDs.map((id) => `#${id}`).join(', ')}</Data>
                </dd>
              </div>
              <div>
                <Label as="dt" $tone="faint">
                  {vote ? 'Voted' : 'Status'}
                </Label>
                <dd>{vote ?? status}</dd>
              </div>
              {juror.commit && (
                <div>
                  <Label as="dt" $tone="faint">
                    Commitment
                  </Label>
                  <dd>
                    <Data $mono $muted>
                      {truncateMiddle(juror.commit, 10, 8)}
                    </Data>
                  </dd>
                </div>
              )}
            </DetailList>
          }
        >
          <DetailButton
            type="button"
            aria-expanded={open}
            aria-label={`Vote details for juror ${truncateMiddle(juror.address, 6, 4)}`}
          >
            <CurateIcon name="help" size={14} />
          </DetailButton>
        </Popover>
      </Vote>
      {justification && hue && <Justification text={justification} hue={hue} />}
    </li>
  )
}

const RoundBlock = ({
  round,
  chainId,
  arbitrator,
  disputeID,
  requesterName,
  open,
  hiddenVotes,
  several = false,
}: {
  round: JuryRound
  chainId?: number | null
  arbitrator?: string | null
  disputeID?: string | null
  requesterName: string
  /**
   * Its votes can still come in: the dispute's latest round, before the
   * appeal period. False once it is over; undefined when the court's period
   * could not be read.
   */
  open?: boolean
  hiddenVotes?: boolean
  /**
   * One of several rounds shown: it names itself and its seats, which the
   * pill does not. A lone round's seats are in the pill, and the period band
   * above already reads "Round 1", so it has no head of its own.
   */
  several?: boolean
}) => {
  const revealedVotes = round.jurors
    .filter((juror) => juror.state === 'revealed')
    .reduce((sum, juror) => sum + juror.voteIDs.length, 0)
  const { data: texts } = useJuryJustifications({
    chainId,
    arbitrator,
    disputeID,
    appeal: round.appeal,
    revealed: revealedVotes,
  })

  const tally = round.tally
  const counts = tally?.counts ?? []
  const count = (choice: number) => counts[choice] ?? 0
  const cast = counts.reduce((sum, value) => sum + value, 0)
  const choices = counts
    .map((value, choice) => ({
      choice,
      count: value,
      label: choiceLabel(choice, requesterName),
    }))
    .filter((entry) => entry.count > 0)
  const leads = (choice: number) =>
    !!tally && !tally.tied && tally.winning === choice
  // The two sides stand at the bar's ends, even at 0, so 3–0 reads as
  // unanimous. Between them, the votes for neither side (a refusal, any
  // other choice) next to the leading side's run, and the seats not
  // revealed yet as empty lane towards the trailing side's end, so a side
  // at 0 never stands over anything. With no side leading, the neutral
  // runs sit in the middle with the empty seats split either side of them.
  // Each appears only when there are some.
  const unrevealed = Math.max(0, round.slots - cast)
  const neutral = counts
    .map((value, choice) => ({ choice, value }))
    .filter(
      (entry) => (entry.choice === 0 || entry.choice > 2) && entry.value > 0,
    )
  const neutralRuns: LaneRun[] = neutral.map((entry) => ({
    key: `c${entry.choice}`,
    weight: entry.value,
    hue: hueOf(entry.choice),
  }))
  const empty = (key: string, weight: number): LaneRun[] =>
    weight > 0 ? [{ key, weight, hue: EMPTY }] : []
  const between: LaneRun[] = leads(1)
    ? [...neutralRuns, ...empty('unrevealed', unrevealed)]
    : leads(2)
      ? [...empty('unrevealed', unrevealed), ...[...neutralRuns].reverse()]
      : neutralRuns.length > 0
        ? [
            ...empty('unrevealed-a', unrevealed / 2),
            ...neutralRuns,
            ...empty('unrevealed-b', unrevealed / 2),
          ]
        : empty('unrevealed', unrevealed)
  const runs: LaneRun[] = [
    { key: 'c1', weight: count(1), hue: hueOf(1) },
    ...between,
    { key: 'c2', weight: count(2), hue: hueOf(2) },
  ]
  // Where the middle of the stretch between the sides falls along the bar,
  // by the runs' shares: the caption's place until it is measured.
  const total = runs.reduce((sum, run) => sum + run.weight, 0)
  const middle = between.reduce((sum, run) => sum + run.weight, 0)
  const at = total > 0 ? (count(1) + middle / 2) / total : 0.5
  // Named left to right, as the bar draws them.
  const notes = [
    ...neutral.map((entry) =>
      entry.choice === 0
        ? `${entry.value} refused to rule`
        : `${entry.value} ${choiceLabel(entry.choice, requesterName).toLowerCase()}`,
    ),
    unrevealed > 0 &&
      (open === false
        ? `${unrevealed} not cast`
        : `${unrevealed} still to ${hiddenVotes ? 'reveal' : 'vote'}`),
  ]
  if (leads(2)) notes.reverse()
  const caption = [...notes, tally?.tied && 'Tied'].filter(Boolean).join(' · ')

  return (
    <Round>
      {/* The seats are named once. Alone, the round's are in the pill
          ("The jury · 3 seats", or "2 of 3 seats drawn"), and the period
          band above names the round, so it has no head. One of several
          names itself, its seats and how far their draw has got. */}
      {several && (
        <RoundHead>
          <Label $tone="faint">
            {`Round ${round.round} · ${round.slots} seat${
              round.slots === 1 ? '' : 's'
            }`}
          </Label>
          {round.drawn < round.slots && (
            <Seats>
              {round.slots - round.drawn} of {round.slots} seats still to be
              drawn
            </Seats>
          )}
        </RoundHead>
      )}
      {tally && cast > 0 && (
        <Tally
          role="img"
          aria-label={`Votes revealed in round ${round.round}, ${cast} of ${
            round.slots
          }: ${choices
            .map((entry) => `${entry.label} ${entry.count}`)
            .join(', ')}. ${
            tally.tied
              ? 'The votes are tied.'
              : `Most votes: ${choiceLabel(tally.winning, requesterName)}.`
          }`}
        >
          <Ends aria-hidden>
            <Side data-lead={leads(1) ? '' : undefined}>
              <b>{count(1)}</b>
              {choiceLabel(1, requesterName)}
            </Side>
            <Side data-lead={leads(2) ? '' : undefined}>
              {choiceLabel(2, requesterName)}
              <b>{count(2)}</b>
            </Side>
          </Ends>
          <LaneBar runs={runs} armed delay={120} speed={900} />
          {caption && (
            <TallyCaption
              runs={runs}
              names={between.map((run) => run.key)}
              at={at}
              text={caption}
            />
          )}
        </Tally>
      )}
      <Jurors>
        {round.jurors.map((juror) => (
          <JurorRow
            key={`${juror.address}-${juror.voteIDs[0]}`}
            juror={juror}
            requesterName={requesterName}
            justification={justificationOf(juror, texts)}
            over={open === false}
          />
        ))}
      </Jurors>
    </Round>
  )
}

/**
 * The jury of one dispute, collapsed into a pill: its rounds as tabs when it
 * was appealed, and the chosen round's jurors, their votes and the tally.
 *
 * Renders nothing when there is no round to show and no round to name
 * (another arbitrator, no answer): the panel around it still says where the
 * case stands.
 */
export const JuryRounds = ({
  chainId,
  arbitrator,
  disputeID,
  requesterName,
  rounds,
  period,
  hiddenVotes,
  arbitrable,
}: {
  chainId?: number | null
  arbitrator?: string | null
  disputeID?: string | null
  /** The list the case must belong to; another contract's shows no jury. */
  arbitrable?: string | null
  /** "submitter" or "requester": what a vote for that side is called. */
  requesterName: string
  /**
   * Vote slots per round, oldest first (CourtDispute.roundSlots). More than
   * one round gives the band its tabs; without the value the read's own
   * default is shown (the live round and the one appealed from).
   */
  rounds?: number[]
  /**
   * The dispute's period now (CourtDispute.period), when the court was read:
   * it says whether the latest round's missing votes are still to come or
   * were never cast.
   */
  period?: number
  /** The court seals votes before revealing them (CourtDispute.hiddenVotes). */
  hiddenVotes?: boolean
}) => {
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<number>()
  const tabbed = !!rounds && rounds.length > 1
  // The newest round is where the case is, so that is the one the band
  // opens on; a tab reads its own round and caches it.
  const appeal = tabbed
    ? Math.min(picked ?? rounds!.length - 1, rounds!.length - 1)
    : undefined
  const {
    data: jury,
    isFetching,
    isError,
  } = useDisputeJury({
    chainId,
    arbitrator,
    disputeID,
    appeals: appeal === undefined ? undefined : [appeal],
    arbitrable,
  })
  const shown = jury?.rounds ?? []
  if (!tabbed && shown.length === 0) return null

  // With tabs the band shows the chosen round alone; without them, whatever
  // the read returned. A round with no rows says why only where the chain
  // has said why: too large to go through seat by seat, or a read that did
  // not come back.
  const picks = tabbed
    ? shown.filter((round) => round.appeal === appeal)
    : shown
  // The latest round is the one the court is in; every earlier one is over.
  const latest = rounds
    ? rounds.length - 1
    : Math.max(-1, ...shown.map((round) => round.appeal))
  const openRound = (round: JuryRound): boolean | undefined =>
    round.appeal < latest
      ? false
      : period === undefined
        ? undefined
        : period < COURT_PERIOD.APPEAL
  const slots = tabbed ? rounds![appeal!] : undefined
  // Collapsed, the pill says what the jury is: how many rounds there were
  // when there were several, and otherwise the one round's seats ("The
  // jury · 3 seats"), as "2 of 3 seats drawn" only while the court is still
  // drawing them. How many addresses hold those seats is in the rows, not
  // here: "· 2 addresses" read as jargon (round 5's re-audit).
  // Without tabs there is a round to name: an empty read returned above.
  const live = shown[0]
  const seats = tabbed
    ? `${rounds!.length} rounds`
    : live.drawn < live.slots
      ? `${live.drawn} of ${live.slots} seats drawn`
      : `${live.slots} seat${live.slots === 1 ? '' : 's'}`

  return (
    <Band aria-label="The jury">
      <DisclosurePill
        icon="user"
        open={open}
        onToggle={() => setOpen((shownNow) => !shownNow)}
        controls={`jury-${disputeID}`}
      >
        The jury · {seats}
      </DisclosurePill>
      {open && (
        <Rounds id={`jury-${disputeID}`}>
          {tabbed && (
            <Tabs>
              <SegmentedControl
                size="sm"
                ariaLabel="Round"
                value={`r${appeal}`}
                options={rounds!.map((_, index) => ({
                  value: `r${index}`,
                  label: `Round ${index + 1}`,
                }))}
                onChange={(value) => setPicked(Number(value.slice(1)))}
              />
            </Tabs>
          )}
          {picks.map((round) => (
            <RoundBlock
              key={round.appeal}
              round={round}
              chainId={chainId}
              arbitrator={arbitrator}
              disputeID={disputeID}
              requesterName={requesterName}
              open={openRound(round)}
              hiddenVotes={hiddenVotes}
              several={tabbed || picks.length > 1}
            />
          ))}
          {picks.length === 0 &&
            (isFetching ? (
              <SkeletonBlock $height="96px" />
            ) : slots !== undefined && slots > MAX_SLOTS ? (
              <Seats>
                This round seats {slots} jurors: too many to read seat by seat.
              </Seats>
            ) : isError ? (
              <Seats>This round’s jury could not be read from the court.</Seats>
            ) : null)}
          <Honest>
            Jurors and their votes come from the court contract; justifications
            from Kleros Court, once a vote is revealed.
          </Honest>
        </Rounds>
      )}
    </Band>
  )
}

export default JuryRounds
