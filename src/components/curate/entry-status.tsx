import React from 'react'
import styled, { keyframes } from 'styled-components'
import type { BigNumber } from 'ethers'
import { StatusDot, type StatusTone } from './primitives'
import {
  formatAbsolute,
  formatDuration,
  formatDurationLong,
  windowProgress,
} from 'utils/time'
import {
  STATUS_CODE as LIGHT_STATUS,
  SUBGRAPH_RULING,
  itemToStatusCode as lightStatusCode,
} from 'utils/item-status'
import {
  STATUS_CODE as STAKE_STATUS,
  itemToStatusCode as stakeStatusCode,
} from 'utils/permanent-item-status'

/*
 * Entry status: a dot with a halo in the status role, a plain label, and the
 * time left wherever the entry appears. When the status runs on a window
 * (challenge window, appeal period, Stake submission period) a track under
 * the label draws that window from the moment it opened (left end) to the
 * moment it closes (right end): the glowing dot is now, the bright stretch
 * after it is the time left, which the text counts down, and a tick marks the
 * deadline. In an appeal with a decisive ruling the loser's half ends first,
 * so its tick sits halfway along the period. Deadline and start come from the
 * same request data the status is derived from.
 */

export interface EntryStatusView {
  code?: number
  tone: StatusTone
  label: string
  /** Unix seconds; rendered as "2d 4h to challenge" and ticking. */
  deadline?: number
  /** Unix seconds the window behind `deadline` opened; drives the track. */
  windowStart?: number
  /**
   * Unix seconds the whole window closes, when that is after `deadline` (an
   * appeal period whose loser's half ends first). Defaults to `deadline`.
   */
  windowEnd?: number
  /**
   * Names the deadline in the hover text and the track's label, as a full
   * sentence ("The loser can fund until"); defaults to "Closes".
   */
  deadlineName?: string
  /**
   * Follows the countdown, short enough for the status column: "to
   * challenge", "loser funds", "left".
   */
  deadlineVerb?: string
  /** Shown when there is no deadline, or once it has passed. */
  detail?: string
  /** Shown once the deadline has passed instead of `detail`. */
  passedDetail?: string
}

