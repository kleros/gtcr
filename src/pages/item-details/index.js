import { Layout, Divider } from 'antd'
import React, {
  useState,
  useEffect,
  useContext,
  useCallback,
  useMemo
} from 'react'
import PropTypes from 'prop-types'
import ErrorPage from '../error-page'
import styled from 'styled-components/macro'
import ItemDetailsCard from '../../components/item-details-card'
import ItemStatusCard from './item-status-card'
import { useWeb3Context } from 'web3-react'
import { TCRViewContext } from '../../bootstrap/tcr-view-context'
import { bigNumberify } from 'ethers/utils'
import { gtcrDecode } from '../../utils/encoder'
import { abi as _arbitrator } from '@kleros/tcr/build/contracts/Arbitrator.json'
import { ethers } from 'ethers'

const StyledLayoutContent = styled(Layout.Content)`
  background: white;
  padding: 42px 9.375vw 42px;
  display: flex;
  flex-direction: column;
`

const ItemDetails = ({ itemID, tcrAddress }) => {
  const { library } = useWeb3Context()
  const [errored, setErrored] = useState()
  const {
    metaEvidence,
    gtcr,
    tcrErrored,
    challengePeriodDuration,
    gtcrView
  } = useContext(TCRViewContext)
  const [item, setItem] = useState()
  const [timestamp, setTimestamp] = useState()
  const arbitrator = useMemo(() => {
    if (!item || !library) return
    return new ethers.Contract(item.arbitrator, _arbitrator, library)
  }, [item, library])

  // Warning: This function should only be called when all its dependencies
  // are set.
  const fetchItem = useCallback(async () => {
    const { columns } = metaEvidence
    try {
      const result = {
        ...(await gtcrView.getItem(tcrAddress, itemID))
      } // Spread to convert from array to object.
      result.decodedData = gtcrDecode({ columns, values: result.data })
      setItem(result)
    } catch (err) {
      console.error(err)
      setErrored(true)
    }
  }, [gtcrView, itemID, metaEvidence, tcrAddress])

  // Fetch item and timestamp.
  // This runs when the user loads the details view for the of an item
  // or when he navigates from the details view of an item to
  // the details view of another item (i.e. when itemID changes).
  useEffect(() => {
    if (!metaEvidence || !gtcrView || !itemID || !library || !tcrAddress) return
    fetchItem()
    try {
      ;(async () => {
        setTimestamp(bigNumberify((await library.getBlock()).timestamp))
      })()
    } catch (err) {
      console.error(err)
      setErrored(true)
    }
  }, [gtcrView, fetchItem, itemID, library, metaEvidence, tcrAddress])

  // Setup and teardown event listeners when item and/or arbitrator change.
  // This also runs when the user loads the details view for the of an item
  // or when he navigates from the details view of an item to
  // the details view of another item (i.e. when itemID changes).
  useEffect(() => {
    if (!item || !arbitrator || !gtcr) return

    // We must remove the listeners of the previous item (if any)
    // to prevent it triggering unwanted reloads.
    gtcr.removeAllListeners(gtcr.filters.ItemStatusChange())
    arbitrator.removeAllListeners(arbitrator.filters.AppealPossible())
    arbitrator.removeAllListeners(arbitrator.filters.AppealDecision())

    // Refetch item if the item status changes, or if the arbitrator
    // gives a ruling.
    gtcr.on(gtcr.filters.ItemStatusChange(itemID), fetchItem)
    arbitrator.on(
      arbitrator.filters.AppealPossible(item.disputeID, gtcr.address),
      fetchItem
    )
    arbitrator.on(
      arbitrator.filters.AppealDecision(item.disputeID, gtcr.address),
      fetchItem
    )

    // Teardown listeners when the component unmounts.
    return () => {
      gtcr.removeAllListeners(gtcr.filters.ItemStatusChange())
      arbitrator.removeAllListeners(arbitrator.filters.AppealPossible())
      arbitrator.removeAllListeners(arbitrator.filters.AppealDecision())
    }
  }, [arbitrator, fetchItem, gtcr, item, itemID])

  if (!tcrAddress || !itemID || errored || tcrErrored)
    return (
      <ErrorPage
        code="400"
        message="This item could not be found."
        tip="Is your wallet set to the correct network?"
      />
    )

  return (
    <StyledLayoutContent>
      <ItemStatusCard item={item} timestamp={timestamp} />
      <Divider />
      <ItemDetailsCard
        columns={metaEvidence && metaEvidence.columns}
        loading={!metaEvidence || !item || !item.decodedData}
        item={item}
        timestamp={timestamp}
        challengePeriodDuration={challengePeriodDuration}
      />
    </StyledLayoutContent>
  )
}

ItemDetails.propTypes = {
  tcrAddress: PropTypes.string.isRequired,
  itemID: PropTypes.string.isRequired
}

export default ItemDetails
