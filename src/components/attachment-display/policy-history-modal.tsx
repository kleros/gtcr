import React, { useMemo } from 'react'
import styled from 'styled-components'
import { useParams, useSearchParams } from 'react-router-dom'
import { Modal, Skeleton } from 'components/ui'
import useUrlChainId from 'hooks/use-url-chain-id'
import { usePolicyHistory } from 'hooks/use-policy-history'
import { PolicyHistoryEntry } from 'utils/fetch-policy-history'
import { parseIpfs } from 'utils/ipfs-parse'
import { formatPolicyDate } from 'utils/format-updated-ago'
import { buttonReset } from 'styles/button-reset'
import { getTxPage } from 'utils/network-utils'
import NewTabIcon from 'assets/icons/new-tab.svg?react'

const HistoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  /* Cap the scrollable area so the modal shell stays away from the
     viewport edges even for registries with long policy histories. */
  max-height: 65vh;
  overflow-y: auto;
  /* Reserve a bit of padding so focus rings / hover borders don't
     touch the scrollbar. */
  padding-right: 4px;
  margin-right: -4px;
`

const HistoryItem = styled.div<{ $isCurrent: boolean; $isViewing: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid
    ${({ $isViewing, $isCurrent, theme }) =>
      $isViewing
        ? theme.primaryColor
        : $isCurrent
          ? theme.borderColor
          : 'transparent'};
  background: ${({ $isViewing, $isCurrent, theme }) =>
    $isViewing
      ? `${theme.primaryColor}1f`
      : $isCurrent
        ? theme.elevatedBackground
        : 'transparent'};
  transition:
    background 0.2s ease,
    border-color 0.2s ease;

  &:hover {
    background: ${({ theme }) => theme.dropdownHoverBg};
  }
`

const ItemHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`

const DateRange = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.textPrimary};
  font-weight: 600;
`

const BadgesContainer = styled.div`
  display: flex;
  gap: 6px;
  align-items: center;
`

const Pill = styled.span<{ $tone: 'accent' | 'success' }>`
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 9999px;
  color: ${({ theme, $tone }) =>
    $tone === 'success' ? theme.successColor : theme.primaryColor};
  background: ${({ theme, $tone }) =>
    $tone === 'success'
      ? `${theme.successColor}22`
      : `${theme.primaryColor}22`};
`

const ItemLinks = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
`

const ViewButton = styled.button`
  ${buttonReset}
  font-size: 13px;
  color: ${({ theme }) => theme.primaryColor};
  font-weight: 600;
  transition: color 0.2s ease;

  &:hover {
    color: ${({ theme }) => theme.primaryColorHover};
    text-decoration: underline;
  }
`

const ExternalLink = styled.a`
  font-size: 13px;
  color: ${({ theme }) => theme.linkColor};
  text-decoration: none;
  transition: color 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 4px;

  &:hover {
    color: ${({ theme }) => theme.primaryColorHover};
    text-decoration: underline;
  }
`

const StyledNewTabIcon = styled(NewTabIcon)`
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  path {
    fill: ${({ theme }) => theme.linkColor};
    transition: fill 0.2s ease;
  }

  ${ExternalLink}:hover & path {
    fill: ${({ theme }) => theme.primaryColorHover};
  }
`

const TxLink = styled(ExternalLink)`
  font-size: 12px;
  color: ${({ theme }) => theme.textSecondary};
`

const Separator = styled.span`
  color: ${({ theme }) => theme.textTertiary};
  font-size: 12px;
`

const EmptyState = styled.div`
  text-align: center;
  padding: 24px 16px;
  color: ${({ theme }) => theme.textSecondary};
  font-size: 14px;
`

const truncateHash = (hash: string): string =>
  `${hash.slice(0, 10)}...${hash.slice(-6)}`

interface PolicyHistoryModalProps {
  onClose: () => void
}

const PolicyHistoryModal: React.FC<PolicyHistoryModalProps> = ({ onClose }) => {
  const { tcrAddress } = useParams<{ tcrAddress: string }>()
  const chainId = useUrlChainId()
  const [searchParams, setSearchParams] = useSearchParams()

  const currentPolicyTx = searchParams.get('policyTx')
  const currentAttachmentUrl = searchParams.get('attachment')

  const {
    data: historyData,
    isLoading,
    isError,
  } = usePolicyHistory(tcrAddress, chainId ?? undefined)

  const history = useMemo(() => {
    if (!historyData) return []
    return [...historyData].reverse()
  }, [historyData])

  const handleViewPolicy = (entry: PolicyHistoryEntry) => {
    const url = parseIpfs(entry.policyURI)
    setSearchParams(
      (prev) => {
        const newParams = new URLSearchParams(prev)
        newParams.set('attachment', url)
        newParams.set('policyTx', entry.txHash)
        newParams.set('isPolicy', 'true')
        return newParams
      },
      { replace: true },
    )
    onClose()
  }

  return (
    <Modal
      visible
      title="Policy History"
      onCancel={onClose}
      footer={null}
      width={720}
      centered
    >
      <HistoryList>
        {isLoading && history.length === 0 ? (
          <>
            {Array.from({ length: 3 }).map((_, i) => (
              <HistoryItem key={i} $isCurrent={false} $isViewing={false}>
                <Skeleton active paragraph={{ rows: 1 }} />
              </HistoryItem>
            ))}
          </>
        ) : null}
        {isError && history.length === 0 ? (
          <EmptyState>
            Failed to load policy history. Please try again later.
          </EmptyState>
        ) : null}
        {!isLoading && !isError && history.length === 0 ? (
          <EmptyState>No policy history found for this registry.</EmptyState>
        ) : null}
        {history.map((entry) => {
          const isCurrent = entry.endDate === null
          const isViewing = currentPolicyTx
            ? entry.txHash === currentPolicyTx
            : isCurrent && currentAttachmentUrl === parseIpfs(entry.policyURI)
          return (
            <HistoryItem
              key={entry.txHash}
              $isCurrent={isCurrent}
              $isViewing={isViewing}
            >
              <ItemHeader>
                <DateRange>
                  {formatPolicyDate(entry.startDate)}
                  {' → '}
                  {isCurrent ? 'Present' : formatPolicyDate(entry.endDate!)}
                </DateRange>
                <BadgesContainer>
                  {isViewing && <Pill $tone="success">Viewing</Pill>}
                  {isCurrent && <Pill $tone="accent">Current</Pill>}
                </BadgesContainer>
              </ItemHeader>
              <ItemLinks>
                <ViewButton onClick={() => handleViewPolicy(entry)}>
                  View Policy
                </ViewButton>
                <Separator>|</Separator>
                <ExternalLink
                  href={parseIpfs(entry.policyURI)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in new tab
                  <StyledNewTabIcon />
                </ExternalLink>
                {chainId ? (
                  <>
                    <Separator>|</Separator>
                    <TxLink
                      href={getTxPage({
                        networkId: chainId,
                        txHash: entry.txHash,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      tx: {truncateHash(entry.txHash)}
                    </TxLink>
                  </>
                ) : null}
              </ItemLinks>
            </HistoryItem>
          )
        })}
      </HistoryList>
    </Modal>
  )
}

export default PolicyHistoryModal