const toNum = (value: unknown): number => {
  if (value === undefined || value === null) return 0
  if (typeof value === 'object' && 'toNumber' in (value as object))
    return (value as BigNumber).toNumber()
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

interface AppealRound {
  appealPeriodStart?: string
  appealPeriodEnd?: string
  ruling?: string
  rulingTime?: string
}

/**
 * An open appeal. With a decisive ruling the loser funds in the first half
 * and the winner until the end; with no ruling (the jurors refused to
 * arbitrate) there is no loser and either side funds until the end.
 */
const appealOpen = (
  code: number,
  ts: number,
  round: AppealRound | undefined,
): EntryStatusView => {
  const start = toNum(round?.appealPeriodStart)
  const end = toNum(round?.appealPeriodEnd)
  const half = start + (end - start) / 2
  if (round?.ruling === SUBGRAPH_RULING.NONE)
    return {
      code,
      tone: 'contested',
      label: 'Appeal open',
      deadline: end,
      windowStart: start || undefined,
      deadlineName: 'No ruling: either side can fund until',
      deadlineVerb: 'either side funds',
      passedDetail: 'appeal closing',
    }
  if (ts < half)
    return {
      code,
      tone: 'contested',
      label: 'Appeal open',
      deadline: half,
      windowStart: start || undefined,
      windowEnd: end,
      deadlineName: 'The loser can fund until',
      deadlineVerb: 'loser funds',
      passedDetail: 'loser’s half over',
    }
  return {
    code,
    tone: 'contested',
    label: 'Appeal open',
    deadline: end,
    windowStart: start || undefined,
    deadlineVerb: 'to fund',
    passedDetail: 'appeal closing',
  }
}

/** The winner funds after the loser did, until the period ends. */
const winnerFunding = (
  code: number,
  round: AppealRound | undefined,
): EntryStatusView => ({
  code,
  tone: 'contested',
  label: 'Appeal · winner funding',
  deadline: toNum(round?.appealPeriodEnd),
  windowStart: toNum(round?.appealPeriodStart) || undefined,
  deadlineVerb: 'left',
  passedDetail: 'appeal closing',
})

/** Light and Classic Curate (utils/item-status.ts). */
export const lightEntryStatus = (
  item: SubgraphItem | undefined,
  timestamp: BigNumber | null | undefined,
  challengePeriodDuration: BigNumber | null | undefined,
): EntryStatusView | undefined => {
  if (!item || !timestamp || !challengePeriodDuration) return undefined
  const code = lightStatusCode(item, timestamp, challengePeriodDuration)
  if (code === undefined) return undefined
  const request = item.requests?.[0] as
    | { submissionTime?: string; rounds?: AppealRound[] }
    | undefined
  const round = request?.rounds?.[0]
  const submissionTime = toNum(request?.submissionTime)
  const windowEnd = submissionTime + challengePeriodDuration.toNumber()

  switch (code) {
    case LIGHT_STATUS.REGISTERED:
      return { code, tone: 'registered', label: 'Registered' }
    case LIGHT_STATUS.SUBMITTED:
      return {
        code,
        tone: 'window',
        label: 'Submitted',
        deadline: windowEnd,
        windowStart: submissionTime || undefined,
        deadlineVerb: 'to challenge',
        passedDetail: 'window closed',
      }
    case LIGHT_STATUS.REMOVAL_REQUESTED:
      return {
        code,
        tone: 'window',
        label: 'Removal requested',
        deadline: windowEnd,
        windowStart: submissionTime || undefined,
        deadlineVerb: 'to challenge',
        passedDetail: 'window closed',
      }
    case LIGHT_STATUS.PENDING_SUBMISSION:
      return {
        code,
        tone: 'neutral',
        label: 'Ready to execute',
        detail: 'unchallenged submission',
      }
    case LIGHT_STATUS.PENDING_REMOVAL:
      return {
        code,
        tone: 'neutral',
        label: 'Ready to execute',
        detail: 'unchallenged removal',
      }
    case LIGHT_STATUS.CHALLENGED:
      return {
        code,
        tone: 'contested',
        label: 'Challenged',
        detail: 'jurors deciding',
      }
    case LIGHT_STATUS.CROWDFUNDING:
      return appealOpen(code, timestamp.toNumber(), round)
    case LIGHT_STATUS.CROWDFUNDING_WINNER:
      return winnerFunding(code, round)
    case LIGHT_STATUS.WAITING_ARBITRATOR:
      return {
        code,
        tone: 'contested',
        label: 'Awaiting ruling',
        detail: 'appeal period over',
      }
    case LIGHT_STATUS.WAITING_ENFORCEMENT:
      return {
        code,
        tone: 'contested',
        label: 'Ruling final',
        detail: 'awaiting enforcement',
      }
    case LIGHT_STATUS.REJECTED:
      return { code, tone: 'off', label: 'Rejected' }
    case LIGHT_STATUS.REMOVED:
      return { code, tone: 'off', label: 'Removed' }
    default:
      return undefined
  }
}

/** Stake Curate (utils/permanent-item-status.ts). */
export const stakeEntryStatus = (
  item: SubgraphItem | undefined,
  timestamp: BigNumber | null | undefined,
  registry: SubgraphRegistry | undefined,
): EntryStatusView | undefined => {
  if (!item || !timestamp || !registry) return undefined
  const code = stakeStatusCode(item, timestamp, registry)
  if (code === undefined) return undefined
  const ts = timestamp.toNumber()
  const includedAt = toNum(item.includedAt)
  const period =
    item.status === 'Reincluded'
      ? toNum(registry.reinclusionPeriod)
      : toNum(registry.submissionPeriod)
  const withdrawingAt = toNum(item.withdrawingTimestamp)
  const withdrawing =
    withdrawingAt > 0 && code !== STAKE_STATUS.PENDING_WITHDRAWAL
      ? ` · withdrawing`
      : ''
  const round = (
    item.challenges as { rounds: AppealRound[] }[] | undefined
  )?.[0]?.rounds?.[0]
  const appealEnd = toNum(round?.appealPeriodEnd)
  const ruled = !!round?.rulingTime && round.rulingTime !== '0'
  const appealRunning = ruled && ts < appealEnd
  // permanent-item-status splits the period at its half even when the jurors
  // refused to rule; with no ruling either side funds until the end.
  const noRulingAppeal =
    appealRunning &&
    round?.ruling === SUBGRAPH_RULING.NONE &&
    (code === STAKE_STATUS.CROWDFUNDING ||
      code === STAKE_STATUS.CROWDFUNDING_WINNER ||
      code === STAKE_STATUS.WAITING_ARBITRATOR)
  if (noRulingAppeal) return appealOpen(STAKE_STATUS.CROWDFUNDING, ts, round)

  switch (code) {
    case STAKE_STATUS.ACCEPTED:
      return { code, tone: 'registered', label: `Accepted${withdrawing}` }
    case STAKE_STATUS.PENDING:
      return {
        code,
        tone: 'window',
        label: `Pending${withdrawing}`,
        deadline: includedAt + period,
        windowStart: includedAt || undefined,
        deadlineVerb: 'until accepted',
        passedDetail: 'accepted',
      }
    case STAKE_STATUS.DISPUTED:
      return {
        code,
        tone: 'contested',
        label: 'Disputed',
        detail: 'jurors deciding',
      }
    case STAKE_STATUS.CROWDFUNDING:
      return appealOpen(code, ts, round)
    case STAKE_STATUS.CROWDFUNDING_WINNER:
      return winnerFunding(code, round)
    case STAKE_STATUS.WAITING_ARBITRATOR:
      return {
        code,
        tone: 'contested',
        label: 'Awaiting ruling',
        // Before the period ends this means the loser did not fund in time.
        detail: appealRunning ? 'loser did not fund' : 'appeal period over',
      }
    case STAKE_STATUS.PENDING_WITHDRAWAL:
      return {
        code,
        tone: 'neutral',
        label: 'Withdrawal ready',
        detail: 'can be executed',
      }
    case STAKE_STATUS.REJECTED:
      return { code, tone: 'off', label: 'Rejected' }
    case STAKE_STATUS.REMOVED:
      return { code, tone: 'off', label: 'Removed' }
    case STAKE_STATUS.WITHDRAWN:
      return { code, tone: 'off', label: 'Withdrawn' }
    default:
      return undefined
  }
}

export const statusDetail = (
  status: EntryStatusView,
  now: number,
): string | undefined => {
  if (status.deadline) {
    const left = status.deadline - now
    if (left > 0)
      return `${formatDuration(left)} ${status.deadlineVerb ?? 'left'}`
    return status.passedDetail ?? status.detail
  }
  return status.detail
}

/** Share of the status window elapsed at `now`, when the window is known. */
export const statusProgress = (
  status: EntryStatusView,
  now: number,
): number | undefined => {
  const end = Math.max(status.windowEnd ?? 0, status.deadline ?? 0)
  return status.deadline && status.windowStart && end > status.windowStart
    ? windowProgress(status.windowStart, end, now)
    : undefined
}

const Wrap = styled.span`
  display: inline-flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
  vertical-align: middle;
`

const Line = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  white-space: nowrap;
`

const Name = styled.span`
  color: var(--color-text);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 500;
`

const Detail = styled.span`
  overflow: hidden;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
`

const unfurl = keyframes`
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
`

const pop = keyframes`
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
`

/*
 * The window as a track: used time faint, time left bright up to the
 * deadline tick, anything after the deadline (the winner's half of an
 * appeal) bare. The dot is now; the closing tick ends the track.
 */
const Track = styled.span<{ $tone: StatusTone }>`
  --tone: var(--status-${({ $tone }) => $tone});
  position: relative;
  display: block;
  min-width: 96px;
  width: calc(100% - 16px);
  height: 8px;
  margin-left: 16px;

  /* The whole window. */
  &::before {
    content: '';
    position: absolute;
    top: 3px;
    right: 0;
    left: 0;
    height: 2px;
    border-radius: var(--radius-pill);
    background: var(--glass-border);
  }

  i {
    position: absolute;
    top: 3px;
    height: 2px;
    border-radius: var(--radius-pill);
    transition:
      left 600ms var(--ease-out),
      width 600ms var(--ease-out);
  }

  i[data-part='used'] {
    left: 0;
    background: color-mix(in srgb, var(--tone) 32%, transparent);
  }

  i[data-part='left'] {
    background: var(--tone);
    box-shadow: 0 0 8px color-mix(in srgb, var(--tone) 70%, transparent);
    transform-origin: left center;
    animation: ${unfurl} 900ms var(--ease-out) 120ms both;
  }

  b {
    position: absolute;
    top: 0;
    width: 1px;
    height: 8px;
    margin-left: -1px;
    border-radius: var(--radius-pill);
    background: var(--color-faint);
  }

  b[data-tick='deadline'] {
    width: 2px;
    background: var(--color-muted);
  }

  /* The closing tick sits inside the track's right end. */
  b[data-end] {
    right: 0;
    margin-left: 0;
  }

  em {
    position: absolute;
    top: 1px;
    width: 6px;
    height: 6px;
    margin-left: -3px;
    border-radius: var(--radius-pill);
    background: var(--tone);
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--tone) 24%, transparent),
      0 0 8px var(--tone);
    transition: left 600ms var(--ease-out);
    animation: ${pop} 420ms var(--ease-out) both;
  }

  @media (prefers-reduced-motion: reduce) {
    i,
    em {
      animation: none;
      transition: none;
    }
  }
