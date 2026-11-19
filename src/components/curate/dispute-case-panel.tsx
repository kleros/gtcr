import React from 'react'
import styled, { css, keyframes } from 'styled-components'
import {
  openEvidenceComposer,
  scrollToEvidenceHistory,
} from 'components/inline-evidence-composer'
import useDisputeTimeline from 'hooks/use-dispute-timeline'
import useCourtName from 'hooks/use-court-name'
import {
  Button,
  ButtonAnchor,
  Label,
  StatusDot,
  Surface,
} from 'components/curate/primitives'
import { CurateIcon } from './icons'
import { DisputePeriodSteps } from './dispute-period-steps'
import { JuryRounds } from './dispute-jury'
import { COURT_PERIOD, currentPeriod } from './dispute-timeline-model'

/*
 * The live case, in one region (the design review's point 6.2: it used to
 * be spread over the hero, the action card and a rail card, each restating
 * the case number). One panel, three bands separated by hairlines, no panel
 * inside a panel:
 *
 *   1. that a dispute is running right now, under a pulsing light and a
 *      louder label, in a panel lit amber at its edge (round 3: a quiet
 *      "In court" eyebrow read like every other label, so it should be
 *      catchy), what it means for this entry, the case's own facts and the
 *      actions;
 *   2. the periods of the current round;
 *   3. the jury, collapsed into a pill.
 *
 * The court read refines band 1 and draws bands 2 and 3; without it (an
 * arbitrator other than Kleros, or a read that failed) band 1 still says
 * where the case stands from what the page already knows, so the region
 * never depends on the chain answering.
 *
 * The round and the jury size are not repeated here: the period band's head
 * states both, and the loud status line takes the room instead.
 */

/*
 * The id the phone's sticky action bar steps aside for: it watches the block
 * that holds the entry's actions (WATCHED_IDS in item-standard-action-bar.tsx)
 * so its own button never doubles that block's. In court the status card is
 * gone and this panel is that block, so it takes the id then — and only then,
 * since the card keeps it in every other state. Once the ruling stands the
 * record panel holds it, for the same reason.
 */
export const PAGE_ACTIONS_ID = 'item-status-card'

