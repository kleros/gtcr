import React, { useState } from 'react'
import styled from 'styled-components'
import useDisputeTimeline from 'hooks/use-dispute-timeline'
import useCourtName from 'hooks/use-court-name'
import {
  openEvidenceComposer,
  scrollToEvidenceHistory,
} from 'components/inline-evidence-composer'
import {
  Button,
  ButtonAnchor,
  Label,
  SegmentedControl,
  Surface,
} from 'components/curate/primitives'
import { CurateIcon } from './icons'
import { JuryRounds } from './dispute-jury'
import { PAGE_ACTIONS_ID } from './dispute-case-panel'

/*
 * A dispute the court has already decided (round 3 of the design review:
 * "when a dispute is over it is just bad"). The live panel's period spine,
 * its clock and its loud heading all describe something happening now, so a
 * case whose ruling already stands gets none of them. What is left is the
 * record: which case it was, how it went, and the jurors who voted —
 * collapsed behind the jury's pill, in the page's left column with the
 * entry's own detail rather than full width under the hero.
 *
 * An entry can carry several decided cases: a Stake entry can be challenged
 * again and again, and a Standard entry has one per disputed request. They
 * are tabbed, newest first, exactly as the history numbers them, and only
 * the chosen one is read.
 *
 * Where it is the page's one action block it keeps the entry's actions,
 * because the status card is not rendered while the entry waits on the court
 * (item-status-card.tsx) and the ruling standing is one of those states:
 * without them the page would lose "Add evidence" and the phone bar would
 * lose the block it steps aside for.
 */

/** One decided case, as the entry's requests or challenges record it. */
export interface DisputeRecord {
  disputeID: string
  /** The arbitrator the request was made with; a past one can differ. */
  arbitrator?: string
  /** "submitter" or "requester": what a vote for that side is called. */
  requesterName: string
  /** How it went, in the page's words ("For the challenger"). */
  ruling?: string
  /** The case on the court site, when the arbitrator is Kleros. */
  href?: string
  host?: string
}

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

/* The eyebrow sits on the actions' line: one row, not a heading over a
   block, since the record has nothing to announce. */
const Top = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 24px;
`

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`

/* The case track hugs its options: a recess pill, not a full-width bar. */
const Tabs = styled.div`
  display: flex;
  min-width: 0;
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

export const DisputeRecordPanel = ({
  chainId,
  arbitrable,
  disputes,
  canAddEvidence = false,
  holdsPageActions = false,
}: {
  chainId?: number | null
  /** The list's contract: a case raised by another contract is not read. */
  arbitrable?: string | null
  /** Newest first, as the history numbers them; empty draws nothing. */
  disputes: DisputeRecord[]
  /** The contracts take evidence only while the request is open. */
  canAddEvidence?: boolean
  /** The phone's sticky bar steps aside for this block (see the comment). */
  holdsPageActions?: boolean
}) => {
  const [picked, setPicked] = useState<string>()
  // The newest case is the one the entry's status came from, so it leads.
  const record =
    disputes.find((dispute) => dispute.disputeID === picked) ?? disputes[0]
  const { data: dispute } = useDisputeTimeline({
    chainId,
    arbitrator: record?.arbitrator,
    arbitrable,
    disputeID: record?.disputeID,
  })
  const courtName = useCourtName(chainId, dispute?.court)
  if (!record) return null

  const several = disputes.length > 1
  // The number is a fact only where nothing else states it.
  const caseFact = !record.href && !several
  const hasFacts = caseFact || !!courtName || !!record.ruling

  return (
    <Panel
      as="section"
      id={holdsPageActions ? PAGE_ACTIONS_ID : undefined}
      $padding="none"
      aria-label={
        several
          ? `${disputes.length} decided cases on this entry`
          : `Case ${record.disputeID}, decided`
      }
    >
      <Lead>
        <Top>
          <Label $tone="faint">Court record</Label>
          <Actions>
            {/* The entry's own actions, only where this panel is the block
                that holds them: anywhere else the status card has them
                already, and a second "Add evidence" would just double it. */}
            {holdsPageActions && (
              <>
                {canAddEvidence && (
                  <Button
                    type="button"
                    $variant="secondary"
                    $size="sm"
                    onClick={openEvidenceComposer}
                  >
                    <CurateIcon name="policy" size={15} />
                    Add evidence
                  </Button>
                )}
                <Button
                  type="button"
                  $variant="secondary"
                  $size="sm"
                  onClick={scrollToEvidenceHistory}
                >
                  <CurateIcon name="list" size={15} />
                  Read evidence
                </Button>
              </>
            )}
            {record.href && (
              <ButtonAnchor
                $variant="secondary"
                $size="sm"
                href={record.href}
                target="_blank"
                rel="noopener noreferrer"
                title={
                  record.host
                    ? `Case ${record.disputeID} on ${record.host}`
                    : undefined
                }
              >
                Case {record.disputeID} in court
                <CurateIcon name="external" size={14} />
              </ButtonAnchor>
            )}
          </Actions>
        </Top>
        {several && (
          <Tabs>
            <SegmentedControl
              size="sm"
              ariaLabel="Case"
              value={record.disputeID}
              options={disputes.map((entry) => ({
                value: entry.disputeID,
                label: `Case ${entry.disputeID}`,
              }))}
              onChange={setPicked}
            />
          </Tabs>
        )}
        {hasFacts && (
          <Facts>
            {/* The button above names the case when it can be opened, and
                the tabs do when there are several. */}
            {caseFact && <Fact label="Case">{record.disputeID}</Fact>}
            {courtName && <Fact label="Court">{courtName}</Fact>}
            {record.ruling && <Fact label="Ruling">{record.ruling}</Fact>}
          </Facts>
        )}
      </Lead>
      {/* The only depth the record keeps: who voted, and which way. Its own
          rounds are tabbed inside it when the case was appealed, and it
          holds that choice itself, so it is keyed by the case: switching
          cases starts the band on the new case's newest round instead of
          keeping a round number that belonged to the old one. */}
      <JuryRounds
        key={record.disputeID}
        chainId={chainId}
        arbitrator={record.arbitrator}
        disputeID={record.disputeID}
        requesterName={record.requesterName}
        rounds={dispute?.roundSlots}
      />
    </Panel>
  )
}

export default DisputeRecordPanel
