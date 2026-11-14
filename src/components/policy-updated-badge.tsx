import React, { useMemo } from 'react'
import styled, { keyframes } from 'styled-components'
import useUrlChainId from 'hooks/use-url-chain-id'
import { usePolicyHistory } from 'hooks/use-policy-history'
import {
  formatUpdatedAgo,
  POLICY_RECENT_THRESHOLD_DAYS,
} from 'utils/format-updated-ago'
import { StatusDot } from 'components/curate/primitives'

/*
 * "updated N days ago" beside the listing policy link. A policy changed in
 * the last 7 days carries a warning dot, because entries are judged by the
 * policy in force now. While the history loads, a short shimmer holds the
 * place instead of words.
 */

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

interface PolicyUpdatedBadgeProps {
  registryAddress?: string | null
}

/**
 * "updated N days ago" annotation rendered next to the policy link.
 * Uses the `'latest'` mode so it only scans backwards until the first hit,
 * warmed by the `'full'` cache whenever the user has already opened the
 * policy history.
 */
const PolicyUpdatedBadge: React.FC<PolicyUpdatedBadgeProps> = ({
  registryAddress,
}) => {
  const chainId = useUrlChainId()
  const {
    data: historyData,
    isLoading,
    isFetching,
  } = usePolicyHistory(
    registryAddress ?? undefined,
    chainId ?? undefined,
    'latest',
  )

  const updatedInfo = useMemo(() => {
    const current = historyData?.[0]
    if (!current) return null
    return formatUpdatedAgo(current.startDate)
  }, [historyData])

  if (!registryAddress) return null

  if (updatedInfo) {
    const recent = updatedInfo.days < POLICY_RECENT_THRESHOLD_DAYS
    return (
      <Suffix
        $recent={recent}
        title={recent ? 'Policy changed in the last 7 days' : undefined}
      >
        {recent && <StatusDot $tone="contested" aria-hidden />}
        {updatedInfo.text}
      </Suffix>
    )
  }

  if (isLoading || isFetching)
    return (
      <LoadingSuffix role="status" aria-label="Checking for policy updates" />
    )

  return null
}

export default PolicyUpdatedBadge
