import React, { useMemo, useState, useEffect } from 'react'
import styled from 'styled-components'
import useUrlChainId from 'hooks/use-url-chain-id'
import {
  CONTRACT_STATUS,
  REQUEST_TYPE_LABEL,
  SUBGRAPH_RULING,
  hasPendingRequest,
} from 'utils/item-status'
import { capitalizeFirstLetter } from 'utils/string'
import { getTxPage } from 'utils/network-utils'
import { parseIpfs } from 'utils/ipfs-parse'
import toOrdinal from 'utils/ordinal'
import EvidenceFileLink from 'components/evidence-file-link'
import ClassicEvidenceModal from 'pages/item-details/modals/evidence'
import LightEvidenceModal from 'pages/light-item-details/modals/evidence'
import { klerosAddresses } from 'config/tcr-addresses'
import { CurateIcon } from 'components/curate/icons'
import {
  Chip,
  SkeletonBlock,
  Small,
  StatusDot,
  Surface,
  type StatusTone,
} from 'components/curate/primitives'
import {
  Timeline,
  TimelineEvent,
  TimelineQuote,
} from 'components/curate/item-light-timeline'
import { AddressLink } from 'components/curate/item-light-fields'
import { toSeconds } from 'components/curate/item-light-format'
import { linkify } from 'components/curate/item-light-linkify'
import {
  EvidenceComposerCollapse,
  openEvidenceComposer,
} from 'components/inline-evidence-composer'

/*
 * An entry's history: one panel, one group per request (newest first), each
 * a glowing vertical timeline of its submission, evidence, rulings, appeals
 * and resolution with absolute UTC dates and the court case linked; then the
 * inline evidence composer, folded to one row, while a request is open.
 * Shared by the Light and Classic item pages. The case link sits on the
 * event that opened the dispute (the challenge), never on the submission.
 */

/** Round fields the subgraph returns beyond the shared SubgraphRound. */
interface TimelineRound extends SubgraphRound {
  txHashAppealPossible?: string | null
  appealedAt?: string | null
  txHashAppealDecision?: string | null
}

interface TimelineEvidenceItem {
  party: string
  uri: string
  number?: string
  timestamp: string
  txHash: string
  name?: string | null
  title: string | null
  description: string | null
  fileURI: string | null
  fileTypeExtension: string | null
}

/** Request fields the subgraph returns beyond the shared SubgraphRequest. */
export interface TimelineRequest extends SubgraphRequest {
  requestType: string
  creationTx: string
  resolutionTime?: string | null
  resolutionTx?: string | null
  disputeOutcome?: string | null
  evidenceGroup: { id?: string; evidences: TimelineEvidenceItem[] }
  rounds: TimelineRound[]
  disputeID?: string
  arbitrator?: string
  /** Light only: when the request was challenged, and the transaction. */
  challengeTime?: string | null
  txHashChallenge?: string | null
}

interface AppealPossibleLog {
  name: 'AppealPossible'
  timestamp: string
  transactionHash: string
  appealableRuling: string
}

interface AppealDecisionLog {
  name: 'AppealDecision'
  timestamp: string
  transactionHash: string
}

interface EvidenceLog {
  name: 'Evidence'
  timestamp: string
  transactionHash: string
  title: string | null
  description: string | null
  URI: string
  fileURI: string | null
  fileTypeExtension: string | null
  party: string
}

interface ChallengeLog {
  name: 'Challenge'
  timestamp: string
  transactionHash: string
  /** The justification filed in the same transaction, shown as its quote. */
  evidence?: EvidenceLog
}

interface ResolutionLog {
  name: 'Resolution'
  timestamp?: string | null
  transactionHash?: string | null
  disputeOutcome?: string | null
}

type TimelineLog =
  | ChallengeLog
  | AppealPossibleLog
  | AppealDecisionLog
  | EvidenceLog
  | ResolutionLog

interface EvidenceFile {
  title?: string | null
  description?: string | null
  fileURI?: string | null
  fileTypeExtension?: string | null
}

