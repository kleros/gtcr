import React, { lazy, Suspense, useMemo } from 'react'
import styled from 'styled-components'
import { useSearchParams, useParams } from 'react-router-dom'
import Icon from 'components/ui/Icon'
import Loading from 'components/loading'
import useUrlChainId from 'hooks/use-url-chain-id'
import { usePolicyHistory } from 'hooks/use-policy-history'
import { parseIpfs } from 'utils/ipfs-parse'
import { formatPolicyDate } from 'utils/format-updated-ago'
import { buttonReset } from 'styles/button-reset'
import NewTabIcon from 'assets/icons/new-tab.svg'
import Header from './header'

const FileViewer = lazy(() => import('components/file-viewer'))

const Container = styled.div`
  width: 100%;
  padding: 24px var(--horizontal-padding);
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const LoaderContainer = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 24px;
`

const OpenInNewTab = styled.a`
  align-self: flex-end;
  display: flex;
  gap: 6px;
  align-items: center;
  color: ${({ theme }) => theme.linkColor};
  text-decoration: none;
  font-size: 13px;
  transition: color 0.2s ease;

  &:hover {
    color: ${({ theme }) => theme.primaryColorHover};
  }
`

const StyledNewTabIcon = styled(NewTabIcon)`
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  path {
    fill: ${({ theme }) => theme.linkColor};
    transition: fill 0.2s ease;
  }

  ${OpenInNewTab}:hover & path {
    fill: ${({ theme }) => theme.primaryColorHover};
  }
`

const PastPolicyBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 12px;
  background: ${({ theme }) => `${theme.warningColor}14`};
  border: 1px solid ${({ theme }) => `${theme.warningColor}40`};
  flex-wrap: wrap;
`

const BannerText = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.warningColor};
  font-weight: 600;
`

const BannerDateRange = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.textSecondary};
  font-weight: 400;
`

const ViewCurrentButton = styled.button`
  ${buttonReset}
  font-size: 13px;
  color: ${({ theme }) => theme.linkColor};
  margin-left: auto;
  font-weight: 600;
  white-space: nowrap;
  transition: color 0.2s ease;

  &:hover {
    color: ${({ theme }) => theme.primaryColorHover};
    text-decoration: underline;
  }
`

/**
 * In-app attachment display used to render policies and evidence files
 * without leaving the app. Driven by URL params:
 *   - `attachment` (required): the IPFS-resolved URL to display.
 *   - `isPolicy`: marks the attachment as a policy document (shows the
 *     "Previous Policies" header button and the past-policy banner when
 *     applicable).
 *   - `policyTx`: the MetaEvidence transaction hash that published this
 *     policy. When present, used to look up the entry in the history to
 *     show start/end dates and expose a "View Current Policy" shortcut.
 */
const AttachmentDisplay: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const { tcrAddress } = useParams<{ tcrAddress: string }>()
  const chainId = useUrlChainId()

  const url = searchParams.get('attachment')
  const policyTx = searchParams.get('policyTx')

  // Only fetch history when a past policy is being viewed (policyTx is set).
  // This avoids the multi-second chain scan for the common case where users
  // click "View Submission Policy" — the modal fetches on-demand.
  const { data: historyData } = usePolicyHistory(
    policyTx ? tcrAddress : undefined,
    chainId ?? undefined,
  )

  const pastPolicyInfo = useMemo(() => {
    if (!url || !policyTx || !historyData) return null

    const matchedEntry = historyData.find((e) => e.txHash === policyTx)
    if (!matchedEntry || matchedEntry.endDate === null) return null

    const currentEntry = historyData.find((e) => e.endDate === null)
    return {
      startDate: formatPolicyDate(matchedEntry.startDate),
      endDate: formatPolicyDate(matchedEntry.endDate),
      currentPolicyURL: currentEntry ? parseIpfs(currentEntry.policyURI) : null,
    }
  }, [url, policyTx, historyData])

  const handleViewCurrent = () => {
    const currentPolicyURL = pastPolicyInfo?.currentPolicyURL
    if (!currentPolicyURL) return
    setSearchParams(
      (prev) => {
        const newParams = new URLSearchParams(prev)
        newParams.set('attachment', currentPolicyURL)
        newParams.delete('policyTx')
        newParams.set('isPolicy', 'true')
        return newParams
      },
      { replace: true },
    )
  }

  if (!url) return null

  return (
    <Container>
      <Header />
      {pastPolicyInfo && (
        <PastPolicyBanner>
          <Icon type="warning" />
          <div>
            <BannerText>Past Policy</BannerText>{' '}
            <BannerDateRange>
              ({pastPolicyInfo.startDate} — {pastPolicyInfo.endDate})
            </BannerDateRange>
          </div>
          {pastPolicyInfo.currentPolicyURL && (
            <ViewCurrentButton onClick={handleViewCurrent}>
              View Current Policy
            </ViewCurrentButton>
          )}
        </PastPolicyBanner>
      )}
      <OpenInNewTab href={url} rel="noreferrer" target="_blank">
        Open in new tab
        <StyledNewTabIcon />
      </OpenInNewTab>
      <Suspense
        fallback={
          <LoaderContainer>
            <Loading />
          </LoaderContainer>
        }
      >
        <FileViewer url={url} />
      </Suspense>
    </Container>
  )
}

export default AttachmentDisplay
