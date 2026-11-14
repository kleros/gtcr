import React from 'react'
import styled, { keyframes } from 'styled-components'
import { formatAbsolute } from 'utils/time'
import { POLICY_RECENT_THRESHOLD_DAYS } from 'utils/format-updated-ago'
import { StatusDot } from 'components/curate/primitives'
import { daysSince, formatSince } from 'pages/item-details/format-since'
import { toNum } from './facts'

/*
 * "· updated 3 months ago" after the Stake item's listing policy chip. A
 * Stake list (PermanentGTCR) numbers its MetaEvidence by settings index from
 * 0, so the shared badge's log scan for odd IDs finds nothing here; the date
 * is read from the list's arbitration settings on the subgraph instead. A
 * settings change can keep the same policy file (only the arbitrator data
 * moves), so the run of newest settings that share the current policy is
 * walked back to its oldest entry, as the policy history merges them. A
 * policy changed in the last 7 days carries a warning dot, as elsewhere.
 */

export interface PolicySetting {
  timestamp?: string | number | null
  metadata?: { policyURI?: string | null } | null
}

/** When the policy in force took effect: unix seconds, or 0 if unknown. */
export const policyInForceSince = (
  settings: PolicySetting[] | undefined,
): number => {
  if (!settings?.length) return 0
  const newestFirst = [...settings].sort(
    (a, b) => toNum(b.timestamp) - toNum(a.timestamp),
  )
  const current = newestFirst[0].metadata?.policyURI
  let since = toNum(newestFirst[0].timestamp)
  if (!current) return since
  for (const setting of newestFirst.slice(1)) {
    if (setting.metadata?.policyURI !== current) break
    since = toNum(setting.timestamp) || since
  }
  return since
}

const Suffix = styled.span<{ $recent: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 4px;
  color: ${({ $recent }) =>
    $recent ? 'var(--color-text)' : 'var(--color-faint)'};
  font-size: 12px;
  line-height: 16px;
  font-weight: ${({ $recent }) => ($recent ? 500 : 400)};
  white-space: nowrap;

  &::before {
    content: '·';
    color: var(--color-faint);
    font-weight: 400;
  }
`

const shimmer = keyframes`
  from { background-position: 100% 0; }
  to { background-position: -100% 0; }
`

const LoadingSuffix = styled.span`
  display: inline-block;
  width: 72px;
  height: 8px;
  margin-left: 8px;
  border-radius: var(--radius-pill);
  background:
    linear-gradient(
        90deg,
        transparent,
        color-mix(in srgb, var(--color-text) 14%, transparent),
        transparent
      )
      0 0 / 200% 100%,
    var(--color-raised);
  vertical-align: middle;
  animation: ${shimmer} 1.4s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

export const PolicySince = ({
  since,
  loading,
  now,
}: {
  /** Unix seconds; 0 when unknown. */
  since: number
  loading?: boolean
  now: number
}) => {
  if (!since)
    return loading ? (
      <LoadingSuffix role="status" aria-label="Checking for policy updates" />
    ) : null
  const recent = daysSince(since, now) < POLICY_RECENT_THRESHOLD_DAYS
  return (
    <Suffix
      $recent={recent}
      title={`${recent ? 'Policy changed in the last 7 days · ' : 'In force since '}${formatAbsolute(since)}`}
    >
      {recent && <StatusDot $tone="contested" aria-hidden />}
      updated {formatSince(since, now)}
    </Suffix>
  )
}

export default PolicySince
