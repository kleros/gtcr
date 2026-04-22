import React, { useMemo } from 'react'
import styled, { keyframes } from 'styled-components'
import useUrlChainId from 'hooks/use-url-chain-id'
import { usePolicyHistory } from 'hooks/use-policy-history'
import {
  formatUpdatedAgo,
  POLICY_RECENT_THRESHOLD_DAYS,
} from 'utils/format-updated-ago'

const Suffix = styled.span<{ $recent: boolean }>`
  margin-left: 6px;
  color: ${({ theme, $recent }) =>
    $recent ? theme.warningColor : theme.textTertiary};
  font-weight: ${({ $recent }) => ($recent ? 600 : 400)};
`

const pulse = keyframes`
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
`

const LoadingSuffix = styled.span`
  margin-left: 6px;
  color: ${({ theme }) => theme.textTertiary};
  font-style: italic;
  animation: ${pulse} 1.4s ease-in-out infinite;
`

interface PolicyUpdatedBadgeProps {
  registryAddress?: string | null
}

/**
 * Subtle "(updated N days ago)" annotation rendered next to the policy link.
 * Uses the `'latest'` mode so it only scans backwards until the first hit —
 * much cheaper than a full history scan and warmed by the `'full'` cache
 * whenever the user has already opened Previous Policies.
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

  if (updatedInfo)
    return (
      <Suffix $recent={updatedInfo.days < POLICY_RECENT_THRESHOLD_DAYS}>
        ({updatedInfo.text})
      </Suffix>
    )

  if (isLoading || isFetching)
    return <LoadingSuffix>(fetching update…)</LoadingSuffix>

  return null
}

export default PolicyUpdatedBadge
