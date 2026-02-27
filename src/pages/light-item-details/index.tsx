import React, { useState, useEffect, useContext, useMemo } from 'react'
import styled from 'styled-components'
import { MAX_WIDTH_CONTENT } from 'styles/small-screen-style'
import { Layout, Breadcrumb } from 'components/ui'
import { useParams, Link } from 'react-router-dom'
import useUrlChainId from 'hooks/use-url-chain-id'
import useDocumentHead from 'hooks/use-document-head'
import { abi as _IArbitrator } from '@kleros/erc-792/build/contracts/IArbitrator.json'
import { ethers } from 'ethers'
import { useEthersProvider } from 'hooks/ethers-adapters'
import ErrorPage from '../error-page'
import ItemDetailsCard from 'components/item-details-card'
import ItemStatusCard from './item-status-card'
import CrowdfundingCard from './crowdfunding-card'
import { LightTCRViewContext } from 'contexts/light-tcr-view-context'
import RequestTimelines from '../../components/request-timelines'
import { WalletContext } from 'contexts/wallet-context'
import { capitalizeFirstLetter } from 'utils/string'
import { LIGHT_ITEM_DETAILS_QUERY } from 'utils/graphql'
import { useQuery } from '@tanstack/react-query'
import { STALE_TIME } from 'consts'
import { useGraphqlBatcher } from 'contexts/graphql-batcher'
import { fetchLightItemDetailViaRPC } from 'utils/rpc-item-fallback'
import SearchBar from 'components/light-search-bar'
import { parseIpfs } from 'utils/ipfs-parse'
import { itemToStatusCode, STATUS_CODE } from 'utils/item-status'
import { truncateAtWord } from 'utils/truncate-at-word'
import useTcrMetaEvidence from 'hooks/use-tcr-meta-evidence'

export const StyledBreadcrumbItem = styled(Breadcrumb.Item)`
  text-transform: capitalize;
  color: ${({ theme }) => theme.itemDetailsTitleColor} !important;
`

export const StyledLayoutContent = styled(Layout.Content)`
  padding: 0 var(--horizontal-padding) 42px;
  display: flex;
  flex-direction: column;
  width: 100%;
`

export const StyledBanner = styled.div`
  padding: 24px
    max(
      var(--horizontal-padding),
      calc(50vw - ${MAX_WIDTH_CONTENT} / 2 + var(--horizontal-padding))
    );
  background: ${({ theme }) => theme.bannerGradient};
  box-shadow: 0px 3px 24px ${({ theme }) => theme.shadowColor};
  color: ${({ theme }) => theme.textPrimary};
  transition:
    background 0.3s ease,
    box-shadow 0.3s ease,
    color 0.3s ease;
  width: 100vw;
  position: relative;
  left: 50%;
  margin-left: -50vw;
`

export const StyledMargin = styled.div`
  padding: 24px var(--horizontal-padding);
  display: flex;
  align-items: center;
`

export const StyledLink = styled(Link)`
  text-decoration: underline;
  color: ${({ theme }) => theme.itemDetailsSubtitleColor};
`

export const StyledBackLink = styled.div`
  margin-right: 12px;
  display: flex;
  align-items: center;
  white-space: nowrap;
  flex-shrink: 0;
`

export const Divider = styled.div`
  margin-bottom: 40px;
`

interface ItemDetailsProps {
  itemID: string
  search?: string
}

