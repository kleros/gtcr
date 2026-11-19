import React, { useState } from 'react'
import styled from 'styled-components'
import ReactBlockies from 'react-blockies'
import { Popover } from 'components/ui'
import useDisputeJury, {
  MAX_SLOTS,
  type JuryJuror,
  type JuryRound,
} from 'hooks/use-dispute-jury'
import { getAddressPage } from 'utils/network-utils'
import { ChromeAddress } from './chrome-address'
import { CurateIcon } from './icons'
import {
  Data,
  Label,
  SegmentedControl,
  SkeletonBlock,
  StatusDot,
  truncateMiddle,
  type StatusTone,
} from './primitives'
import { choiceLabel } from './dispute-timeline-model'
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
 * hidden-votes court leaks nothing. Court v1 does not publish the
 * justification a juror writes with a hidden vote — the Court saves it on
 * the juror's own device — so the detail shows the commitment that proves
 * the vote instead, and says so.
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
    gap: 10px 14px;
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

/* The tally: one bar per choice, categories from the viz set (a chart never
   borrows a status colour). */
const Tally = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--glass-border);
`

const TallyBar = styled.div`
  display: flex;
  gap: 3px;
  height: 8px;

  span {
    min-width: 5px;
    border-radius: var(--radius-pill);
  }
`

const TallyKey = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 0;
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

const STATE: Record<JuryJuror['state'], { tone: StatusTone; label: string }> = {
  pending: { tone: 'neutral', label: 'Not voted yet' },
  committed: { tone: 'window', label: 'Committed' },
  revealed: { tone: 'registered', label: 'Revealed' },
}

/*
 * The chart colours, in choice order. Choice 0 is a refusal to arbitrate,
 * which is not a side, so it reads in the neutral role and the two real
 * sides take the first two chart hues, as every other drawing in the app
 * does. Before this, a refusal took --viz-3 and put a purple on the first
 * swatch of a two-colour chart.
 */
const VIZ = [
  'var(--status-neutral)',
  'var(--viz-1)',
  'var(--viz-2)',
  'var(--viz-3)',
]

const JurorRow = ({
  juror,
  chainId,
  requesterName,
}: {
  juror: JuryJuror
  chainId?: number | null
  requesterName: string
}) => {
  const [open, setOpen] = useState(false)
  const state = STATE[juror.state]
  const vote =
    juror.choice === undefined
      ? undefined
      : choiceLabel(juror.choice, requesterName)

  return (
    <li>
      <Avatar aria-hidden>
        <ReactBlockies seed={juror.address.toLowerCase()} size={8} scale={3} />
      </Avatar>
      <Who>
        <ChromeAddress
          address={juror.address}
          display={truncateMiddle(juror.address, 6, 4)}
          href={
            chainId
              ? getAddressPage({ networkId: chainId, address: juror.address })
              : undefined
          }
        />
        {juror.voteIDs.length > 1 && (
          <Weight>{juror.voteIDs.length} votes</Weight>
        )}
      </Who>
      <Vote>
        <StatusDot $tone={state.tone} aria-hidden />
        <Data $weight={500} $muted={!vote}>
          {vote ?? state.label}
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
                <dd>{vote ?? state.label}</dd>
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
    </li>
  )
}

const RoundBlock = ({
  round,
  chainId,
  requesterName,
}: {
  round: JuryRound
  chainId?: number | null
  requesterName: string
}) => {
  const tally = round.tally
  const choices = tally
    ? tally.counts
        .map((count, choice) => ({
          choice,
          count,
          label: choiceLabel(choice, requesterName),
          color: VIZ[choice % VIZ.length],
        }))
        .filter((entry) => entry.count > 0)
    : []
  const cast = choices.reduce((sum, entry) => sum + entry.count, 0)

  return (
    <Round>
      <RoundHead>
        <Label $tone="faint">
          Round {round.round} · {round.slots} vote
          {round.slots === 1 ? '' : 's'}
        </Label>
        {round.drawn < round.slots && (
          <Seats>
            {round.slots - round.drawn} of {round.slots} seats still to be drawn
          </Seats>
        )}
      </RoundHead>
      <Jurors>
        {round.jurors.map((juror) => (
          <JurorRow
            key={juror.address}
            juror={juror}
            chainId={chainId}
            requesterName={requesterName}
          />
        ))}
      </Jurors>
      {tally && choices.length > 0 && (
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
          <TallyBar aria-hidden>
            {choices.map((entry) => (
              <span
                key={entry.choice}
                style={{ flexGrow: entry.count, background: entry.color }}
              />
            ))}
          </TallyBar>
          <TallyKey aria-hidden>
            {choices.map((entry) => (
              <li key={entry.choice}>
                <i style={{ background: entry.color }} />
                {entry.label} <b>{entry.count}</b>
              </li>
            ))}
          </TallyKey>
          <Seats aria-hidden>
            {tally.tied
              ? 'The votes are tied.'
              : `Most votes: ${choiceLabel(tally.winning, requesterName)}.`}
          </Seats>
        </Tally>
      )}
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
}: {
  chainId?: number | null
  arbitrator?: string | null
  disputeID?: string | null
  /** "submitter" or "requester": what a vote for that side is called. */
  requesterName: string
  /**
   * Vote slots per round, oldest first (CourtDispute.roundSlots). More than
   * one round gives the band its tabs; without the value the read's own
   * default is shown (the live round and the one appealed from).
   */
  rounds?: number[]
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
  const slots = tabbed ? rounds![appeal!] : undefined
  const live = picks[0] ?? shown[0]
  // Collapsed, the pill says what the jury is: how many rounds there were
  // when there were several, and otherwise how much of the one round's
  // bench has been drawn. The distinct addresses are named separately when
  // they are fewer than the seats (a juror can hold several seats).
  const addresses = live?.jurors.length ?? 0
  const seats = tabbed
    ? `${rounds!.length} rounds`
    : live
      ? `${
          live.drawn < live.slots
            ? `${live.drawn} of ${live.slots} seats drawn`
            : `${live.slots} seat${live.slots === 1 ? '' : 's'} drawn`
        }${
          addresses > 0 && addresses !== live.drawn
            ? ` · ${addresses} address${addresses === 1 ? '' : 'es'}`
            : ''
        }`
      : `${slots} seat${slots === 1 ? '' : 's'}`

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
              requesterName={requesterName}
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
            Jurors’ addresses, their votes and the commitments that seal them
            come from the court contract. Court v1 does not publish the
            justification a juror writes with a hidden vote.
          </Honest>
        </Rounds>
      )}
    </Band>
  )
}

export default JuryRounds
