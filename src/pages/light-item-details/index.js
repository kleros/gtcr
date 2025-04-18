import React, { useState, useEffect, useContext, useMemo } from 'react'
import styled from 'styled-components'
import { Layout, Breadcrumb } from 'antd'
import { useParams } from 'react-router'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import qs from 'qs'
import { abi as _IArbitrator } from '@kleros/erc-792/build/contracts/IArbitrator.json'
import { ethers } from 'ethers'
import { useWeb3Context } from 'web3-react'
import ErrorPage from '../error-page'
import ItemDetailsCard from 'components/item-details-card'
import ItemStatusCard from './item-status-card'
import CrowdfundingCard from './crowdfunding-card'
import { LightTCRViewContext } from 'contexts/light-tcr-view-context'
import RequestTimelines from '../../components/request-timelines'
import { WalletContext } from 'contexts/wallet-context'
import { capitalizeFirstLetter } from 'utils/string'
import AppTour from 'components/tour'
import { itemTourSteps } from './tour-steps'
import { LIGHT_ITEM_DETAILS_QUERY } from 'utils/graphql'
import { useQuery } from '@apollo/client'
import SearchBar from 'components/light-search-bar'
import { parseIpfs } from 'utils/ipfs-parse'
import { itemToStatusCode, STATUS_CODE } from 'utils/item-status'
import { truncateAtWord } from 'utils/truncate-at-word'
import { fetchMetaEvidence } from 'hooks/tcr-view'

export const ITEM_TOUR_DISMISSED = 'ITEM_TOUR_DISMISSED'

export const StyledBreadcrumbItem = styled(Breadcrumb.Item)`
  text-transform: capitalize;
`

export const StyledLayoutContent = styled(Layout.Content)`
  padding: 0 9.375vw 42px;
  display: flex;
  flex-direction: column;
  width: 100%;
`

export const StyledBanner = styled.div`
  padding: 24px 9.375vw;
  background: linear-gradient(270deg, #f2e3ff 22.92%, #ffffff 76.25%);
  box-shadow: 0px 3px 24px #bc9cff;
  color: #4d00b4;
`

export const StyledMargin = styled.div`
  padding: 24px 9.375vw;
  display: flex;
`

export const StyledLink = styled(Link)`
  text-decoration: underline;
  color: rgba(77, 0, 180, 0.45);
`

export const StyledBackLink = styled.div`
  min-width: 53px;
  margin-right: 12px;
  display: flex;
  align-items: center;
`

export const Divider = styled.div`
  margin-bottom: 40px;
`

// TODO: Ensure we don't set state for unmounted components using
// flags and AbortController.
//
// Reference:
// https://itnext.io/how-to-create-react-custom-hooks-for-data-fetching-with-useeffect-74c5dc47000a
// TODO: Ensure http requests are being sent in parallel.
const ItemDetails = ({ itemID, search }) => {
  const { library } = useWeb3Context()
  const { tcrAddress, chainId } = useParams()
  const [itemMetaEvidence, setItemMetaEvidence] = useState()
  const [ipfsItemData, setIpfsItemData] = useState()
  const { timestamp } = useContext(WalletContext)
  const [modalOpen, setModalOpen] = useState()
  const { tcrError, metaEvidence, challengePeriodDuration } = useContext(
    LightTCRViewContext
  )
  const [appealCost, setAppealCost] = useState()

  // subgraph item entities have id "<itemID>@<listaddress>"
  const compoundId = `${itemID}@${tcrAddress.toLowerCase()}`
  const detailsViewQuery = useQuery(LIGHT_ITEM_DETAILS_QUERY, {
    variables: { id: compoundId }
  })

  const item = useMemo(
    () => (detailsViewQuery.loading ? undefined : detailsViewQuery.data?.litem),
    [detailsViewQuery]
  )

  useEffect(() => {
    if (item && !ipfsItemData)
      fetch(parseIpfs(item.data))
        .then(r => r.json())
        .catch(_e => console.error('Could not get ipfs file'))
        .then(r => setIpfsItemData(r))
        .catch(_e => console.error('Could not set ipfs item data'))
  }, [item, ipfsItemData])

  const decodedItem = useMemo(() => {
    if (!item || !metaEvidence || !ipfsItemData) return undefined

    const orderDecodedData = (columns, values) => {
      const labels = columns.map(column => column.label)
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
        ipfsItemData.values
      )
    }
  }, [item, metaEvidence, ipfsItemData])

  const { metadata } = metaEvidence || {}
  const { decodedData } = decodedItem || {}
  const { tcrTitle, itemName } = metadata || {}

  const statusCode = useMemo(() => {
    if (!item || !timestamp || !challengePeriodDuration) return null
    return itemToStatusCode(item, timestamp, challengePeriodDuration)
  }, [item, timestamp, challengePeriodDuration])

  const getStatusPhrase = statusCode => {
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
      case STATUS_CODE.ABSENT:
        return 'is not listed'
      default:
        return 'has unknown status'
    }
  }

  const capitalizeFirst = s => s?.charAt(0).toUpperCase() + s?.slice(1)

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
    160
  )

  // If this is a TCR in a TCR of TCRs, we fetch its metadata as well
  // to build a better item details card.
  useEffect(() => {
    ;(async () => {
      const { isTCRofTCRs } = metadata || {}
      if (!isTCRofTCRs) return
      if (!decodedItem) return
      const itemAddress = decodedItem.decodedData[0] // There is only one column, the TCR address.

      try {
        // Take the latest meta evidence.
        const path = await fetchMetaEvidence(itemAddress, chainId)
        const file = await (await fetch(parseIpfs(path.metaEvidenceURI))).json()

        setItemMetaEvidence({ file })
      } catch (err) {
        console.error('Error fetching meta evidence', err)
        setItemMetaEvidence({ error: err })
      }
    })()
  }, [decodedItem, library, metadata, chainId])

  const loading =
    !metadata ||
    (!decodedData && decodedItem && decodedItem.errors.length === 0)

  // Check if there is some action on the URL and, if so, run it.
  useEffect(() => {
    if (loading) return

    const params = qs.parse(search)
    if (!params['?action']) return

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
        library
      )
      arbitrator
        .appealCost(request.disputeID, request.arbitratorExtraData)
        .then(cost => setAppealCost(cost))
        .catch(err => {
          console.error(err)
          setAppealCost(null)
        })
    }
  }, [item, appealCost, library])

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
      <Helmet>
        <title>{truncatedSeoTitle}</title>
        <meta name="description" content={truncatedSeoMetaDescription} />
      </Helmet>
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
          requests={item?.requests && item.requests.map(r => ({ ...r }))}
          kind="light"
          metaEvidence={metaEvidence}
        />
        {/* Todo: Fix badges later */}
        {/* {connectedTCRAddr !== ZERO_ADDRESS &&
          metadata &&
          !isConnectedTCR &&
          !relTcrDisabled && (
            <Badges
              connectedTCRAddr={connectedTCRAddr}
              item={decodedItem}
              tcrAddress={tcrAddress}
            />
          )} */}
      </StyledLayoutContent>
      <AppTour
        dismissedKey={ITEM_TOUR_DISMISSED}
        steps={itemTourSteps(metadata)}
      />
    </>
  )
}

export default ItemDetails
