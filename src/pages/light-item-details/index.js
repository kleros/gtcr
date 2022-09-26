import { Layout, Breadcrumb } from 'antd'
import React, {
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
  useMemo
} from 'react'
import { useParams } from 'react-router'
import qs from 'qs'
import PropTypes from 'prop-types'
import styled from 'styled-components/macro'
import { useWeb3Context } from 'web3-react'
import { Link } from 'react-router-dom'
import ErrorPage from '../error-page'
import { ethers } from 'ethers'
import { abi as _arbitrator } from '@kleros/erc-792/build/contracts/IArbitrator.json'
import _gtcr from 'assets/abis/LightGeneralizedTCR.json'
import ItemDetailsCard from 'components/item-details-card'
import ItemStatusCard from './item-status-card'
import CrowdfundingCard from './crowdfunding-card'
import { LightTCRViewContext } from 'contexts/light-tcr-view-context'
import RequestTimelines from './request-timelines'
import { WalletContext } from 'contexts/wallet-context'
import { capitalizeFirstLetter, ZERO_ADDRESS } from 'utils/string'
import Badges from './badges'
import AppTour from 'components/tour'
import itemTourSteps from './tour-steps'
import takeLower from 'utils/lower-limit'
import { SUBGRAPH_STATUS_TO_CODE } from 'utils/item-status'
import { LIGHT_ITEM_DETAILS_QUERY } from 'utils/graphql'
import { useQuery } from '@apollo/client'
import SearchBar from 'components/light-search-bar'
import useGetLogs from 'hooks/get-logs'

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
  const { library } = useWeb3Context()
  const { tcrAddress, chainId } = useParams()
  const [error, setError] = useState()
  const [itemMetaEvidence, setItemMetaEvidence] = useState()
  const { timestamp } = useContext(WalletContext)
  const [decodedItem, setDecodedItem] = useState()
  const [item, setItem] = useState()
  const [metaEvidence, setMetaEvidence] = useState()
  const [requests, setRequests] = useState()
  const arbitrator = useMemo(() => {
    if (!item || !library) return
    return new ethers.Contract(item.arbitrator, _arbitrator, library)
  }, [item, library])
  const refAttr = useRef()
  const [eventListenerSet, setEventListenerSet] = useState()
  const [modalOpen, setModalOpen] = useState()
  const {
    gtcr,
    tcrError,
    gtcrView,
    connectedTCRAddr,
    metadataByTime
  } = useContext(LightTCRViewContext)
  const getLogs = useGetLogs(library)

  // subgraph item entities have id "<itemID>@<listaddress>"
  const compoundId = `${itemID}@${tcrAddress.toLowerCase()}`
  const detailsViewQuery = useQuery(LIGHT_ITEM_DETAILS_QUERY, {
    variables: { id: compoundId }
  })

  // Warning: This function should only be called when all its dependencies
  // are set.
  const fetchItem = useCallback(async () => {
    if (!detailsViewQuery.loading)
      try {
        const itemFromContract = await gtcrView.getItem(tcrAddress, itemID)
        const { data: itemURI, requests } = detailsViewQuery.data.litem
        const itemData = await (
          await fetch(`${process.env.REACT_APP_IPFS_GATEWAY}${itemURI}`)
        ).json()

        const orderDecodedData = (columns, values) => {
          const labels = columns.map(column => column.label)
          const ordered = []
          for (const label of labels) {
            const value = values[label]
            ordered.push(value)
          }
          return ordered
        }

        const result = {
          ...itemFromContract, // Spread to convert from array to object.
          data: itemURI,
          columns: itemData.columns,
          decodedData: orderDecodedData(itemData.columns, itemData.values),
          requestsFromSubgraph: requests
        }

        setItem(result)
        setDecodedItem({
          ...result,
          errors: []
        })
      } catch (err) {
        console.error(err)
        setError('Error fetching item')
      }
  }, [gtcrView, itemID, tcrAddress, detailsViewQuery])

  // TODO: Fetch this directly from the subgraph.
  // Get requests data
  useEffect(() => {
    ;(async () => {
      try {
        if (!gtcr || !gtcrView || !tcrAddress || !itemID || !item) return
        const [requestStructs] = await Promise.all([
          gtcrView.getItemRequests(tcrAddress, itemID)
        ])

        const { requestsFromSubgraph: requests } = item

        setRequests(
          requestStructs.map((request, i) => ({
            ...request,
            requestType: SUBGRAPH_STATUS_TO_CODE[requests[i].requestType],
            evidenceGroupID: requests[i].evidenceGroupID,
            creationTx: requests[i].creationTx,
            resolutionTx: requests[i].resolutionTx,
            resolutionTime: requests[i].resolutionTime,
            submissionTime: requests[i].submissionTime
          }))
        )
      } catch (err) {
        console.error('Error fetching item requests', err)
      }
    })()
  }, [gtcr, gtcrView, item, itemID, library, tcrAddress])

  // Set the meta evidence.
  useEffect(() => {
    if (!item || !metadataByTime) return
    const { byTimestamp } = metadataByTime
    const file =
      byTimestamp[takeLower(Object.keys(byTimestamp), item.submissionTime)]
    if (!file) return

    setMetaEvidence(file)
  }, [item, metaEvidence, metadataByTime, tcrAddress])

  // Fetch item.
  // This runs when the user loads the details view for the of an item
  // or when he navigates from the details view of an item to
  // the details view of another item (i.e. when itemID changes).
  useEffect(() => {
    if (!gtcrView || !itemID || !library || !tcrAddress) return
    fetchItem()
  }, [gtcrView, fetchItem, itemID, library, tcrAddress])

  // Watch for events to and refetch.
  useEffect(() => {
    if (!gtcr || eventListenerSet || !item || !arbitrator) return
    setEventListenerSet(true)
    gtcr.on(gtcr.filters.ItemStatusChange(itemID), fetchItem)
    gtcr.on(gtcr.filters.Dispute(arbitrator.address), fetchItem)
    gtcr.on(gtcr.filters.Contribution(itemID), fetchItem)
    gtcr.on(gtcr.filters.Evidence(), fetchItem)
    arbitrator.on(
      arbitrator.filters.AppealPossible(item.disputeID, gtcr.address),
      fetchItem
    )
    arbitrator.on(
      arbitrator.filters.AppealDecision(item.disputeID, gtcr.address),
      fetchItem
    )
    refAttr.current = { gtcr, arbitrator }
  }, [
    arbitrator,
    eventListenerSet,
    fetchItem,
    gtcr,
    item,
    itemID,
    metaEvidence
  ])

  // Teardown listeners.
  useEffect(
    () => () => {
      if (!refAttr || !refAttr.current || !eventListenerSet) return
      const {
        current: { gtcr, arbitrator }
      } = refAttr
      gtcr.removeAllListeners(gtcr.filters.ItemStatusChange())
      gtcr.removeAllListeners(gtcr.filters.Dispute())
      gtcr.removeAllListeners(gtcr.filters.Contribution())
      gtcr.removeAllListeners(gtcr.filters.Evidence())
      arbitrator.removeAllListeners(arbitrator.filters.AppealPossible())
      arbitrator.removeAllListeners(arbitrator.filters.AppealDecision())
    },
    [eventListenerSet]
  )

  const { metadata } = metaEvidence || {}
  const { decodedData } = decodedItem || {}

  // If this is a TCR in a TCR of TCRs, we fetch its metadata as well
  // to build a better item details card.
  useEffect(() => {
    ;(async () => {
      const { isTCRofTCRs } = metadata || {}
      if (!isTCRofTCRs) return
      if (!decodedItem) return
      if (!getLogs) return
      const itemAddress = decodedItem.decodedData[0] // There is only one column, the TCR address.
      const itemTCR = new ethers.Contract(itemAddress, _gtcr, library)

      try {
        // Take the latest meta evidence.
        const logs = (
          await getLogs({
            ...itemTCR.filters.MetaEvidence(),
            fromBlock: 0
          })
        ).map(log => itemTCR.interface.parseLog(log))
        if (logs.length === 0) throw new Error('No meta evidence available.')

        const { _evidence: metaEvidencePath } = logs[logs.length - 1].values
        const file = await (
          await fetch(process.env.REACT_APP_IPFS_GATEWAY + metaEvidencePath)
        ).json()

        setItemMetaEvidence({ file })
      } catch (err) {
        console.error('Error fetching meta evidence', err)
        setItemMetaEvidence({ error: err })
      }
    })()
  }, [decodedItem, library, metadata, getLogs])

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

  if (!tcrAddress || !itemID || error || tcrError)
    return (
      <ErrorPage
        code="400"
        message={error || tcrError || 'This item could not be found.'}
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
          item={decodedItem || item}
          timestamp={timestamp}
          request={requests && { ...requests[0] }}
          modalOpen={modalOpen}
          setModalOpen={setModalOpen}
          dark
        />
        <div style={{ marginBottom: '40px' }} />
        <ItemDetailsCard
          columns={columns}
          item={decodedItem}
          title={`${
            itemName ? capitalizeFirstLetter(itemName) : 'Item'
          } Details`}
          loading={loading}
          itemMetaEvidence={itemMetaEvidence}
        />
        {/* Crowdfunding card is only rendered if the item has an appealable dispute. */}
        {/* V2 arbitrator handles appeals internally, so appeal logic is removed. */}
        <CrowdfundingCard
          item={decodedItem || item}
          timestamp={timestamp}
          request={requests[requests.length - 1]}
        />
        {/* Spread the `requests` parameter to convert elements from array to an object */}
        <RequestTimelines
          item={item}
          requests={requests && requests.map(r => ({ ...r }))}
        />
        {connectedTCRAddr !== ZERO_ADDRESS &&
          metadata &&
          !isConnectedTCR &&
          !relTcrDisabled && (
            <Badges
              connectedTCRAddr={connectedTCRAddr}
              item={decodedItem}
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

ItemDetails.propTypes = {
  itemID: PropTypes.string.isRequired,
  search: PropTypes.string
}

ItemDetails.defaultProps = {
  search: ''
}

export default ItemDetails
