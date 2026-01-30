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
import RequestTimelines from '../../components/permanent-request-timelines'
import { WalletContext } from 'contexts/wallet-context'
import { capitalizeFirstLetter } from 'utils/string'
import { PERMANENT_ITEM_DETAILS_QUERY } from 'utils/graphql'
import { useQuery } from '@apollo/client'
// import SearchBar from 'components/light-search-bar'
import { parseIpfs } from 'utils/ipfs-parse'
import { itemToStatusCode, STATUS_CODE } from 'utils/permanent-item-status'
import { truncateAtWord } from 'utils/truncate-at-word'
import { pgtcrApolloClientFactory } from 'pages/permanent-items'
import useArbitrationCost from 'hooks/arbitration-cost'

export const ITEM_TOUR_DISMISSED = 'ITEM_TOUR_DISMISSED'

export const StyledBreadcrumbItem = styled(Breadcrumb.Item)`
  text-transform: capitalize;
  color: ${({ theme }) => theme.itemDetailsTitleColor} !important;
`

export const StyledLayoutContent = styled(Layout.Content)`
  padding: 0 9.375vw 42px;
  display: flex;
  flex-direction: column;
  width: 100%;
`

export const StyledBanner = styled.div`
  padding: 24px 9.375vw;
  background: ${({ theme }) => theme.bannerGradient};
  box-shadow: 0px 3px 24px ${({ theme }) => theme.shadowColor};
  color: ${({ theme }) => theme.textPrimary};
  transition: background 0.3s ease, box-shadow 0.3s ease, color 0.3s ease;
`

export const StyledMargin = styled.div`
  padding: 24px 9.375vw;
  display: flex;
`

export const StyledLink = styled(Link)`
  text-decoration: underline;
  color: ${({ theme }) => theme.itemDetailsSubtitleColor};
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
  const [ipfsItemData, setIpfsItemData] = useState()
  const { timestamp } = useContext(WalletContext)
  const [modalOpen, setModalOpen] = useState()
  const pgtcrClient = useMemo(() => pgtcrApolloClientFactory(chainId), [
    chainId
  ])
  const [appealCost, setAppealCost] = useState()
  const [metaEvidence, setMetaEvidence] = useState()

  // subgraph item entities have id "<itemID>@<listaddress>"
  const compoundId = `${itemID}@${tcrAddress.toLowerCase()}`
  const query = useQuery(PERMANENT_ITEM_DETAILS_QUERY, {
    variables: { id: compoundId },
    client: pgtcrClient
  })

  const item = useMemo(() => (query.loading ? undefined : query.data?.item), [
    query
  ])

  const registry = useMemo(
    () => (query.loading ? undefined : query.data?.item?.registry),
    [query]
  )

  useEffect(() => {
    if (item && !ipfsItemData)
      fetch(parseIpfs(item.data))
        .then(r => r.json())
        .catch(_e => console.error('Could not get ipfs file'))
        .then(r => setIpfsItemData(r))
        .catch(_e => console.error('Could not set ipfs item data'))
  }, [item, ipfsItemData])

  const arbitrationCost = useArbitrationCost({
    address: registry?.arbitrator?.id,
    arbitratorExtraData:
      registry?.arbitrationSettings?.[0]?.arbitratorExtraData,
    library
  })

  useEffect(() => {
    if (!registry) return
    ;(async () => {
      const arbSetting = registry.arbitrationSettings[0]
      const response = await fetch(parseIpfs(arbSetting.metaEvidenceURI))
      const file = await response.json()
      setMetaEvidence(file) // btw we do this because thegraph doesnt have it... would be nice
    })()
  }, [registry])

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
    if (!item || !timestamp || !registry) return null
    return itemToStatusCode(item, timestamp, registry)
  }, [item, timestamp, registry])

  const getStatusPhrase = statusCode => {
    switch (statusCode) {
      case STATUS_CODE.ACCEPTED:
        return 'is verified to be safe'
      case STATUS_CODE.PENDING:
        return 'is pending verification'
      case STATUS_CODE.DISPUTED:
        return 'is under challenge'
      case STATUS_CODE.CROWDFUNDING:
      case STATUS_CODE.CROWDFUNDING_WINNER:
        return 'is crowdfunding appeal'
      case STATUS_CODE.PENDING_WITHDRAWAL:
        return 'awaits withdrawal'
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
    if (!item || !registry || appealCost !== undefined) return
    const challenge = item.challenges[0]
    // appeal cost might not be applicable
    if (!challenge || challenge.disputeOutcome) setAppealCost(null)
    else {
      const arbitrator = new ethers.Contract(
        registry?.arbitrator?.id,
        _IArbitrator,
        library
      )

      arbitrator
        .appealCost(
          challenge.disputeID,
          challenge.arbitrationSetting.arbitratorExtraData
        )
        .then(cost => setAppealCost(cost))
        .catch(err => {
          console.error(err)
          setAppealCost(null)
        })
    }
  }, [item, appealCost, library, registry])
  if (!tcrAddress || !itemID)
    return (
      <ErrorPage
        code="400"
        message={'This item could not be found.'}
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
        {/* <SearchBar /> */}
      </StyledMargin>
      <StyledLayoutContent>
        <ItemStatusCard
          item={decodedItem}
          registry={registry}
          timestamp={timestamp}
          modalOpen={modalOpen}
          metaEvidence={metaEvidence}
          setModalOpen={setModalOpen}
          appealCost={appealCost}
          arbitrationCost={arbitrationCost.arbitrationCost}
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
          itemMetaEvidence={null}
        />
        {/* Crowdfunding card is only rendered if the item has an appealable dispute. */}
        <CrowdfundingCard
          item={decodedItem}
          registry={registry}
          timestamp={timestamp}
          appealCost={appealCost}
        />

        <RequestTimelines item={item} metaEvidence={metaEvidence} />
      </StyledLayoutContent>
    </>
  )
}

export default ItemDetails