const Panel = styled(Surface)<{ $live?: boolean }>`
  display: flex;
  flex-direction: column;

  > * {
    padding: 22px 24px;
  }

  > * + * {
    border-top: 1px solid var(--glass-border);
  }

  /*
   * A case running right now is lit in the contested status role, as an
   * edge and a light, never as a fill: an amber border at 45%, a 2px amber
   * lip clipped to the panel's radius over the kit's own 1px highlight, a
   * 3px soft halo around the panel (the launch page's chosen card does the
   * same in the edge hue) and an amber light pooled in the top-left corner,
   * under the pulsing dot. The list ends in --shadow-card, which every
   * theme keeps a valid shadow (theme-context.tsx), so none of it drops.
   */
  ${({ $live }) =>
    $live &&
    css`
      border-color: color-mix(
        in srgb,
        var(--status-contested) 45%,
        var(--glass-border)
      );
      background:
        radial-gradient(
          120% 160px at 0 0,
          color-mix(in srgb, var(--status-contested) 9%, transparent),
          transparent 70%
        ),
        var(--color-surface);
      box-shadow:
        inset 0 2px 0 var(--status-contested),
        inset 0 1px 0 var(--glass-highlight),
        0 0 0 3px color-mix(in srgb, var(--status-contested) 12%, transparent),
        var(--shadow-card);
    `}

  @media (max-width: 720px) {
    > * {
      padding: 18px;
    }
  }
`

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--status-contested) 55%, transparent); }
  70% { box-shadow: 0 0 0 9px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
`

/* The light on a case being decided right now: a 10px dot in the contested
   role, its halo breathing on the kit's entrance curve. Nothing in the app
   blinks, so this does not either, and reduced motion parks it on the dot's
   own static halo. */
const Pulse = styled(StatusDot)`
  width: 10px;
  height: 10px;
  animation: ${pulse} 2.4s var(--ease-out) infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const LiveLine = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 10px;
`

/* ONGOING DISPUTE: a step above every other eyebrow (12px, 600), in the
   text colour, since status words never take a status hue (the dot does). */
const LiveLabel = styled(Label)`
  font-size: 12px;
  line-height: 16px;
  font-weight: 600;
  letter-spacing: 0.1em;
`

const Lead = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const Top = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px 24px;
`

const Words = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  max-width: 62ch;
`

const Heading = styled.h2`
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: 22px;
  line-height: 28px;
  font-weight: 500;
  letter-spacing: -0.025em;
`

const Next = styled.p`
  margin: 0;
  color: var(--color-muted);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
`

/* On a phone the actions stack full width, aligned to the panel's edges,
   as the base branch's in-court card had them: wrapped at their own widths
   they read as three ragged pills. */
const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;

  @media (max-width: 720px) {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    width: 100%;

    > * {
      width: 100%;
      justify-content: center;
    }
  }
`

const Facts = styled.dl`
  display: flex;
  flex-wrap: wrap;
  gap: 12px 32px;
  margin: 0;

  div {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  dd {
    margin: 0;
    min-width: 0;
    color: var(--color-text);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }

  a {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--color-primary);
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }
`

const Fact = ({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) => (
  <div>
    <Label as="dt" $tone="faint">
      {label}
    </Label>
    <dd>{children}</dd>
  </div>
)

export const DisputeCasePanel = ({
  chainId,
  arbitrator,
  arbitrable,
  disputeID,
  disputeHref,
  disputeHost,
  requesterName,
  heading,
  awaitingCourt = true,
  summary,
  ruling,
  rulingLabel = 'Ruling',
  canAddEvidence,
  holdsPageActions = false,
  now,
}: {
  chainId?: number | null
  arbitrator?: string | null
  /** The list's contract: a case raised by another contract is not read. */
  arbitrable?: string | null
  disputeID?: string | null
  /** The case on the court site, when the arbitrator is Kleros. */
  disputeHref?: string
  disputeHost?: string
  /** "submitter" or "requester": what a vote for that side is called. */
  requesterName: string
  /** Where the case stands, when the court itself cannot be read. */
  heading: string
  /**
   * The entry is waiting on the court, so the court's own word for the
   * period it is in leads ("Jurors are voting"). Once the list has its own
   * ruling state, `heading` leads instead: the court's appeal period can
   * still be running after the list has settled what happens to this entry.
   */
  awaitingCourt?: boolean
  /** What it means for this entry; nothing when the page has nothing to add. */
  summary?: string
  /** "For the submitter", "Refused to rule"… when the jurors have ruled. */
  ruling?: string
  rulingLabel?: string
  /** The contracts take evidence only while the request is open. */
  canAddEvidence: boolean
  /**
   * This panel is the page's one action block (the status card is not
   * rendered), so the phone's sticky bar steps aside for it.
   */
  holdsPageActions?: boolean
  now: number
}) => {
  const { data: dispute } = useDisputeTimeline({
    chainId,
    arbitrator,
    arbitrable,
    disputeID,
  })
  const courtName = useCourtName(chainId, dispute?.court)
  if (!disputeID) return null

  const period = dispute ? currentPeriod(dispute) : undefined
  // The court's word for its own period leads while the entry waits on it
  // ("Jurors are voting"); the page's own heading leads once the list has
  // its ruling, or without the court read.
  const title = (awaitingCourt ? period?.title : undefined) ?? heading
  // Jurors are still deciding, so the dispute is running now. Without the
  // court read the page's own word for it decides.
  const live =
    awaitingCourt &&
    !dispute?.ruled &&
    (dispute?.period ?? 0) < COURT_PERIOD.EXECUTION

  return (
    <Panel
      as="section"
      id={holdsPageActions ? PAGE_ACTIONS_ID : undefined}
      $padding="none"
      $live={live}
      aria-label={
        live ? `Ongoing dispute ${disputeID}` : `Case ${disputeID} in court`
      }
    >
      <Lead>
        <Top>
          <Words>
            {live ? (
              <LiveLine>
                <Pulse $tone="contested" aria-hidden />
                {/* Label uppercases and tracks it: ONGOING DISPUTE. */}
                <LiveLabel $tone="text">Ongoing dispute</LiveLabel>
              </LiveLine>
            ) : (
              <Label $tone="faint">In court</Label>
            )}
            <Heading>{title}</Heading>
            {summary && <Next>{summary}</Next>}
          </Words>
          {/* The page's actions while in court: the entry's floating bar
              stays away while they are in view (item-standard-action-bar). */}
          <Actions data-entry-action>
            {canAddEvidence && (
              <Button
                type="button"
                $variant="primary"
                onClick={openEvidenceComposer}
              >
                <CurateIcon name="policy" size={16} />
                Add evidence
              </Button>
            )}
            {/* Beside filing a piece: the pieces already filed, in the
                history, with its newest group open. */}
            <Button
              type="button"
              $variant="secondary"
              onClick={scrollToEvidenceHistory}
            >
              <CurateIcon name="list" size={16} />
              Read evidence
            </Button>
            {disputeHref && (
              <ButtonAnchor
                $variant="secondary"
                href={disputeHref}
                target="_blank"
                rel="noopener noreferrer"
                title={
                  disputeHost
                    ? `Case ${disputeID} on ${disputeHost}`
                    : undefined
                }
              >
                Follow case {disputeID} in court
                <CurateIcon name="external" size={14} />
              </ButtonAnchor>
            )}
          </Actions>
        </Top>
        <Facts>
          {/* The button above names the case when it can be opened; without
              a court site to open, the number is a fact like the others. */}
          {!disputeHref && <Fact label="Case">{disputeID}</Fact>}
          {courtName && <Fact label="Court">{courtName}</Fact>}
          {ruling && <Fact label={rulingLabel}>{ruling}</Fact>}
        </Facts>
      </Lead>
      {dispute && <DisputePeriodSteps dispute={dispute} now={now} />}
      <JuryRounds
        chainId={chainId}
        arbitrator={arbitrator}
        disputeID={disputeID}
        arbitrable={arbitrable}
        requesterName={requesterName}
        rounds={dispute?.roundSlots}
        period={dispute?.period}
        hiddenVotes={dispute?.hiddenVotes}
      />
    </Panel>
  )
}

export default DisputeCasePanel