`

const pct = (value: number) => `${Math.min(100, Math.max(0, value * 100))}%`

export const EntryStatus = ({
  status,
  now,
}: {
  status: EntryStatusView
  now: number
}) => {
  const detail = statusDetail(status, now)
  const progress = statusProgress(status, now)
  const deadline = status.deadline ?? 0
  const start = status.windowStart ?? 0
  const end = Math.max(status.windowEnd ?? 0, deadline)
  const running = progress !== undefined && now < deadline
  const span = end - start
  const deadlineAt = span > 0 ? (deadline - start) / span : 1
  const left = deadline - now
  const passed = deadline <= now
  const deadlineText = status.deadline
    ? status.deadlineName
      ? `${status.deadlineName} ${formatAbsolute(status.deadline)}${
          passed ? ' (passed)' : ''
        }`
      : `${passed ? 'Closed' : 'Closes'} ${formatAbsolute(status.deadline)}`
    : undefined
  const endText =
    status.windowEnd && status.windowEnd > deadline
      ? `the period closes ${formatAbsolute(status.windowEnd)}`
      : undefined
  const title = [deadlineText, endText].filter(Boolean).join(' · ') || undefined
  return (
    <Wrap title={title}>
      <Line>
        <StatusDot $tone={status.tone} aria-hidden />
        <Name>{status.label}</Name>
        {detail && <Detail>· {detail}</Detail>}
      </Line>
      {running && (
        <Track
          $tone={status.tone}
          role="img"
          aria-label={`${formatDurationLong(left)} left of a ${formatDurationLong(
            deadline - start,
          )} window${deadlineText ? `; ${deadlineText}` : ''}`}
        >
          <i data-part="used" style={{ width: pct(progress ?? 0) }} />
          <i
            data-part="left"
            style={{
              left: pct(progress ?? 0),
              width: pct(Math.max(0, deadlineAt - (progress ?? 0))),
            }}
          />
          {deadlineAt < 1 && (
            <b data-tick="deadline" style={{ left: pct(deadlineAt) }} />
          )}
          <b data-tick={deadlineAt < 1 ? 'end' : 'deadline'} data-end />
          <em style={{ left: pct(progress ?? 0) }} />
        </Track>
      )}
    </Wrap>
  )
}

export default EntryStatus
