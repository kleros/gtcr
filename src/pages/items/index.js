/* eslint-disable no-unused-vars */
// Rule disabled temporarly as filters will be added back.
import { Layout, Spin, Pagination, Tag, Select, Switch } from 'antd'
import { Link } from 'react-router-dom'
import React, {
  useEffect,
  useState,
  useContext,
  useMemo,
  useRef,
  useCallback
} from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components/macro'
import localforage from 'localforage'
import { useWeb3Context } from 'web3-react'
import qs from 'qs'
import ErrorPage from '../error-page'
import { WalletContext } from '../../bootstrap/wallet-context'
import { ZERO_ADDRESS } from '../../utils/string'
import { TCRViewContext } from '../../bootstrap/tcr-view-context'
import { bigNumberify } from 'ethers/utils'
import { gtcrDecode } from '@kleros/gtcr-encoder'
import SubmitModal from '../item-details/modals/submit'
import useNetworkEnvVariable from '../../hooks/network-env'
import SubmitConnectModal from '../item-details/modals/submit-connect'
import SearchBar from '../../components/search-bar'
import {
  searchStrToFilterObj,
  filterLabel,
  FILTER_KEYS,
  updateFilter,
  queryOptionsToFilterArray,
  applyOldActiveItemsFilter
} from '../../utils/filters'
import ItemCard from './item-card'
import Banner from './banner'
import AppTour from '../../components/tour'
import itemsTourSteps from './tour-steps'
import takeLower from '../../utils/lower-limit'
import { DISPUTE_STATUS } from '../../utils/item-status'

const NSFW_FILTER_KEY = 'NSFW_FILTER_KEY'
const ITEMS_TOUR_DISMISSED = 'ITEMS_TOUR_DISMISSED'

const StyledContent = styled(Layout.Content)`
  word-break: break-word;
`

const StyledLayoutContent = styled.div`
  padding: 0 9.375vw 42px;
  display: flex;
  flex-direction: column;
`

const StyledFilters = styled.div`
  display: flex;
  justify-content: space-between;
  @media (max-width: 479px) {
    flex-direction: column;
  }
`

const StyledSelect = styled(Select)`
  height: 32px;
`

const StyledTag = styled(Tag.CheckableTag)`
  margin-bottom: 12px;

  &.ant-tag-checkable-checked {
    background-color: #6826bf;
    cursor: pointer;
  }
`

const StyledPagination = styled(Pagination)`
  justify-content: flex-end;
  display: flex;
  flex-wrap: wrap;
  margin-top: 2em;
`

const StyledGrid = styled.div`
  display: grid;
  margin: 24px 0;
  grid-gap: 20px;
  grid-template-columns: repeat(auto-fill, minmax(225px, 1fr));
`

const StyledSwitch = styled(Switch)`
  margin-right: 8px;

  &.ant-switch-checked {
    background-color: #6826bf;
  }
`

const StyledMargin = styled.div`
  padding: 24px 9.375vw;
`

const pagingItem = (_, type, originalElement) => {
  if (type === 'prev') return <span>Previous</span>
  if (type === 'next') return <span>Next</span>
  return originalElement
}

const xDaiInfo = {
  name: 'xDAI Chain',
  chainId: 100,
  shortName: 'xdai',
  chain: 'XDAI',
  network: 'mainnet',
  networkId: 100,
  nativeCurrency: { name: 'xDAI', symbol: 'xDAI', decimals: 18 },
  rpc: [
    'https://rpc.xdaichain.com',
    'https://xdai.poanetwork.dev',
    'wss://rpc.xdaichain.com/wss',
    'wss://xdai.poanetwork.dev/wss',
    'http://xdai.poanetwork.dev',
    'https://dai.poa.network',
    'ws://xdai.poanetwork.dev:8546'
  ],
  faucets: [],
  explorers: [
    {
      name: 'blockscout',
      url: 'https://blockscout.com/xdai/',
      standard: 'EIP3091'
    }
  ],
  infoURL: 'https://forum.poa.network/c/xdai-chain'
}

