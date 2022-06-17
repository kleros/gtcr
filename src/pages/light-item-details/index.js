import { Layout, Breadcrumb } from 'antd'
import React, { useState, useEffect, useContext } from 'react'
import qs from 'qs'
import styled from 'styled-components/macro'
import { Link } from 'react-router-dom'
import ErrorPage from '../error-page'
import ItemDetailsCard from 'components/item-details-card'
import ItemStatusCard from './item-status-card'
import CrowdfundingCard from './crowdfunding-card'
import { LightTCRViewContext } from 'contexts/light-tcr-view-context'
import RequestTimelines from './request-timelines'
import { WalletContext } from 'contexts/wallet-context'
import { capitalizeFirstLetter, ZERO_ADDRESS } from 'utils/helpers/string'
import Badges from './badges'
import AppTour from 'components/tour'
import itemTourSteps from './tour-steps'
import SearchBar from 'components/light-search-bar'
import useTcrParams from 'hooks/use-tcr-params'
import useMetaEvidence from 'hooks/use-meta-evidence'
import { ITEM_STATUS_CODES } from 'utils/constants/subgraph'

const ITEM_TOUR_DISMISSED = 'ITEM_TOUR_DISMISSED'

const StyledBreadcrumbItem = styled(Breadcrumb.Item)`
  text-transform: capitalize;
`

const StyledLayoutContent = styled(Layout.Content)`
  padding: 0 9.375vw 42px;
  display: flex;
  flex-direction: column;
`

const StyledBanner = styled.div`
  padding: 24px 9.375vw;
  background: linear-gradient(270deg, #f2e3ff 22.92%, #ffffff 76.25%);
  box-shadow: 0px 3px 24px #bc9cff;
  color: #4d00b4;
`

const StyledMargin = styled.div`
  padding: 24px 9.375vw;
  display: flex;
`

const StyledLink = styled(Link)`
  text-decoration: underline;
  color: rgba(77, 0, 180, 0.45);
`

const StyledBackLink = styled.div`
  min-width: 53px;
  margin-right: 12px;
  display: flex;
  align-items: center;
`

// TODO: Ensure we don't set state for unmounted components using
// flags and AbortController.
//
// Reference:
// https://itnext.io/how-to-create-react-custom-hooks-for-data-fetching-with-useeffect-74c5dc47000a
// TODO: Ensure http requests are being sent in parallel.
const ItemDetails = ({ itemID, search }) => {
  const { tcrAddress, chainId } = useTcrParams()
  const { timestamp } = useContext(WalletContext)
  const [error, setError] = useState()
  const [requests, setRequests] = useState()
  const [modalOpen, setModalOpen] = useState()

  const {
    regData: { connectedTCR },
    metaEvidence,
    items
  } = useContext(LightTCRViewContext)
  const [item, setItem] = useState()

  useEffect(() => {
    if (!itemID || items.length === 0) return

    const item = items.find(it => it.itemID === itemID)
    const { requests, data: itemURI, latestRequest: request } = item

    setRequests(
      requests.map(request => ({
        ...request,
        requestType: ITEM_STATUS_CODES[request.requestType]
      }))
    )

    const asyncProc = async () => {
      try {
        const ipfsRequest = await fetch(
          `${process.env.REACT_APP_IPFS_GATEWAY}${itemURI}`
        )
        const { columns, values } = await ipfsRequest.json()

        setItem({
          ...item,
          requestsFromSubgraph: requests,
          columns,
          errors: [],
          decodedData: columns.map(col => values[col.label]),
          disputed: request.disputed,
          resolved: request.resolved,
          disputeID: request.disputeID,
          requester: request.requester,
          challenger: request.challenger,
          arbitrator: request.arbitrator,
          arbitratorExtraData: request.arbitratorExtraData
        })
      } catch (err) {
        setError(err)
        console.error(err)
      }
    }

    asyncProc()
  }, [itemID, items])

  const { metadata } = metaEvidence || {}
  const { decodedData } = item || {}

  const { metaEvidence: itemMetaEvidence } = useMetaEvidence(
    item?.decodedData?.[0]
  )

  const loading = !metadata || !decodedData

  // Check if there is some action on the URL and, if so, run it.
  useEffect(() => {
    if (loading) return

    const params = qs.parse(search)
    if (!params['?action']) return

    setModalOpen(true)
  }, [loading, search])

  if (!tcrAddress || !itemID || error)
    return (
      <ErrorPage
        code="400"
        message={error || 'This item could not be found.'}
        tip="Make sure your wallet is set to the correct network (is this on xDai?)."
      />
    )

  const { tcrTitle, itemName } = metadata || {}
  const { isConnectedTCR, relTcrDisabled } = metadata || {}
  // TODO: modify to add greyed out fields, come here and add the current list schema and
  // pass it through param to ItemDetailsCard.
  const { columns } = item || {}
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
          item={item}
          timestamp={timestamp}
          request={requests && requests[0]}
          modalOpen={modalOpen}
          setModalOpen={setModalOpen}
          dark
        />
        <div style={{ marginBottom: '40px' }} />
        <ItemDetailsCard
          columns={columns}
          item={item}
          title={`${
            itemName ? capitalizeFirstLetter(itemName) : 'Item'
          } Details`}
          loading={loading}
          itemMetaEvidence={itemMetaEvidence}
        />
        {/* Crowdfunding card is only rendered if the item has an appealable dispute. */}
        <CrowdfundingCard item={item} timestamp={timestamp} />

        {/* Spread the `requests` parameter to convert elements from array to an object */}
        <RequestTimelines item={item} requests={requests} />
        {connectedTCR !== ZERO_ADDRESS &&
          metadata &&
          !isConnectedTCR &&
          !relTcrDisabled && (
            <Badges
              connectedTCRAddr={connectedTCR}
              item={item}
              tcrAddress={tcrAddress}
            />
          )}
      </StyledLayoutContent>
      <AppTour
        dismissedKey={ITEM_TOUR_DISMISSED}
        steps={itemTourSteps(metadata)}
      />
    </>
  )
}

export default ItemDetails
