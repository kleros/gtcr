import React, { useState } from 'react'
import styled from 'styled-components'
import ReactBlockies from 'react-blockies'
import { Popover } from 'components/ui'
import useDisputeJury, {
  type JuryJuror,
  type JuryRound,
} from 'hooks/use-dispute-jury'
import { getAddressPage } from 'utils/network-utils'
import { ChromeAddress } from './chrome-address'
import { CurateIcon } from './icons'
import {
  Data,
  Label,
  StatusDot,
  truncateMiddle,
  type StatusTone,
} from './primitives'
import { choiceLabel } from './dispute-timeline-model'
import { DisclosurePill } from './item-disclosure-pill'

/*
 * Who is judging the case, inside the case panel: the jurors the court drew
 * for each round, where each one is, and which way the ones who revealed
 * voted. Secondary depth, so it stays collapsed behind a pill until it is
 * asked for (DESIGN.md: data first, explainers collapse into a pill).
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

/** The chart colours, in choice order: refuse, then each side. */
const VIZ = ['var(--viz-3)', 'var(--viz-1)', 'var(--viz-2)', 'var(--viz-4)']

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
 * The case's jury, collapsed into a pill. Renders nothing when the jury
 * cannot be read (another arbitrator, no answer, a round too large to read
 * seat by seat): the panel around it still says where the case stands.
 */
export const DisputeJury = ({
  chainId,
  arbitrator,
  disputeID,
  requesterName,
}: {
  chainId?: number | null
  arbitrator?: string | null
  disputeID?: string | null
  /** "submitter" or "requester": what a vote for that side is called. */
  requesterName: string
}) => {
  const [open, setOpen] = useState(false)
  const { data: jury } = useDisputeJury({ chainId, arbitrator, disputeID })
  if (!jury || jury.rounds.length === 0) return null

  // The pill counts the live round's seats, as the Fact above it does
  // (dispute.jurors is the round's vote slots): a juror drawn for several
  // seats would otherwise make the two figures disagree. The distinct
  // addresses are named separately when they are fewer.
  const live = jury.rounds[0]
  const seats =
    live.drawn < live.slots
      ? `${live.drawn} of ${live.slots} seats drawn`
      : `${live.slots} seat${live.slots === 1 ? '' : 's'} drawn`
  const addresses = live.jurors.length

  return (
    <Band aria-label="The jury">
      <DisclosurePill
        icon="user"
        open={open}
        onToggle={() => setOpen((shown) => !shown)}
        controls={`jury-${disputeID}`}
      >
        The jury · {seats}
        {addresses > 0 && addresses !== live.drawn
          ? ` · ${addresses} address${addresses === 1 ? '' : 'es'}`
          : ''}
      </DisclosurePill>
      {open && (
        <Rounds id={`jury-${disputeID}`}>
          {jury.rounds.map((round) => (
            <RoundBlock
              key={round.appeal}
              round={round}
              chainId={chainId}
              requesterName={requesterName}
            />
          ))}
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

export default DisputeJury
