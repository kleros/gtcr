import { Layout, Breadcrumb } from 'antd'
import React, {
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
  useMemo
} from 'react'
import PropTypes from 'prop-types'
import ErrorPage from '../error-page'
import styled from 'styled-components/macro'
import { useWeb3Context } from 'web3-react'
import { abi as _arbitrator } from '@kleros/tcr/build/contracts/IArbitrator.json'
import { ethers } from 'ethers'
import ItemDetailsCard from '../../components/item-details-card'
import ItemStatusCard from './item-status-card'
import CrowdfundingCard from './crowdfunding-card'
import { TCRViewContext } from '../../bootstrap/tcr-view-context'
import { gtcrDecode } from '../../utils/encoder'
import RequestTimelines from './request-timelines'
import { WalletContext } from '../../bootstrap/wallet-context'
import SearchBar from '../../components/search-bar'
import { capitalizeFirstLetter, ZERO_ADDRESS } from '../../utils/string'
import Badges from './badges'
import WarningBanner from '../../components/beta-warning'

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

// TODO: Ensure we don't set state for unmounted components using
// flags and AbortController.
//
// Reference:
// https://itnext.io/how-to-create-react-custom-hooks-for-data-fetching-with-useeffect-74c5dc47000a
// TODO: Ensure http requests are being sent in parallel.
const ItemDetails = ({ itemID }) => {
  const { library } = useWeb3Context()
  const [error, setError] = useState()
  const { timestamp } = useContext(WalletContext)
  const [decodedItem, setDecodedItem] = useState()
  const [item, setItem] = useState()
  const [requests, setRequests] = useState()
  const arbitrator = useMemo(() => {
    if (!item || !library) return
    return new ethers.Contract(item.arbitrator, _arbitrator, library)
  }, [item, library])
  const refAttr = useRef()
  const [eventListenerSet, setEventListenerSet] = useState()
  const {
    gtcr,
    tcrError,
    gtcrView,
    metaEvidence,
    tcrAddress,
    connectedTCRAddr
  } = useContext(TCRViewContext)

  // Warning: This function should only be called when all its dependencies
  // are set.
  const fetchItem = useCallback(async () => {
    try {
      const result = {
        ...(await gtcrView.getItem(tcrAddress, itemID))
      } // Spread to convert from array to object.
      setItem(result)
    } catch (err) {
      console.error(err)
      setError('Error fetching item')
    }
  }, [gtcrView, itemID, tcrAddress])

  // Get requests data
  useEffect(() => {
    ;(async () => {
      try {
        if (!gtcr || !gtcrView || !tcrAddress || !itemID) return
        const [requestStructs, rawRequestLogs] = await Promise.all([
          gtcrView.getItemRequests(tcrAddress, itemID),
          library.getLogs({
            ...gtcr.filters.RequestSubmitted(itemID),
            fromBlock: 0
          })
        ])

        const requestLogs = rawRequestLogs
          .map(log => gtcr.interface.parseLog(log))
          .map(log => log.values)

        setRequests(
          requestStructs.map((request, i) => ({
            ...request,
            requestType: requestLogs[i]._requestType
          }))
        )
      } catch (err) {
        console.error('Error fetching item requests', err)
      }
    })()
  }, [gtcr, gtcrView, itemID, library, tcrAddress])

  // Decode item bytes once we have it and the meta evidence.
  useEffect(() => {
    if (!item || !metaEvidence || metaEvidence.address !== tcrAddress) return

    const { columns } = metaEvidence.metadata
    const errors = []
    let decodedData
    try {
      decodedData = gtcrDecode({ columns, values: item.data })
    } catch (err) {
      errors.push(`Error decoding ${item.ID} of TCR at ${tcrAddress}`)
      console.warn(
        `Error decoding ${item.ID} of TCR at ${tcrAddress} in details view`,
        err
      )
    }

    setDecodedItem({
      ...item,
      decodedData,
      errors
    })
  }, [item, metaEvidence, tcrAddress])

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
    gtcr.on(gtcr.filters.AppealContribution(itemID), fetchItem)
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
      gtcr.removeAllListeners(gtcr.filters.AppealContribution())
      gtcr.removeAllListeners(gtcr.filters.Evidence())
      arbitrator.removeAllListeners(arbitrator.filters.AppealPossible())
      arbitrator.removeAllListeners(arbitrator.filters.AppealDecision())
    },
    [eventListenerSet]
  )

  if (!tcrAddress || !itemID || error || tcrError)
    return (
      <ErrorPage
        code="400"
        message={error || tcrError || 'This item could not be found.'}
        tip="Is your wallet set to the correct network?"
      />
    )

  const { metadata } = metaEvidence || {}
  const { tcrTitle, itemName, columns } = metadata || {}

  return (
    <>
      <WarningBanner />
      <StyledBanner>
        <Breadcrumb separator=">">
          <Breadcrumb.Item href={`/tcr/${tcrAddress}`}>
            {tcrTitle}
          </Breadcrumb.Item>
          <Breadcrumb.Item>
            {itemName && capitalizeFirstLetter(itemName)} Details
          </Breadcrumb.Item>
        </Breadcrumb>
      </StyledBanner>
      <SearchBar />
      <StyledLayoutContent>
        <ItemStatusCard
          item={decodedItem || item}
          timestamp={timestamp}
          request={requests && { ...requests[0] }}
          dark
        />
        <div style={{ marginBottom: '40px' }} />
        {/* Crowdfunding card is only rendered if the item has an appealable dispute. */}
        <CrowdfundingCard item={decodedItem || item} timestamp={timestamp} />
        <ItemDetailsCard
          title={`${
            itemName ? capitalizeFirstLetter(itemName) : 'Item'
          } Details`}
          columns={columns}
          loading={
            !metadata ||
            !decodedItem ||
            (!decodedItem.decodedData && decodedItem.errors.length === 0)
          }
          item={decodedItem}
        />

        {/* Spread the `requests` parameter to convert elements from array to an object */}
        <RequestTimelines
          item={item}
          requests={requests && requests.map(r => ({ ...r }))}
        />
        {connectedTCRAddr !== ZERO_ADDRESS &&
          metaEvidence &&
          !metaEvidence.metadata.isConnectedTCR && (
            <Badges
              connectedTCRAddr={connectedTCRAddr}
              item={decodedItem}
              tcrAddress={tcrAddress}
            />
          )}
      </StyledLayoutContent>
    </>
  )
}

ItemDetails.propTypes = {
  itemID: PropTypes.string.isRequired
}

export default ItemDetails
