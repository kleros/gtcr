import React, { useState, useEffect, useContext, useMemo } from 'react'
import { Breadcrumb } from 'components/ui'
import { useParams } from 'react-router-dom'
import { useEthersProvider } from 'hooks/ethers-adapters'
import { gtcrDecode } from '@kleros/gtcr-encoder'
import { abi as _IArbitrator } from '@kleros/erc-792/build/contracts/IArbitrator.json'
import ErrorPage from '../error-page'
import ItemDetailsCard from 'components/item-details-card'
import ItemStatusCard from './item-status-card'
import CrowdfundingCard from './crowdfunding-card'
import { TCRViewContext } from 'contexts/tcr-view-context'
import RequestTimelines from '../../components/request-timelines'
import { WalletContext } from 'contexts/wallet-context'
import { capitalizeFirstLetter, ZERO_ADDRESS } from 'utils/string'
import Badges from './badges'
import { parseIpfs } from 'utils/ipfs-parse'
import { fetchMetaEvidence } from 'hooks/tcr-view'
import { CLASSIC_ITEM_DETAILS_QUERY } from 'utils/graphql'
import { useQuery } from '@tanstack/react-query'
import { getGraphQLClient } from 'utils/graphql-client'
import { ethers } from 'ethers'
import {
  Divider,
  StyledBanner,
  StyledBreadcrumbItem,
  StyledLink,
  StyledMargin,
  StyledBackLink,
  StyledLayoutContent,
} from 'pages/light-item-details'

interface ItemDetailsProps {
  itemID: string
  search?: string
}

const ItemDetails = ({ itemID, search }: ItemDetailsProps) => {
  const { tcrAddress, chainId } = useParams()
  const library = useEthersProvider({
    chainId: chainId ? Number(chainId) : undefined,
  })
  const [itemMetaEvidence, setItemMetaEvidence] = useState<
    MetaEvidence | undefined
  >()
  const { timestamp } = useContext(WalletContext)
  const [decodedItem, setDecodedItem] = useState<unknown[] | undefined>()
  const [metaEvidence, setMetaEvidence] = useState<MetaEvidence | undefined>()
  const [modalOpen, setModalOpen] = useState<boolean | undefined>()
  const { tcrError, connectedTCRAddr } = useContext(TCRViewContext)
  const [appealCost, setAppealCost] = useState<BigNumber | undefined>()

  // subgraph item entities have id "<itemID>@<listaddress>"
  const compoundId = `${itemID}@${tcrAddress.toLowerCase()}`
  const client = useMemo(() => getGraphQLClient(chainId), [chainId])
  const detailsViewQuery = useQuery({
    queryKey: ['classicItemDetails', compoundId],
    queryFn: () =>
      client.request(CLASSIC_ITEM_DETAILS_QUERY, { id: compoundId }),
    enabled: !!client,
  })

  const item = useMemo(
    () =>
      detailsViewQuery.isLoading ? undefined : detailsViewQuery.data?.item,
    [detailsViewQuery.isLoading, detailsViewQuery.data],
  )

  // Decode item bytes once we have it and the meta evidence files.
  useEffect(() => {
    ;(async () => {
      if (!item || decodedItem) return

      const path = await fetchMetaEvidence(tcrAddress, chainId)
      const file = await (await fetch(parseIpfs(path.metaEvidenceURI))).json()

      setMetaEvidence(file)
      const { metadata } = file || {}

      const { columns } = metadata

      const errors = []
      let decodedData
      try {
        decodedData = gtcrDecode({
          columns,
          values: item.data,
        })
      } catch {
        errors.push(`Error decoding ${item.itemID} of TCR at ${tcrAddress}`)
      }

      setDecodedItem({
        ...item,
        decodedData,
        errors,
      })
    })()
  }, [item, metaEvidence, tcrAddress, chainId, decodedItem])

  const { metadata } = metaEvidence || {}
  const { decodedData } = decodedItem || {}

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

  if (
    !tcrAddress ||
    !itemID ||
    tcrError ||
    (!detailsViewQuery.isLoading && !detailsViewQuery.data)
  )
    return (
      <ErrorPage
        code="400"
        message={tcrError || 'This item could not be found.'}
        tip="Make sure your wallet is set to the correct network (is this on Gnosis Chain?)."
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
      </StyledMargin>
      <StyledLayoutContent>
        <ItemStatusCard
          item={decodedItem}
          timestamp={timestamp}
          request={decodedItem?.requests[0] && { ...decodedItem.requests[0] }}
          modalOpen={modalOpen}
          setModalOpen={setModalOpen}
          appealCost={appealCost}
          dark
        />
        <Divider />
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
        <CrowdfundingCard
          item={decodedItem || item}
          timestamp={timestamp}
          appealCost={appealCost}
        />

        {/* Spread the `requests` parameter to convert elements from array to an object */}
        <RequestTimelines
          item={item}
          requests={item && item.requests.map((r) => ({ ...r }))}
          kind="classic"
          metaEvidence={metaEvidence}
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
    </>
  )
}

export default ItemDetails
