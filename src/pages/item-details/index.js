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
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import ItemDetailsCard from 'components/item-details-card'
import ItemStatusCard from './item-status-card'
import CrowdfundingCard from './crowdfunding-card'
import { TCRViewContext } from 'contexts/tcr-view-context'
import { gtcrDecode } from '@kleros/gtcr-encoder'
import RequestTimelines from './request-timelines'
import { WalletContext } from 'contexts/wallet-context'
import SearchBar from 'components/search-bar'
import { capitalizeFirstLetter, ZERO_ADDRESS } from 'utils/string'
import Badges from './badges'
import AppTour from 'components/tour'
import itemTourSteps from './tour-steps'
import takeLower from 'utils/lower-limit'
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
  } = useContext(TCRViewContext)
  const getLogs = useGetLogs(library)

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
        if (!getLogs) return
        const [requestStructs, rawRequestLogs] = await Promise.all([
          gtcrView.getItemRequests(tcrAddress, itemID),
          getLogs({
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
  }, [gtcr, gtcrView, itemID, library, tcrAddress, getLogs])

  // Decode item bytes once we have it and the meta evidence files.
  useEffect(() => {
    if (!item || !metadataByTime) return
    const { byTimestamp } = metadataByTime
    const file =
      byTimestamp[takeLower(Object.keys(byTimestamp), item.submissionTime)]
    if (!file) return

    setMetaEvidence(file)

    const { address, metadata } = file || {}
    if (address !== tcrAddress) return

    const { columns } = metadata

    const errors = []
    let decodedData
    try {
      decodedData = gtcrDecode({
        columns,
        values: item.data
      })
    } catch (_) {
      errors.push(`Error decoding ${item.ID} of TCR at ${tcrAddress}`)
    }

    setDecodedItem({
      ...item,
      decodedData,
      errors
    })
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

  const { tcrTitle, itemName, columns } = metadata || {}
  const { isConnectedTCR, relTcrDisabled } = metadata || {}

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
          request={requests ? requests[requests.length - 1] : {}}
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