const ItemDetails = ({ itemID, search }: ItemDetailsProps) => {
  const { tcrAddress } = useParams()
  const chainId = useUrlChainId()
  const library = useEthersProvider({
    chainId: chainId ?? undefined,
  })
  const [ipfsItemData, setIpfsItemData] = useState<
    Record<string, unknown> | undefined
  >()
  const { timestamp } = useContext(WalletContext)
  const [modalOpen, setModalOpen] = useState<boolean | undefined>()
  const { tcrError, metaEvidence, challengePeriodDuration } =
    useContext(LightTCRViewContext)
  const [appealCost, setAppealCost] = useState<BigNumber | undefined>()

  // subgraph item entities have id "<itemID>@<listaddress>"
  const compoundId = `${itemID}@${tcrAddress.toLowerCase()}`
  const { graphqlBatcher } = useGraphqlBatcher()
  const detailsViewQuery = useQuery({
    queryKey: ['lightItemDetails', compoundId],
    queryFn: async () => {
      const result = await graphqlBatcher.fetch({
        id: crypto.randomUUID(),
        document: LIGHT_ITEM_DETAILS_QUERY,
        variables: { id: compoundId },
        chainId: chainId!,
      })
      if (result?.litem !== undefined) return result
      console.warn('Light item detail subgraph failed, trying RPC fallback')
      return (
        (await fetchLightItemDetailViaRPC(tcrAddress, itemID, chainId!)) ??
        result
      )
    },
    enabled: !!chainId,
    staleTime: STALE_TIME,
  })

  const item = useMemo(
    () =>
      detailsViewQuery.isLoading ? undefined : detailsViewQuery.data?.litem,
    [detailsViewQuery.isLoading, detailsViewQuery.data],
  )

  useEffect(() => {
    if (item && !ipfsItemData)
      fetch(parseIpfs(item.data))
        .then((r) => r.json())
        .catch((_e) => console.error('Could not get ipfs file'))
        .then((r) => setIpfsItemData(r))
        .catch((_e) => console.error('Could not set ipfs item data'))
  }, [item, ipfsItemData])

  const decodedItem = useMemo(() => {
    if (!item || !metaEvidence || !ipfsItemData) return undefined

    const orderDecodedData = (columns, values) => {
      const labels = columns.map((column) => column.label)
      const ordered = []
      for (const label of labels) {
        const value = values[label]
        ordered.push(value)
      }
      return ordered
    }

    return {
      ...item, // Spread to convert from array to object.
      errors: [],
      columns: metaEvidence.metadata.columns,
      decodedData: orderDecodedData(
        metaEvidence.metadata.columns,
        ipfsItemData.values,
      ),
    }
  }, [item, metaEvidence, ipfsItemData])

  const { metadata } = metaEvidence || {}
  const { decodedData } = decodedItem || {}
  const { tcrTitle, itemName } = metadata || {}

  const statusCode = useMemo(() => {
    if (!item || !timestamp || !challengePeriodDuration) return null
    return itemToStatusCode(item, timestamp, challengePeriodDuration)
  }, [item, timestamp, challengePeriodDuration])

  const getStatusPhrase = (statusCode) => {
    switch (statusCode) {
      case STATUS_CODE.REGISTERED:
        return 'is verified to be safe'
      case STATUS_CODE.SUBMITTED:
        return 'is pending verification'
      case STATUS_CODE.REMOVAL_REQUESTED:
        return 'has removal requested'
      case STATUS_CODE.CHALLENGED:
        return 'is under challenge'
      case STATUS_CODE.CROWDFUNDING:
        return 'is crowdfunding appeal'
      case STATUS_CODE.CROWDFUNDING_WINNER:
        return 'won crowdfunding appeal'
      case STATUS_CODE.PENDING_SUBMISSION:
        return 'awaits submission'
      case STATUS_CODE.PENDING_REMOVAL:
        return 'awaits removal'
      case STATUS_CODE.WAITING_ARBITRATOR:
        return 'awaits arbitrator ruling'
      case STATUS_CODE.REJECTED:
        return 'was rejected'
      case STATUS_CODE.REMOVED:
        return 'was removed'
      default:
        return 'has unknown status'
    }
  }

  const capitalizeFirst = (s) => s?.charAt(0).toUpperCase() + s?.slice(1)

  const fullSeoTitle =
    decodedItem && metadata
      ? `${capitalizeFirst(itemName)} - ${tcrTitle} - Kleros · Curate`
      : 'Kleros · Curate'
  const truncatedSeoTitle = truncateAtWord(fullSeoTitle, 160)

  const fullSeoMetaDescription =
    decodedItem && metadata && statusCode !== null
      ? `${decodedData.join(' ')} - ${getStatusPhrase(statusCode)} on ${
          metadata.tcrTitle
        } in Kleros Curate`
      : 'View item details on Kleros Curate.'
  const truncatedSeoMetaDescription = truncateAtWord(
    fullSeoMetaDescription,
    160,
  )

  // If this is a TCR in a TCR of TCRs, fetch its metadata via cached hook.
  const itemAddress = metadata?.isTCRofTCRs
    ? decodedItem?.decodedData?.[0]
    : undefined
  const itemMetaQuery = useTcrMetaEvidence(itemAddress, chainId ?? undefined)
  const itemMetaEvidence = useMemo(() => {
    if (itemMetaQuery.error) return { error: itemMetaQuery.error }
    if (itemMetaQuery.data) return { file: itemMetaQuery.data }
    return undefined
  }, [itemMetaQuery.data, itemMetaQuery.error])

  const loading =
    !metadata ||
    (!decodedData && decodedItem && decodedItem.errors.length === 0)

  // Check if there is some action on the URL and, if so, run it.
  useEffect(() => {
    if (loading) return

    const params = new URLSearchParams(search)
    if (!params.get('action')) return

    setModalOpen(true)
  }, [loading, search])

  // If the item is disputed, unresolved etc, get the appealCost to propagate it to
  // crowdfunding related components
  useEffect(() => {
    if (!item || appealCost !== undefined) return
    const request = item.requests[0]
    // appeal cost might not be applicable
    if (request.resolved || !request.disputed) setAppealCost(null)
    else {
      const arbitrator = new ethers.Contract(
        request.arbitrator,
        _IArbitrator,
        library,
      )
      arbitrator
        .appealCost(request.disputeID, request.arbitratorExtraData)
        .then((cost) => setAppealCost(cost))
        .catch((err) => {
          console.error(err)
          setAppealCost(null)
        })
    }
  }, [item, appealCost, library])

  useDocumentHead(truncatedSeoTitle, truncatedSeoMetaDescription)

  if (!tcrAddress || !itemID || tcrError)
    return (
      <ErrorPage
        code="400"
        message={tcrError || 'This item could not be found.'}
        tip="Make sure your wallet is set to the correct network (is this on Gnosis Chain?)."
      />
    )

  return (
    <>
      <StyledBanner>
        <Breadcrumb separator=">">
          <StyledBreadcrumbItem>
            <StyledLink to={`/tcr/${chainId}/${tcrAddress}`}>
              {tcrTitle}
            </StyledLink>
          </StyledBreadcrumbItem>
          <StyledBreadcrumbItem>
            {itemName && capitalizeFirstLetter(itemName)} Details
          </StyledBreadcrumbItem>
        </Breadcrumb>
      </StyledBanner>
      <StyledMargin>
        <StyledBackLink>
          <StyledLink to={`/tcr/${chainId}/${tcrAddress}`}>Go Back</StyledLink>
        </StyledBackLink>
        <SearchBar />
      </StyledMargin>
      <StyledLayoutContent>
        <ItemStatusCard
          item={decodedItem}
          timestamp={timestamp}
          request={item?.requests && { ...item.requests[0] }}
          modalOpen={modalOpen}
          setModalOpen={setModalOpen}
          appealCost={appealCost}
          dark
        />
        <Divider />
        <ItemDetailsCard
          columns={decodedItem?.columns}
          item={decodedItem}
          title={`${
            itemName ? capitalizeFirstLetter(itemName) : 'Item'
          } Details`}
          loading={loading}
          itemMetaEvidence={itemMetaEvidence}
        />
        {/* Crowdfunding card is only rendered if the item has an appealable dispute. */}
        <CrowdfundingCard
          item={decodedItem}
          timestamp={timestamp}
          appealCost={appealCost}
        />

        {/* Spread the `requests` parameter to convert elements from array to an object */}
        <RequestTimelines
          item={item}
          requests={item?.requests && item.requests.map((r) => ({ ...r }))}
          kind="light"
          metaEvidence={metaEvidence}
        />
      </StyledLayoutContent>
    </>
  )
}

export default ItemDetails