/** The case on the Kleros court site, when the arbitrator is Kleros. */
const useCaseLink = (request?: TimelineRequest) => {
  const networkId = useUrlChainId()
  if (!request) return undefined
  const { arbitrator, uiURL } =
    (networkId && klerosAddresses[networkId as keyof typeof klerosAddresses]) ||
    {}
  const disputed = !!request.disputed && Number(request.disputeID ?? 0) !== 0
  if (!disputed) return undefined
  const id = String(request.disputeID)
  const href =
    uiURL && arbitrator?.toLowerCase() === request.arbitrator?.toLowerCase()
      ? uiURL.replace(':disputeID', id)
      : undefined
  return { id, href }
}

const CaseLink = ({ id, href }: { id: string; href?: string }) =>
  href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      Case {id}
      <CurateIcon name="external" size={12} />
    </a>
  ) : (
    <span>Case {id}</span>
  )

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

/**
 * Long evidence opens at six lines; the rest is one click away. URLs are
 * links; tabbing onto one hidden by the clamp opens the text first.
 */
const EvidenceText = ({ text }: { text: string }) => {
  const long = text.length > 420 || text.split('\n').length > 6
  const [expanded, setExpanded] = useState(false)
  const content = useMemo(() => linkify(text), [text])
  return (
    <>
      <Clamp
        $clamped={long && !expanded}
        onFocus={() => {
          if (long) setExpanded(true)
        }}
      >
        {content}
      </Clamp>
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

/** A justification's own title, when the challenger gave one. */
const QuoteTitle = styled.span`
  color: var(--color-text);
  font-size: var(--fs-body);
  line-height: 22px;
  font-weight: 500;
`

const rulingSentence = (ruling: string, isRegistration: boolean): string => {
  if (ruling === SUBGRAPH_RULING.NONE) return 'Jurors refused to rule'
  if (ruling === SUBGRAPH_RULING.ACCEPT)
    return `Jurors ruled for the ${isRegistration ? 'submitter' : 'requester'}`
  if (ruling === SUBGRAPH_RULING.REJECT)
    return 'Jurors ruled for the challenger'
  return 'Jurors gave an unknown ruling'
}

interface TimelineProps {
  request: TimelineRequest
  item: SubgraphItem
  metaEvidence?: MetaEvidence
  /** The page already links this request's case (the hero's chip). */
  hideCase?: boolean
}

const RequestTimeline = ({
  request,
  item,
  metaEvidence,
  hideCase = false,
}: TimelineProps) => {
  const networkId = useUrlChainId()
  const [evidenceMap, setEvidenceMap] = useState<Record<string, EvidenceFile>>()
  const disputeCase = useCaseLink(request)
  const caseLink = hideCase ? undefined : disputeCase

  const logs = useMemo(() => {
    if (!request) return null

    const appealPossibles = request.rounds
      .map((r) => ({
        name: 'AppealPossible',
        timestamp: r.appealPeriodStart,
        transactionHash: r.txHashAppealPossible,
        appealableRuling: r.ruling,
      }))
      .filter((appeal): appeal is AppealPossibleLog => !!appeal.transactionHash)

    const appealDecisions = request.rounds
      .map((r) => ({
        name: 'AppealDecision',
        timestamp: r.appealedAt,
        transactionHash: r.txHashAppealDecision,
      }))
      .filter((appeal): appeal is AppealDecisionLog => !!appeal.transactionHash)

    const allEvidences = request.evidenceGroup.evidences.map(
      (e): EvidenceLog => ({
        name: 'Evidence',
        timestamp: e.timestamp,
        transactionHash: e.txHash,
        title: e.title,
        description: e.description,
        URI: e.uri,
        fileURI: e.fileURI,
        fileTypeExtension: e.fileTypeExtension,
        party: e.party,
      }),
    )

    // The challenge itself (Light only). Its justification is the evidence
    // filed in the same transaction: matched on the hash, never the time,
    // so a separate evidence mined in the same block stays its own row.
    const challengeTx = request.txHashChallenge?.toLowerCase()
    const justification =
      challengeTx && request.challengeTime
        ? allEvidences.find(
            (e) => e.transactionHash?.toLowerCase() === challengeTx,
          )
        : undefined
    const evidences = justification
      ? allEvidences.filter((e) => e !== justification)
      : allEvidences
    const challenge: ChallengeLog | undefined =
      request.challengeTime && request.txHashChallenge
        ? {
            name: 'Challenge',
            timestamp: request.challengeTime,
            transactionHash: request.txHashChallenge,
            evidence: justification,
          }
        : undefined

    const resolution: ResolutionLog = {
      name: 'Resolution',
      timestamp: request.resolutionTime,
      transactionHash: request.resolutionTx,
      disputeOutcome: !request.disputed
        ? SUBGRAPH_RULING.ACCEPT
        : request.disputeOutcome,
    }

    const logArray: TimelineLog[] = [
      ...appealPossibles,
      ...appealDecisions,
      ...evidences,
    ]

    if (challenge) logArray.push(challenge)

    if (resolution.transactionHash) logArray.push(resolution)

    return logArray.sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
  }, [request])

  const requestType = request.requestType
  const isRegistration = requestType === CONTRACT_STATUS.REGISTRATION_REQUESTED

  // The indexer can miss the evidence fields. Load unindexed files manually.
  useEffect(() => {
    if (!logs || evidenceMap) return
    const evidenceManualFetch = async () => {
      const unindexedEvidenceURIs = logs
        .flatMap((e): EvidenceLog[] =>
          e.name === 'Evidence'
            ? [e]
            : e.name === 'Challenge' && e.evidence
              ? [e.evidence]
              : [],
        )
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
    evidenceManualFetch().catch((err) => {
      console.error('Could not load unindexed evidence', err)
    })
  }, [logs, evidenceMap, setEvidenceMap])

  if (!item || !request || !logs) return <SkeletonBlock $height="80px" />

  const metadata = metaEvidence?.metadata
  const itemName = metadata?.itemName
    ? capitalizeFirstLetter(metadata.itemName)
    : 'Item'
  const txPage = (txHash?: string | null) =>
    txHash ? getTxPage({ networkId: networkId ?? 0, txHash }) : undefined
  const open = !request.resolved
  const requesterRole = isRegistration ? 'submitter' : 'requester'
  const roleOf = (party?: string) => {
    const address = party?.toLowerCase()
    if (!address) return undefined
    if (address === request.requester?.toLowerCase()) return requesterRole
    if (address === request.challenger?.toLowerCase()) return 'challenger'
    return undefined
  }
  // Where the case link goes: the challenge event when the indexer has it;
  // otherwise (Classic) the challenger's first evidence, which is filed with
  // the challenge; the submission row only when neither exists.
  const hasChallengeEvent = logs.some((event) => event.name === 'Challenge')
  const caseEvidenceIndex = hasChallengeEvent
    ? -1
    : logs.findIndex(
        (event) =>
          event.name === 'Evidence' && roleOf(event.party) === 'challenger',
      )
  const caseOnSubmission = !hasChallengeEvent && caseEvidenceIndex < 0
  const evidenceQuote = (evidence: EvidenceLog, heading?: string | null) => {
    const { description, fileURI } = evidenceMap?.[evidence.URI]
      ? evidenceMap[evidence.URI]
      : evidence
    return heading || description || fileURI ? (
      <TimelineQuote>
        {heading && <QuoteTitle>{heading}</QuoteTitle>}
        {description && <EvidenceText text={description} />}
        {fileURI && <EvidenceFileLink fileURI={fileURI} />}
      </TimelineQuote>
    ) : null
  }

  return (
    <Timeline>
      <TimelineEvent
        tone="window"
        title={isRegistration ? `${itemName} submitted` : 'Removal requested'}
        timestamp={toSeconds(request.submissionTime)}
        href={txPage(request.creationTx)}
        current={open && logs.length === 0}
        detail={
          request.requester ? (
            <>
              <span>
                by <AddressLink address={request.requester} />
              </span>
              {caseLink && caseOnSubmission && (
                <CaseLink id={caseLink.id} href={caseLink.href} />
              )}
            </>
          ) : undefined
        }
      />
      {logs.map((event, i) => {
        const timestamp = toSeconds(event.timestamp)
        const href = txPage(event.transactionHash)
        const current = open && i === logs.length - 1
        const index = i + 1

        if (event.name === 'Challenge') {
          const justification = event.evidence
          const customTitle =
            justification &&
            (evidenceMap?.[justification.URI]?.title ?? justification.title)
          return (
            <TimelineEvent
              key={i}
              index={index}
              current={current}
              tone="contested"
              title="Challenged"
              timestamp={timestamp}
              href={href}
              detail={
                <>
                  {request.challenger && (
                    <span>
                      by <AddressLink address={request.challenger} />
                    </span>
                  )}
                  {caseLink && (
                    <CaseLink id={caseLink.id} href={caseLink.href} />
                  )}
                </>
              }
            >
              {justification &&
                evidenceQuote(
                  justification,
                  customTitle !== 'Challenge Justification'
                    ? customTitle
                    : undefined,
                )}
            </TimelineEvent>
          )
        }

        if (event.name === 'Evidence') {
          const { title } = evidenceMap?.[event.URI]
            ? evidenceMap[event.URI]
            : event
          return (
            <TimelineEvent
              key={i}
              index={index}
              current={current}
              tone={
                roleOf(event.party) === 'challenger'
                  ? 'contested'
                  : roleOf(event.party)
                    ? 'window'
                    : 'neutral'
              }
              title={title || 'Evidence'}
              timestamp={timestamp}
              href={href}
              detail={
                <>
                  <span>
                    by <AddressLink address={event.party} />
                    {roleOf(event.party) ? ` · ${roleOf(event.party)}` : ''}
                  </span>
                  {caseLink && i === caseEvidenceIndex && (
                    <CaseLink id={caseLink.id} href={caseLink.href} />
                  )}
                </>
              }
            >
              {evidenceQuote(event)}
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
              title={
                typeof event.appealableRuling === 'undefined'
                  ? 'Ruling'
                  : rulingSentence(event.appealableRuling, isRegistration)
              }
              timestamp={timestamp}
              href={href}
              detail={
                <>
                  <span>Appeal period opened</span>
                  {caseLink && (
                    <CaseLink id={caseLink.id} href={caseLink.href} />
                  )}
                </>
              }
            />
          )

        if (event.name === 'AppealDecision')
          return (
            <TimelineEvent
              key={i}
              index={index}
              current={current}
              tone="contested"
              title="Ruling appealed"
              timestamp={timestamp}
              href={href}
              detail="A new round of jurors decides"
            />
          )

        if (event.name === 'Resolution') {
          let message: string
          let tone: StatusTone
          switch (event.disputeOutcome) {
            case 'None':
            case 'Reject': {
              message = isRegistration
                ? 'Submission rejected'
                : 'Removal refused'
              tone = isRegistration ? 'off' : 'registered'
              break
            }
            case 'Accept': {
              message = isRegistration
                ? 'Submission accepted'
                : `${itemName} removed`
              tone = isRegistration ? 'registered' : 'off'
              break
            }
            default:
              throw new Error('Unhandled ruling')
          }
          const differentAppealableRuling =
            request.disputed &&
            request.rounds[0].ruling !== request.disputeOutcome

          return (
            <TimelineEvent
              key={i}
              index={index}
              tone={tone}
              title={message}
              timestamp={timestamp}
              href={href}
              detail={
                differentAppealableRuling
                  ? 'The winner of the last round did not fund the appeal.'
                  : undefined
              }
            />
          )
        }

        return null
      })}
    </Timeline>
  )
}

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

const requestState = (
  request: TimelineRequest,
): { label: string; tone: StatusTone } =>
  request.resolved
    ? { label: 'Resolved', tone: 'neutral' }
    : request.disputed
      ? { label: 'Disputed', tone: 'contested' }
      : { label: 'Open', tone: 'window' }

const RequestGroup = ({
  request,
  ordinal,
  open,
  onToggle,
  item,
  metaEvidence,
  hideCase,
}: {
  request: TimelineRequest
  ordinal: number
  open: boolean
  onToggle: () => void
  item: SubgraphItem
  metaEvidence?: MetaEvidence
  hideCase?: boolean
}) => {
  const state = requestState(request)
  const panelId = `request-${ordinal}-timeline`
  return (
    <Group aria-label={`${toOrdinal(ordinal)} request`}>
      <GroupToggle
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <GroupMeta>
          <Ordinal>{toOrdinal(ordinal)} request</Ordinal>
          <Chip>{REQUEST_TYPE_LABEL[request.requestType] ?? 'Request'}</Chip>
          <GroupState>
            <StatusDot $tone={state.tone} aria-hidden />
            {state.label}
          </GroupState>
        </GroupMeta>
        <Chevron $open={open} aria-hidden>
          <CurateIcon name="chevron-down" size={16} />
        </Chevron>
      </GroupToggle>
      {open && (
        <GroupBody id={panelId}>
          {/* The request is spread to convert it from an array to an object. */}
          <RequestTimeline
            item={item}
            request={{ ...request }}
            metaEvidence={metaEvidence}
            hideCase={hideCase}
          />
        </GroupBody>
      )}
    </Group>
  )
}

export const EVIDENCE_COMPOSER_ID = 'evidence-composer'

/**
 * Opens the evidence composer under the history, then scrolls to it and
 * focuses its first field (the action card, the phone bar, deep links).
 */
export const scrollToEvidenceComposer = () => openEvidenceComposer()

interface RequestTimelinesProps {
  item: SubgraphItem
  requests?: TimelineRequest[]
  kind: 'classic' | 'light'
  metaEvidence?: MetaEvidence
  /**
   * The page already links the latest request's court case (the hero's
   * chip), so its rows leave the link out. Past requests keep theirs.
   */
  caseInHero?: boolean
}

const RequestTimelines = ({
  item,
  requests,
  kind,
  metaEvidence,
  caseInHero = false,
}: RequestTimelinesProps) => {
  const EvidenceComposer =
    kind === 'classic' ? ClassicEvidenceModal : LightEvidenceModal
  const [openPanels, setOpenPanels] = useState<Record<number, boolean>>({
    0: true,
  })

  const { metadata } = metaEvidence || {}
  const itemName = metadata?.itemName || 'entry'

  if (!item)
    return (
      <Surface id="request-timelines" $padding="standard" aria-busy="true">
        <SkeletonBlock $height="120px" />
      </Surface>
    )

  const pending = hasPendingRequest(item.status)

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
              Every request on this {itemName}, newest first. Times in UTC.
            </Small>
          </div>
        </HistoryHead>
        <Panel $padding="none">
          {requests?.map((request, i) => (
            <RequestGroup
              key={i}
              request={request}
              ordinal={requests.length - i}
              open={!!openPanels[i]}
              onToggle={() =>
                setOpenPanels((state) => ({ ...state, [i]: !state[i] }))
              }
              item={item}
              metaEvidence={metaEvidence}
              hideCase={caseInHero && i === 0}
            />
          ))}
        </Panel>
      </div>
      {pending && (
        <EvidenceComposerCollapse.Provider value>
          <EvidenceComposer
            item={item}
            inline
            composerId={EVIDENCE_COMPOSER_ID}
          />
        </EvidenceComposerCollapse.Provider>
      )}
    </>
  )
}

export default RequestTimelines
