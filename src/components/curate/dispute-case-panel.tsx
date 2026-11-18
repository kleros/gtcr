import React from 'react'
import styled from 'styled-components'
import { openEvidenceComposer } from 'components/inline-evidence-composer'
import useDisputeTimeline from 'hooks/use-dispute-timeline'
import useCourtName from 'hooks/use-court-name'
import {
  Button,
  ButtonAnchor,
  Label,
  Surface,
} from 'components/curate/primitives'
import { CurateIcon } from './icons'
import { DisputePeriodSteps } from './dispute-period-steps'
import { DisputeJury } from './dispute-jury'
import { currentPeriod } from './dispute-timeline-model'

/*
 * The live case, in one region (the design review's point 6.2: it used to
 * be spread over the hero, the action card and a rail card, each restating
 * the case number). One panel, three bands separated by hairlines, no panel
 * inside a panel:
 *
 *   1. where the case stands, in the court's own words, with what happens
 *      next, the case's facts and the two actions;
 *   2. the periods of the current round;
 *   3. the jury, collapsed into a pill.
 *
 * The court read refines band 1 and draws bands 2 and 3; without it (an
 * arbitrator other than Kleros, or a read that failed) band 1 still says
 * where the case stands from what the page already knows, so the region
 * never depends on the chain answering.
 */

/*
 * The id the phone's sticky action bar steps aside for: it watches the block
 * that holds the entry's actions (WATCHED_IDS in item-standard-action-bar.tsx)
 * so its own button never doubles that block's. In court the status card is
 * gone and this panel is that block, so it takes the id then — and only then,
 * since the card keeps it in every other state.
 */
const PAGE_ACTIONS_ID = 'item-status-card'

const Panel = styled(Surface)`
  display: flex;
  flex-direction: column;

  > * {
    padding: 22px 24px;
  }

  > * + * {
    border-top: 1px solid var(--glass-border);
  }

  @media (max-width: 720px) {
    > * {
      padding: 18px;
    }
  }
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

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
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
  /** What it means for this entry; the court's own sentence when absent. */
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
  const next = summary ?? period?.next

  return (
    <Panel
      as="section"
      id={holdsPageActions ? PAGE_ACTIONS_ID : undefined}
      $padding="none"
      aria-label={`Case ${disputeID} in court`}
    >
      <Lead>
        <Top>
          <Words>
            <Label $tone="faint">In court</Label>
            <Heading>
              {(awaitingCourt ? period?.title : undefined) ?? heading}
            </Heading>
            {next && <Next>{next}</Next>}
          </Words>
          <Actions>
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
          {dispute && (
            <>
              <Fact label="Round">{dispute.round}</Fact>
              <Fact label="Jury">
                {dispute.jurors} juror{dispute.jurors === 1 ? '' : 's'}
              </Fact>
            </>
          )}
          {ruling && <Fact label={rulingLabel}>{ruling}</Fact>}
        </Facts>
      </Lead>
      {dispute && <DisputePeriodSteps dispute={dispute} now={now} />}
      <DisputeJury
        chainId={chainId}
        arbitrator={arbitrator}
        disputeID={disputeID}
        requesterName={requesterName}
      />
    </Panel>
  )
}

export default DisputeCasePanel