const supportedNetworkURLs = JSON.parse(process.env.REACT_APP_RPC_URLS)
const mainnetInfo = {
  name: 'Ethereum Mainnet',
  chainId: 1,
  shortName: 'eth',
  chain: 'ETH',
  network: 'mainnet',
  networkId: 1,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpc: [supportedNetworkURLs[1]],
  faucets: [],
  explorers: [
    {
      name: 'etherscan',
      url: 'https://etherscan.io',
      standard: 'EIP3091'
    }
  ],
  infoURL: 'https://ethereum.org'
}

// TODO: Ensure we don't set state for unmounted components using
// flags and AbortController.
//
// Reference:
// https://itnext.io/how-to-create-react-custom-hooks-for-data-fetching-with-useeffect-74c5dc47000a
const ITEMS_PER_PAGE = 40
const Items = ({ search, history }) => {
  const { requestWeb3Auth, timestamp } = useContext(WalletContext)
  const { library, active, account, networkId } = useWeb3Context()
  const [network, setNetwork] = useState()
  const {
    gtcr,
    metaEvidence,
    challengePeriodDuration,
    tcrError,
    gtcrView,
    tcrAddress,
    latestBlock,
    connectedTCRAddr,
    submissionDeposit,
    metadataByTime
  } = useContext(TCRViewContext)
  const [submissionFormOpen, setSubmissionFormOpen] = useState()
  const [oldActiveItems, setOldActiveItems] = useState({ data: [] })
  const [error, setError] = useState()
  const [fetchItems, setFetchItems] = useState({
    fetchStarted: false,
    isFetching: false,
    data: null
  })
  const [fetchItemCount, setFetchItemCount] = useState({
    fetchStarted: false,
    isFetching: false,
    data: null
  })
  const refAttr = useRef()
  const GTCR_SUBGRAPH_URL = useNetworkEnvVariable(
    'REACT_APP_SUBGRAPH_URL',
    networkId
  )
  const [eventListenerSet, setEventListenerSet] = useState()
  const queryOptions = searchStrToFilterObj(search)
  const [nsfwFilterOn, setNSFWFilter] = useState(true)
  const [queryItemParams, setQueryItemParams] = useState()
  const toggleNSFWFilter = useCallback(checked => {
    setNSFWFilter(checked)
    localforage.setItem(NSFW_FILTER_KEY, checked)
  }, [])

  const switchToSuggested = useCallback(async () => {
    if (!library || !active || !network) return
    if (network.chainId === 100)
      library.send('wallet_switchEthereumChain', [
        {
          chainId: `0x${mainnetInfo.chainId.toString(16)}`
        }
      ])
    else
      library.send('wallet_addEthereumChain', [
        {
          chainId: `0x${xDaiInfo.chainId.toString(16)}`,
          nativeCurrency: xDaiInfo.nativeCurrency,
          chainName: xDaiInfo.name,
          rpcUrls: xDaiInfo.rpc,
          blockExplorerUrls: xDaiInfo.explorers.url
        }
      ])
  }, [active, library, network])

  useEffect(() => {
    ;(async () => {
      if (!library || !active) return
      setNetwork(await library.getNetwork())
    })()
  }, [active, library])

  // Load NSFW user setting from localforage.
  useEffect(() => {
    ;(async () => {
      const savedSetting = await localforage.getItem(NSFW_FILTER_KEY)
      if (typeof savedSetting === 'boolean') setNSFWFilter(savedSetting)
    })()
  }, [])

  // Fetch number of pages for the current filter
  useEffect(() => {
    if (!gtcrView || fetchItemCount.isFetching || !fetchItemCount.fetchStarted)
      return

    if (gtcr.address !== tcrAddress) return

    const filter = queryOptionsToFilterArray(queryOptions)
    setFetchItemCount({ isFetching: true })
    ;(async () => {
      try {
        const itemCount = (await gtcr.itemCount()).toNumber()
        const itemsPerRequest = 100
        const requests = Math.ceil(itemCount / itemsPerRequest)
        let request = 1
        let target = [bigNumberify(0), itemCount > 0, bigNumberify(0)]
        let count = 0
        while (request <= requests && target[1]) {
          target = await gtcrView.countWithFilter(
            tcrAddress,
            target[2].toNumber(),
            itemsPerRequest,
            filter,
            active && account ? account : ZERO_ADDRESS
          )
          count += target[0].toNumber()
          request++
        }
        setFetchItemCount({
          fetchStarted: false,
          isFetching: false,
          data: count
        })
      } catch (err) {
        console.error('Error fetching number of pages', err)
        setError('Error fetching number of pages')
      }
    })()
  }, [
    fetchItemCount.isFetching,
    fetchItemCount.fetchStarted,
    gtcr,
    gtcrView,
    tcrAddress,
    search,
    queryOptions,
    active,
    account
  ])

  // Trigger fetch when gtcr instance is set.
  useEffect(() => {
    if (!gtcr) return
    setFetchItems({ fetchStarted: true })
    setFetchItemCount({ fetchStarted: true })
  }, [gtcr])

  // Fetch items.
  useEffect(() => {
    if (
      !gtcr ||
      !gtcrView ||
      fetchItems.isFetching ||
      !fetchItems.fetchStarted ||
      !GTCR_SUBGRAPH_URL
    )
      return

    setFetchItems({ isFetching: true })
    let encodedItems
    ;(async () => {
      try {
        const { page, oldestFirst } = queryOptions
        const orderDirection = oldestFirst ? 'asc' : 'desc'
        const { data } = await (
          await fetch(GTCR_SUBGRAPH_URL, {
            method: 'POST',
            body: JSON.stringify({
              query: `
              {
                registry(id: "${gtcr.address.toLowerCase()}") {
                  items(
                    first: 1000, 
                    orderBy: latestRequestSubmissionTime,
                    orderDirection: ${orderDirection}
                  ) {
                    itemID
                    status
                    data
                    requests (first: 1, orderBy: submissionTime, orderDirection: desc) {
                      disputed
                      disputeID
                      submissionTime
                      resolved
                      rounds (first: 1, orderBy: creationTime , orderDirection: desc) {
                        appealPeriodStart
                        appealPeriodEnd
                        ruling
                        hasPaidRequester
                        hasPaidChallenger
                      }
                    }
                  }
                }
              }
            `
            })
          })
        ).json()

        const { registry } = data ?? {}
        let { items } = registry ?? {}

        items = items.map(({ itemID, status: statusName, requests, data }) => {
          const { disputed, disputeID, submissionTime, rounds, resolved } =
            requests[0] ?? {}

          const {
            appealPeriodStart,
            appealPeriodEnd,
            ruling,
            hasPaidRequester,
            hasPaidChallenger
          } = rounds[0] ?? {}

          const currentRuling =
            ruling === 'None' ? 0 : ruling === 'Accept' ? 1 : 2
          const disputeStatus = !disputed
            ? DISPUTE_STATUS.WAITING
            : resolved
            ? DISPUTE_STATUS.SOLVED
            : Number(appealPeriodEnd) > Date.now() / 1000
            ? DISPUTE_STATUS.APPEALABLE
            : DISPUTE_STATUS.WAITING

          const statusNameToCode = {
            Absent: 0,
            Registered: 1,
            RegistrationRequested: 2,
            RemovalRequested: 3
          }

          return {
            ID: itemID,
            itemID,
            status: statusNameToCode[statusName],
            disputeStatus,
            disputed,
            data,
            disputeID,
            submissionTime: bigNumberify(submissionTime),
            hasPaid: [false, hasPaidRequester, hasPaidChallenger],
            currentRuling,
            appealStart: bigNumberify(appealPeriodStart),
            appealEnd: bigNumberify(appealPeriodEnd)
          }
        })

        const skip = ITEMS_PER_PAGE * (Number(page ?? 1) - 1)
        encodedItems = items.slice(skip, skip + ITEMS_PER_PAGE)
      } catch (err) {
        console.error('Error fetching items', err)
        setError('Error fetching items')
        setFetchItems({ isFetching: false, fetchStarted: false })
      } finally {
        setFetchItems({
          isFetching: false,
          fetchStarted: false,
          data: encodedItems,
          address: gtcr.address
        })
      }
    })()
  }, [
    gtcrView,
    fetchItems,
    gtcr,
    search,
    queryOptions,
    tcrAddress,
    active,
    account,
    GTCR_SUBGRAPH_URL
  ])

  // Since items are sorted by time of submission (either newest or oldest first)
  // we have to also watch for new requests related to items already on the list.
  // Otherwise a request to (for example) remove a very old item could pass its
  // challenge period without being scrutinized by other users.
  // To do this, we watch for `RequestSubmitted` events. If there are such requests and:
  // - We are sorting by newest first;
  // - We are on the first page;
  // unshift those items to the list.
  useEffect(() => {
    const { oldestFirst } = searchStrToFilterObj(search)
    if (
      !gtcr ||
      !gtcrView ||
      !latestBlock ||
      oldestFirst ||
      !fetchItems.data ||
      fetchItems.address !== tcrAddress ||
      !challengePeriodDuration ||
      !library ||
      (oldActiveItems && oldActiveItems.address === tcrAddress)
    )
      return
    ;(async () => {
      // Fetch request events within one challenge period duration.
      const BLOCK_TIME = 15 // Assuming a blocktime of 15 seconds.
      const logsFilter = {
        ...gtcr.filters.RequestSubmitted(),
        fromBlock:
          latestBlock -
          (challengePeriodDuration.div(bigNumberify(BLOCK_TIME)).toNumber() +
            100) // Add 100 block margin.
      }

      const requestSubmissionLogs = (await library.getLogs(logsFilter))
        .map(log => ({
          ...gtcr.interface.parseLog(log),
          blockNumber: log.blockNumber
        }))
        .sort((a, b) => b.blockNumber - a.blockNumber)
        .filter(
          log =>
            !fetchItems.data.map(item => item.ID).includes(log.values._itemID)
        ) // Remove items already fetched.

      // Fetch item details.
      setOldActiveItems({
        data: (
          await Promise.all(
            requestSubmissionLogs.map(log =>
              gtcrView.getItem(tcrAddress, log.values._itemID)
            )
          )
        )
          .filter(item => !item.resolved)
          .filter(item => applyOldActiveItemsFilter(queryOptions, item)),
        address: gtcr.address
      })
    })()
  }, [
    challengePeriodDuration,
    fetchItems.address,
    fetchItems.data,
    gtcr,
    gtcrView,
    latestBlock,
    library,
    oldActiveItems,
    queryOptions,
    search,
    tcrAddress
  ])

  const { oldestFirst, page } = queryOptions

  // Decode items once meta evidence and items were fetched.
  const items = useMemo(() => {
    if (
      !fetchItems.data ||
      !metaEvidence ||
      metaEvidence.address !== tcrAddress ||
      fetchItems.address !== tcrAddress ||
      (oldActiveItems.address && oldActiveItems.address !== tcrAddress) ||
      !metadataByTime
    )
      return

    const { data: encodedItems } = fetchItems

    // If on page 1, display also old items with new pending
    // requests, if any.
    const displayedItems =
      page && Number(page) > 1
        ? encodedItems
        : [...oldActiveItems.data, ...encodedItems]

    return displayedItems.map((item, i) => {
      let decodedItem
      const errors = []
      const { columns } = metadataByTime.byTimestamp[
        takeLower(Object.keys(metadataByTime.byTimestamp), item.timestamp)
      ].metadata
      try {
        decodedItem = gtcrDecode({ values: item.data, columns })
        // eslint-disable-next-line no-unused-vars
      } catch (err) {
        errors.push(`Error decoding item ${item.ID} of list at ${tcrAddress}`)
        console.warn(`Error decoding item ${item.ID} of list at ${tcrAddress}`)
      }

      // Return the item columns along with its TCR status data.
      return {
        tcrData: {
          ...item // Spread to convert from array to object.
        },
        columns: columns.map(
          (col, i) => ({
            value: decodedItem && decodedItem[i],
            ...col
          }),
          { key: i }
        ),
        errors
      }
    })
  }, [
    fetchItems,
    metaEvidence,
    metadataByTime,
    oldActiveItems.address,
    oldActiveItems.data,
    page,
    tcrAddress
  ])

  // Watch for submissions and status change events to refetch items.
  useEffect(() => {
    if (!gtcr || eventListenerSet) return
    setEventListenerSet(true)
    gtcr.on(gtcr.filters.ItemStatusChange(), () =>
      setFetchItems({ fetchStarted: true })
    )
    refAttr.current = gtcr
  }, [eventListenerSet, gtcr])

  // Teardown listeners.
  useEffect(
    () => () => {
      if (!refAttr || !refAttr.current || !eventListenerSet) return
      refAttr.current.removeAllListeners(
        refAttr.current.filters.ItemStatusChange()
      )
    },
    [eventListenerSet]
  )

  // Check if there an action in the URL.
  useEffect(() => {
    const params = qs.parse(search)
    if (!params['?action']) return

    const initialValues = []
    Object.keys(params)
      .filter(param => param !== '?action')
      .forEach(key => initialValues.push(params[key]))

    setQueryItemParams(initialValues)
    setSubmissionFormOpen(true)
  }, [requestWeb3Auth, search])

  if (!tcrAddress)
    return (
      <ErrorPage
        code="404"
        message="The gods are having trouble finding this list."
        tip="Make sure your wallet is set to the correct network."
      />
    )

  const SuggestionsLink = () => (
    <span>
      Is your wallet in the correct network? Perhaps this list is on{' '}
      <Link onClick={switchToSuggested}>
        {network && network.chainId === 100 ? 'Mainnet' : 'xDai'}
      </Link>{' '}
    </span>
  )

  if (tcrError || error)
    return (
      <ErrorPage
        code="400"
        message={tcrError || error || 'Decoding this item.'}
        tip={<SuggestionsLink />}
      />
    )

  const { metadata } = metaEvidence || {}
  const { isConnectedTCR } = metadata || {}

  return (
    <>
      <Banner
        metaEvidence={metaEvidence}
        requestWeb3Auth={requestWeb3Auth}
        setSubmissionFormOpen={setSubmissionFormOpen}
        connectedTCRAddr={connectedTCRAddr}
        tcrAddress={tcrAddress}
      />
      <StyledMargin>
        <SearchBar />
      </StyledMargin>
      <StyledLayoutContent>
        <StyledContent>
          <Spin
            spinning={
              fetchItems.isFetching || fetchItemCount.isFetching || !metadata
            }
          >
            <>
              <StyledGrid id="items-grid-view">
                {items &&
                  items
                    .sort(({ tcrData: tcrDataA }, { tcrData: tcrDataB }) => {
                      // Display items with pending requests first.
                      if (!tcrDataA || !tcrDataB) return 0 // Handle errored TCRs.
                      if (!tcrDataA.resolved && tcrDataB.resolved) return -1
                      if (tcrDataA.resolved && !tcrDataB.resolved) return 1
                      return 0
                    })
                    .map((item, i) => (
                      <ItemCard
                        item={item}
                        key={i}
                        metaEvidence={metaEvidence}
                        tcrAddress={tcrAddress}
                        challengePeriodDuration={challengePeriodDuration}
                        timestamp={timestamp}
                        forceReveal={!nsfwFilterOn}
                      />
                    ))}
              </StyledGrid>
              <StyledPagination
                total={fetchItemCount.data || 0}
                current={Number(queryOptions.page)}
                itemRender={pagingItem}
                pageSize={ITEMS_PER_PAGE}
                onChange={newPage => {
                  history.push({
                    search: /page=\d+/g.test(search)
                      ? search.replace(/page=\d+/g, `page=${newPage}`)
                      : `${search}page=${newPage}`
                  })
                  setFetchItems({ fetchStarted: true })
                  setFetchItemCount({ fetchStarted: true })
                }}
              />
            </>
          </Spin>
        </StyledContent>
        {metaEvidence && metadata && (
          <>
            {isConnectedTCR ? (
              <SubmitConnectModal
                visible={submissionFormOpen}
                onCancel={() => setSubmissionFormOpen(false)}
                tcrAddress={tcrAddress}
                gtcrView={gtcrView}
              />
            ) : (
              <SubmitModal
                visible={submissionFormOpen}
                onCancel={() => setSubmissionFormOpen(false)}
                submissionDeposit={submissionDeposit}
                challengePeriodDuration={challengePeriodDuration}
                tcrAddress={tcrAddress}
                metaEvidence={metaEvidence}
                initialValues={queryItemParams}
              />
            )}
          </>
        )}
      </StyledLayoutContent>
      <AppTour
        dismissedKey={ITEMS_TOUR_DISMISSED}
        steps={itemsTourSteps(metadata)}
      />
    </>
  )
}

Items.propTypes = {
  search: PropTypes.string.isRequired,
  history: PropTypes.shape({
    push: PropTypes.func.isRequired
  }).isRequired
}

export default Items
