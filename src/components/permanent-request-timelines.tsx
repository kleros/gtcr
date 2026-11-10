import React, { useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'
import useNow from 'hooks/use-now'
import useUrlChainId from 'hooks/use-url-chain-id'
import EvidenceFileLink from 'components/evidence-file-link'
import { AddressLink } from 'components/curate/item-stake-address'
import { CONTRACT_STATUS, SUBGRAPH_RULING } from 'utils/permanent-item-status'
import { capitalizeFirstLetter } from 'utils/string'
import { getTxPage } from 'utils/network-utils'
import { parseIpfs } from 'utils/ipfs-parse'
import { formatDate } from 'utils/time'
import PermanentEvidenceModal from 'pages/permanent-item-details/modals/evidence'
import toOrdinal from 'utils/ordinal'
import { CurateIcon } from 'components/curate/icons'
import {
  EvidenceClosed,
  openEvidenceComposer,
} from 'components/inline-evidence-composer'
import {
  SkeletonBlock,
  Small,
  StatusDot,
  Surface,
  type StatusTone,
} from 'components/curate/primitives'
import {
  Timeline as EventList,
  TimelineEvent,
  TimelineQuote,
} from 'components/curate/item-light-timeline'

/*
 * History of a Stake Curate item, on the Light item's composition: one
 * panel, one group per submission (newest first, the latest open), each a
 * glowing vertical timeline of every event the subgraph recorded
 * (submission, evidence, challenge, rulings, appeals, withdrawal) with
 * absolute UTC dates linked to their transactions; then the evidence
 * composer, always open while the item is on the list (the contract takes
 * evidence on any item that is not Absent) and a one-line note otherwise.
 */

/**
 * Round fields beyond the shared SubgraphRound. The permanent item query does
 * not currently select the appeal times or transaction hashes, so they stay
 * optional.
 */
interface TimelineRound extends SubgraphRound {
  txHashAppealPossible?: string | null
  appealedAt?: string | null
  txHashAppealDecision?: string | null
}

/** Challenge fields the permanent item query selects. */
interface TimelineChallenge extends SubgraphChallenge {
  disputeID?: string
  challenger?: string
  createdAt?: string | null
  creationTx?: string | null
  resolutionTime?: string | null
  resolutionTx?: string | null
  disputeOutcome?: string | null
  rounds: TimelineRound[]
}

/** Evidence as selected by the permanent item query. */
interface TimelineEvidence {
  party: string
  URI: string
  number?: string
  timestamp: string
  txHash: string
  metadata?: {
    name?: string | null
    title?: string | null
    description?: string | null
    fileURI?: string | null
    fileTypeExtension?: string | null
  } | null
}

/** A submission row of a permanent item. */
interface TimelineSubmission {
  id?: string
  withdrawingTimestamp?: string | null
  createdAt?: string | null
  creationTx?: string | null
  finishedAt?: string | null
  finishedTx?: string | null
  withdrawingTx?: string | null
  submitter?: string | null
}

/** A permanent item with the nested rows the timeline reads. */
interface PermanentTimelineItem extends SubgraphItem {
  submitter?: string
  challenges?: TimelineChallenge[]
  evidences?: TimelineEvidence[]
  submissions?: TimelineSubmission[]
}

interface TimelineLogBase {
  timestamp?: string | null
  transactionHash?: string | null
}

interface AppealPossibleLog extends TimelineLogBase {
  name: 'AppealPossible'
  appealableRuling: string
  disputeID?: string
}

interface AppealDecisionLog extends TimelineLogBase {
  name: 'AppealDecision'
  /** The appealed round's ruling and when it was given. */
  ruling?: string | null
  ruledAt?: number
  /** The appealed round's appeal period ended here: the appeal came before. */
  appealEnd?: number
  /** The query has no appeal time: `timestamp` only places the event. */
  approximate: boolean
  disputeID?: string
  /** The new round's ruling is still to come. */
  ongoing: boolean
}

interface EvidenceLog extends TimelineLogBase {
  name: 'Evidence'
  title?: string | null
  description?: string | null
  URI: string
  fileURI?: string | null
  fileTypeExtension?: string | null
  party: string
}

interface ResolutionLog extends TimelineLogBase {
  name: 'Resolution'
  disputeOutcome?: string | null
  /** The newest round the jurors ruled on. */
  lastRuling?: string | null
  /** The one side fully funded on that round, if only one was. */
  soleFunder?: 'submitter' | 'challenger'
  disputeID?: string
}

interface ChallengeLog extends TimelineLogBase {
  name: 'Challenge'
  challenger?: string
  disputeID?: string
}

interface WithdrawalLog extends TimelineLogBase {
  name: 'Withdrawal'
}

interface WithdrawalCompletedLog extends TimelineLogBase {
  name: 'WithdrawalCompleted'
}

type TimelineLog =
  | AppealPossibleLog
  | AppealDecisionLog
  | EvidenceLog
  | ResolutionLog
  | ChallengeLog
  | WithdrawalLog
  | WithdrawalCompletedLog

interface EvidenceFile {
  title?: string | null
  description?: string | null
  fileURI?: string | null
  fileTypeExtension?: string | null
}

const toSeconds = (value: unknown): number => {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

/* ---------- Evidence text ---------- */

const Clamp = styled.p<{ $clamped: boolean }>`
  ${({ $clamped }) =>
    $clamped &&
    `
    display: -webkit-box;
    -webkit-line-clamp: 6;
    -webkit-box-orient: vertical;
    overflow: hidden;
  `}
`

const MoreButton = styled.button`
  padding: 0;
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

/** Long evidence opens at six lines; the rest is one click away. */
const EvidenceText = ({ text }: { text: string }) => {
  const long = text.length > 420 || text.split('\n').length > 6
  const [expanded, setExpanded] = useState(false)
  return (
    <>
      <Clamp $clamped={long && !expanded}>{text}</Clamp>
      {long && (
        <MoreButton
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less' : 'Read all'}
        </MoreButton>
      )}
    </>
  )
}

const rulingLine = (ruling: string | null | undefined): string => {
  switch (ruling) {
    case SUBGRAPH_RULING.NONE:
      return 'Jurors refused to rule'
    case SUBGRAPH_RULING.ACCEPT:
      return 'Jurors ruled for the submitter'
    case SUBGRAPH_RULING.REJECT:
      return 'Jurors ruled for the challenger'
    default:
      return 'Jurors gave an unknown ruling'
  }
}

/** "jurors had ruled for the submitter": the ruling an outcome overrode. */
const hadRuledLine = (ruling: string | null | undefined): string => {
  switch (ruling) {
    case SUBGRAPH_RULING.NONE:
      return 'jurors had refused to rule'
    case SUBGRAPH_RULING.ACCEPT:
      return 'jurors had ruled for the submitter'
    case SUBGRAPH_RULING.REJECT:
      return 'jurors had ruled for the challenger'
    default:
      return ''
  }
}

/* ---------- One submission ---------- */

interface TimelineProps {
  submission: TimelineSubmission
  item: PermanentTimelineItem
  metaEvidence?: MetaEvidence
  /** Something is running on this submission: its latest event pulses. */
  live: boolean
}

const Timeline = ({ submission, item, metaEvidence, live }: TimelineProps) => {
  const networkId = useUrlChainId()
  const [evidenceMap, setEvidenceMap] = useState<Record<string, EvidenceFile>>()

  // This submission has a range (createdAt, finishedAt). Take every event of
  // the item, keep the ones inside the range, then sort them.
  const logs = useMemo(() => {
    if (!submission) return null

    const challengeRows = item.challenges ?? []

    const appealPossibles = challengeRows
      .flatMap((c) =>
        c.rounds.map(
          (r): AppealPossibleLog => ({
            name: 'AppealPossible',
            timestamp: r.appealPeriodStart,
            transactionHash: r.txHashAppealPossible,
            appealableRuling: r.ruling,
            disputeID: c.disputeID,
          }),
        ),
      )
      .filter((appeal) => !!appeal.transactionHash)

    // Rounds come newest first and a new round exists only once both sides
    // funded an appeal, so every round after the first was appealed. The
    // query selects no appeal time or transaction: the event is placed just
    // after the appealed ruling and dated by its window instead.
    const appealDecisions = challengeRows.flatMap((c) =>
      c.rounds.slice(1).map((r): AppealDecisionLog => {
        const ruledAt =
          toSeconds(r.rulingTime) || toSeconds(r.appealPeriodStart)
        const appealedAt = toSeconds(r.appealedAt)
        return {
          name: 'AppealDecision',
          timestamp: String(
            appealedAt ||
              (ruledAt ? ruledAt + 1 : 0) ||
              toSeconds(c.resolutionTime) ||
              toSeconds(c.createdAt),
          ),
          transactionHash: r.txHashAppealDecision,
          ruling: ruledAt ? r.ruling : undefined,
          ruledAt: ruledAt || undefined,
          appealEnd: toSeconds(r.appealPeriodEnd) || undefined,
          approximate: !appealedAt,
          disputeID: c.disputeID,
          ongoing: !c.disputeOutcome && !c.resolutionTime,
        }
      }),
    )

    const evidences = (item.evidences ?? []).map(
      (e): EvidenceLog => ({
        name: 'Evidence',
        timestamp: e.timestamp,
        transactionHash: e.txHash,
        title: e.metadata?.title,
        description: e.metadata?.description,
        URI: e.URI,
        fileURI: e.metadata?.fileURI,
        fileTypeExtension: e.metadata?.fileTypeExtension,
        party: e.party,
      }),
    )

    const resolutions = challengeRows.map((e): ResolutionLog => {
      // Rounds come newest first; after an appeal the newest can be an empty
      // round the jurors never ruled on, so take the newest ruled one.
      const lastRuled = e.rounds.find((r) => toSeconds(r.rulingTime) > 0)
      const paidSubmitter = !!lastRuled?.hasPaidRequester
      const paidChallenger = !!lastRuled?.hasPaidChallenger
      return {
        name: 'Resolution',
        timestamp: e.resolutionTime,
        transactionHash: e.resolutionTx,
        disputeOutcome: e.disputeOutcome,
        lastRuling: lastRuled?.ruling,
        soleFunder:
          paidSubmitter !== paidChallenger
            ? paidSubmitter
              ? 'submitter'
              : 'challenger'
            : undefined,
        disputeID: e.disputeID,
      }
    })

    const challenges = challengeRows.map(
      (e): ChallengeLog => ({
        name: 'Challenge',
        timestamp: e.createdAt,
        transactionHash: e.creationTx,
        challenger: e.challenger,
        disputeID: e.disputeID,
      }),
    )

    const logArray: TimelineLog[] = [
      ...appealPossibles,
      ...appealDecisions,
      ...evidences,
      ...resolutions,
      ...challenges,
    ]

    const withdrawal: WithdrawalLog | null =
      Number(submission.withdrawingTimestamp) !== 0
        ? {
            name: 'Withdrawal',
            timestamp: submission.withdrawingTimestamp,
            transactionHash: submission.withdrawingTx,
          }
        : null

    if (withdrawal) logArray.push(withdrawal)

    // The only paths to Absent are withdrawItem() and rule(). Dispute removals are
    // already rendered as Resolution nodes (whose tx equals the ruling tx), so a
    // finishedTx that is NOT any resolution tx can only be a completed voluntary
    // withdrawal (the withdrawItem() execution).
    const resolutionTxs = new Set(
      challengeRows.map((c) => c.resolutionTx).filter((tx) => !!tx),
    )

    // The query may not select finishedTx: then a finished submission that
    // had started a withdrawal and did not end on a ruling was withdrawn.
    const resolutionTimes = new Set(
      challengeRows.map((c) => c.resolutionTime).filter((time) => !!time),
    )
    const completedWithdrawal = submission.finishedTx
      ? !resolutionTxs.has(submission.finishedTx)
      : !!submission.finishedAt &&
        !!submission.withdrawingTx &&
        !resolutionTimes.has(submission.finishedAt)

    const withdrawalCompleted: WithdrawalCompletedLog | null =
      completedWithdrawal
        ? {
            name: 'WithdrawalCompleted',
            timestamp: submission.finishedAt,
            transactionHash: submission.finishedTx,
          }
        : null

    if (withdrawalCompleted) logArray.push(withdrawalCompleted)

    return logArray
      .filter(
        (log) =>
          Number(submission.createdAt) <= Number(log.timestamp) &&
          (submission.finishedAt === null ||
            submission.finishedAt === undefined ||
            Number(submission.finishedAt) >= Number(log.timestamp)),
      )
      .sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
  }, [item, submission])

  // The Graph can fail to index the evidence fields. Load unloaded fields manually.
  useEffect(() => {
    if (!logs || evidenceMap) return
    const evidenceManualFetch = async () => {
      const unindexedEvidenceURIs = logs
        .filter((e): e is EvidenceLog => e.name === 'Evidence')
        .filter(
          (e) =>
            e.title === null &&
            e.description === null &&
            e.fileURI === null &&
            e.fileTypeExtension === null,
        )
        .map((e) => e.URI)

      const evidenceJSONs = await Promise.all(
        unindexedEvidenceURIs.map(async (uri) => {
          const file = await (await fetch(parseIpfs(uri))).json()
          return file
        }),
      )
      const evidenceMapProcess: Record<string, EvidenceFile> = {}
      unindexedEvidenceURIs.forEach((uri, index) => {
        evidenceMapProcess[uri] = evidenceJSONs[index]
      })
      setEvidenceMap(evidenceMapProcess)
    }
    evidenceManualFetch().catch((err: unknown) => {
      console.error('Could not load unindexed evidence', err)
    })
  }, [logs, evidenceMap, setEvidenceMap])

  if (!item || !submission || !logs) return <SkeletonBlock $height="80px" />

  const metadata = metaEvidence?.metadata
  const itemName = metadata?.itemName
    ? capitalizeFirstLetter(metadata.itemName)
    : 'Item'
  const txPage = (txHash?: string | null) =>
    txHash ? getTxPage({ networkId: networkId ?? 0, txHash }) : undefined
  const submitter = (submission.submitter ?? item.submitter)?.toLowerCase()
  const challengers = new Set(
    (item.challenges ?? [])
      .map((c) => c.challenger?.toLowerCase())
      .filter((address): address is string => !!address),
  )
  const roleOf = (party?: string) => {
    const address = party?.toLowerCase()
    if (!address) return undefined
    if (address === submitter) return 'submitter'
    if (challengers.has(address)) return 'challenger'
    return undefined
  }
  const submissionBy = submission.submitter ?? item.submitter

  return (
    <EventList>
      <TimelineEvent
        tone="window"
        title={`${itemName} submitted`}
        timestamp={toSeconds(submission.createdAt)}
        href={txPage(submission.creationTx)}
        current={live && logs.length === 0}
        detail={
          submissionBy ? (
            <span>
              by <AddressLink address={submissionBy} />
            </span>
          ) : undefined
        }
      />
      {logs.map((event, i) => {
        const timestamp = toSeconds(event.timestamp)
        const href = txPage(event.transactionHash)
        const current = live && i === logs.length - 1
        const index = i + 1

        if (event.name === 'Evidence') {
          const { title, description, fileURI } = evidenceMap?.[event.URI]
            ? evidenceMap[event.URI]
            : event
          const role = roleOf(event.party)
          return (
            <TimelineEvent
              key={i}
              index={index}
              current={current}
              tone={
                role === 'challenger'
                  ? 'contested'
                  : role
                    ? 'window'
                    : 'neutral'
              }
              title={title || 'Evidence'}
              timestamp={timestamp}
              href={href}
              detail={
                <span>
                  by <AddressLink address={event.party} />
                  {role ? ` · ${role}` : ''}
                </span>
              }
            >
              {(description || fileURI) && (
                <TimelineQuote>
                  {description && <EvidenceText text={description} />}
                  {fileURI && <EvidenceFileLink fileURI={fileURI} />}
                </TimelineQuote>
              )}
            </TimelineEvent>
          )
        }

        if (event.name === 'AppealPossible')
          return (
            <TimelineEvent
              key={i}
              index={index}
              current={current}
              tone="contested"
              title={rulingLine(event.appealableRuling)}
              timestamp={timestamp}
              href={href}
              detail="Appeal period opened"
            />
          )

        if (event.name === 'AppealDecision') {
          const ruled = event.ruledAt
            ? `${rulingLine(event.ruling)} on ${formatDate(event.ruledAt)}`
            : undefined
          const funded = event.approximate
            ? `both sides funded the appeal${
                event.appealEnd ? ` by ${formatDate(event.appealEnd)}` : ''
              }`
            : 'both sides funded the appeal'
          const next = event.ongoing
            ? 'a new round of jurors decides'
            : 'a new round of jurors decided'
          const caseText =
            event.disputeID && Number(event.disputeID) !== 0
              ? `Case ${event.disputeID} · `
              : ''
          return (
            <TimelineEvent
              key={i}
              index={index}
              current={current}
              tone="contested"
              title="Ruling appealed"
              timestamp={event.approximate ? undefined : timestamp}
              href={href}
              detail={`${caseText}${capitalizeFirstLetter(
                ruled ? `${ruled}; ${funded}` : funded,
              )}, so ${next}.`}
            />
          )
        }

        if (event.name === 'Resolution') {
          // rule() favours the one side that funded the last ruled round
          // alone, whatever the jurors ruled: only then can they differ.
          const soleFunderWon =
            !!event.soleFunder &&
            !!event.lastRuling &&
            event.lastRuling !== event.disputeOutcome
          const why = (side: 'submitter' | 'challenger') =>
            soleFunderWon
              ? `the ${side} alone funded the appeal`
              : `jurors ruled for the ${side}`
          let message: string
          let tone: StatusTone
          switch (event.disputeOutcome) {
            case 'None': {
              message = `${itemName} withdrawn: jurors refused to rule`
              tone = 'off'
              break
            }
            case 'Accept': {
              message = `${itemName} kept: ${why('submitter')}`
              tone = 'registered'
              break
            }
            case 'Reject': {
              message = `${itemName} removed: ${why('challenger')}`
              tone = 'off'
              break
            }
            default:
              throw new Error('Unhandled ruling')
          }
          const caseText = event.disputeID ? `Case ${event.disputeID}` : ''
          const note = soleFunderWon ? hadRuledLine(event.lastRuling) : ''

          return (
            <TimelineEvent
              key={i}
              index={index}
              tone={tone}
              title={message}
              timestamp={timestamp}
              href={href}
              detail={
                caseText && note
                  ? `${caseText} · ${note}`
                  : caseText || (note ? capitalizeFirstLetter(note) : undefined)
              }
            />
          )
        }

        if (event.name === 'Challenge')
          return (
            <TimelineEvent
              key={i}
              index={index}
              current={current}
              tone="contested"
              title={`${itemName} challenged`}
              timestamp={timestamp}
              href={href}
              detail={
                event.challenger ? (
                  <span>
                    by <AddressLink address={event.challenger} />
                    {event.disputeID && Number(event.disputeID) !== 0
                      ? ` · case ${event.disputeID}`
                      : ''}
                  </span>
                ) : undefined
              }
            />
          )

        if (event.name === 'Withdrawal')
          return (
            <TimelineEvent
              key={i}
              index={index}
              current={current}
              tone="neutral"
              title="Withdrawal started"
              timestamp={timestamp}
              href={href}
              detail="by the submitter"
            />
          )

        if (event.name === 'WithdrawalCompleted')
          return (
            <TimelineEvent
              key={i}
              index={index}
              tone="off"
              title={`${itemName} withdrawn`}
              timestamp={timestamp}
              href={href}
              detail="Stake and arbitration deposit returned"
            />
          )

        throw new Error('Unhandled event')
      })}
    </EventList>
  )
}

/* ---------- Groups ---------- */

const HistoryHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px 16px;
  margin-top: 16px;
`

const HistoryTitle = styled.h2`
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: 28px;
  line-height: 32px;
  font-weight: 500;
  letter-spacing: -0.03em;
`

const Panel = styled(Surface)`
  overflow: hidden;
`

const Group = styled.section`
  & + & {
    border-top: 1px solid var(--glass-border);
  }
`

const GroupToggle = styled.button`
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 60px;
  padding: 12px 24px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--motion);

  &:hover {
    background: var(--color-raised);
  }

  @media (max-width: 720px) {
    padding: 12px 16px;
  }
`

const GroupMeta = styled.span`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  min-width: 0;
`

const Ordinal = styled.span`
  color: var(--color-text);
  font-size: var(--fs-body-lg);
  line-height: var(--lh-body-lg);
  font-weight: 500;
`

const GroupState = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

const Dates = styled.span`
  color: var(--color-faint);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-variant-numeric: tabular-nums;
`

const Chevron = styled.span<{ $open: boolean }>`
  display: inline-flex;
  flex: 0 0 auto;
  color: var(--color-muted);
  transform: rotate(${({ $open }) => ($open ? 180 : 0)}deg);
  transition: transform var(--motion);
`

const GroupBody = styled.div`
  padding: 8px 24px 28px;

  @media (max-width: 720px) {
    padding: 8px 16px 22px;
  }
`

/** How a submission stands: on the list, disputed, or how it ended. */
const submissionState = (
  submission: TimelineSubmission,
  item: PermanentTimelineItem,
): { label: string; tone: StatusTone } => {
  if (!submission.finishedAt)
    return item.status === CONTRACT_STATUS.DISPUTED
      ? { label: 'Disputed', tone: 'contested' }
      : { label: 'On the list', tone: 'registered' }
  const challenges = item.challenges ?? []
  const resolutionTxs = new Set(
    challenges.map((c) => c.resolutionTx).filter((tx) => !!tx),
  )
  const resolutionTimes = new Set(
    challenges.map((c) => c.resolutionTime).filter((time) => !!time),
  )
  const withdrawn = submission.finishedTx
    ? !resolutionTxs.has(submission.finishedTx)
    : !!submission.withdrawingTx && !resolutionTimes.has(submission.finishedAt)
  return withdrawn
    ? { label: 'Withdrawn', tone: 'off' }
    : { label: 'Removed', tone: 'off' }
}

export const EVIDENCE_COMPOSER_ID = 'evidence-composer'

/** Scrolls to the evidence composer and focuses its first field. */
export const scrollToEvidenceComposer = () => openEvidenceComposer()

interface RequestTimelinesProps {
  item?: PermanentTimelineItem
  metaEvidence?: MetaEvidence
}

const RequestTimelines = ({ item, metaEvidence }: RequestTimelinesProps) => {
  const now = useNow(60_000)
  const [openPanels, setOpenPanels] = useState<Record<number, boolean>>({
    0: true,
  })
  const { metadata } = metaEvidence || {}
  const itemName = metadata?.itemName || 'item'

  if (!item)
    return (
      <Surface
        $padding="standard"
        id="request-timelines"
        aria-busy="true"
        aria-label="Loading history"
      >
        <SkeletonBlock $height="120px" />
      </Surface>
    )

  const submissions = item.submissions ?? []
  const active = item.status !== CONTRACT_STATUS.ABSENT
  // Something runs on the open submission: a dispute, a withdrawal, or the
  // submission period (the latest event then pulses).
  const registry = item.registry
  const includedAt = toSeconds(item.includedAt)
  const period = toSeconds(
    item.status === CONTRACT_STATUS.REINCLUDED
      ? registry?.reinclusionPeriod
      : registry?.submissionPeriod,
  )
  const live =
    active &&
    (item.status === CONTRACT_STATUS.DISPUTED ||
      toSeconds(item.withdrawingTimestamp) > 0 ||
      (period > 0 && now < includedAt + period))

  return (
    <>
      <div
        id="request-timelines"
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <HistoryHead>
          <div>
            <HistoryTitle>History</HistoryTitle>
            <Small $faint>
              Every submission of this {itemName}, newest first. Times in UTC.
            </Small>
          </div>
        </HistoryHead>
        <Panel $padding="none">
          {submissions.map((submission, i) => {
            const state = submissionState(submission, item)
            const open = !!openPanels[i]
            const ordinal = submissions.length - i
            const panelId = `submission-${ordinal}-timeline`
            const start = toSeconds(submission.createdAt)
            const end = toSeconds(submission.finishedAt)
            return (
              <Group
                key={submission.id ?? i}
                aria-label={`${toOrdinal(ordinal)} submission`}
              >
                <GroupToggle
                  type="button"
                  aria-expanded={open}
                  aria-controls={open ? panelId : undefined}
                  onClick={() =>
                    setOpenPanels((current) => ({
                      ...current,
                      [i]: !current[i],
                    }))
                  }
                >
                  <GroupMeta>
                    <Ordinal>{toOrdinal(ordinal)} submission</Ordinal>
                    <GroupState>
                      <StatusDot $tone={state.tone} aria-hidden />
                      {state.label}
                    </GroupState>
                    {start > 0 && (
                      <Dates>
                        {formatDate(start)}
                        {end ? ` – ${formatDate(end)}` : ' – now'}
                      </Dates>
                    )}
                  </GroupMeta>
                  <Chevron $open={open} aria-hidden>
                    <CurateIcon name="chevron-down" size={16} />
                  </Chevron>
                </GroupToggle>
                {open && (
                  <GroupBody id={panelId}>
                    {/* Spread `submission` to convert it from an array row to an object. */}
                    <Timeline
                      item={item}
                      submission={{ ...submission }}
                      metaEvidence={metaEvidence}
                      live={live && i === 0}
                    />
                  </GroupBody>
                )}
              </Group>
            )
          })}
        </Panel>
      </div>
      {/* The contract takes evidence on any item that is not Absent. */}
      {active ? (
        <PermanentEvidenceModal
          item={item}
          inline
          composerId={EVIDENCE_COMPOSER_ID}
        />
      ) : (
        <EvidenceClosed
          reason={`Opens if this ${itemName} is submitted again.`}
        />
      )}
    </>
  )
}

export default RequestTimelines
