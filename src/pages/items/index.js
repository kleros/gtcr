import {
  Typography,
  Layout,
  Skeleton,
  Button,
  Icon,
  Spin,
  Pagination,
  Tag,
  Select,
  Switch
} from 'antd'
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
import ErrorPage from '../error-page'
import { WalletContext } from '../../bootstrap/wallet-context'
import {
  ZERO_ADDRESS,
  ZERO_BYTES32,
  capitalizeFirstLetter
} from '../../utils/string'
import { TCRViewContext } from '../../bootstrap/tcr-view-context'
import { bigNumberify } from 'ethers/utils'
import { gtcrDecode } from '../../utils/encoder'
import SubmitModal from '../item-details/modals/submit'
import SubmitConnectModal from '../item-details/modals/submit-connect'
import SearchBar from '../../components/search-bar'
import { useWeb3Context } from 'web3-react'
import {
  searchStrToFilterObj,
  filterLabel,
  FILTER_KEYS,
  updateFilter,
  queryOptionsToFilterArray,
  applyOldActiveItemsFilter
} from '../../utils/filters'
import WarningBanner from '../../components/beta-warning'
import ItemCard from './item-card'

const NSFW_FILTER_KEY = 'NSFW_FILTER_KEY'

const StyledContent = styled(Layout.Content)`
  word-break: break-word;
`

const StyledLayoutContent = styled.div`
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

const StyledButton = styled(Button)`
  margin-top: 6px;
`

const StyledHeader = styled.div`
  display: flex;
  justify-content: space-between;
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
`

const pagingItem = (_, type, originalElement) => {
  if (type === 'prev') return <span>Previous</span>
  if (type === 'next') return <span>Next</span>
  return originalElement
}

// TODO: Ensure we don't set state for unmounted components using
// flags and AbortController.
//
// Reference:
// https://itnext.io/how-to-create-react-custom-hooks-for-data-fetching-with-useeffect-74c5dc47000a
const ITEMS_PER_PAGE = 40
const Items = ({ search, history }) => {
  const { requestWeb3Auth, timestamp } = useContext(WalletContext)
  const { library, active, account } = useWeb3Context()
  const {
    gtcr,
    metaEvidence,
    challengePeriodDuration,
    tcrError,
    gtcrView,
    tcrAddress,
    latestBlock,
    connectedTCRAddr,
    submissionDeposit
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
  const [eventListenerSet, setEventListenerSet] = useState()
  const queryOptions = searchStrToFilterObj(search)
  const [nsfwFilterOn, setNSFWFilter] = useState(true)
  const toggleNSFWFilter = useCallback(checked => {
    setNSFWFilter(checked)
    localforage.setItem(NSFW_FILTER_KEY, checked)
  }, [])

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
    const filter = queryOptionsToFilterArray(queryOptions)
    setFetchItemCount({ isFetching: true })
    ;(async () => {
      try {
        const itemCount = (await gtcr.itemCount()).toNumber()
        const itemsPerRequest = 10000
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
    if (!gtcr || !gtcrView || fetchItems.isFetching || !fetchItems.fetchStarted)
      return

    setFetchItems({ isFetching: true })
    const filter = queryOptionsToFilterArray(queryOptions)
    const { page, oldestFirst } = queryOptions
    let encodedItems
    ;(async () => {
      try {
        // The data must be fetched in batches to avoid timeouts.
        // We calculate the number of requests required according
        // to the number of items in the TCR.
        const itemCount = (await gtcr.itemCount()).toNumber()
        const itemsPerRequest = 10000

        // Number calls required to fetch all the data required.
        const requests = Math.ceil(itemCount / itemsPerRequest)
        let request = 1
        let target = [bigNumberify(0), itemCount > 0, false]
        while (request <= requests && !target[2]) {
          target = await gtcrView.findIndexForPage(
            gtcr.address,
            [
              Number(page),
              ITEMS_PER_PAGE,
              itemsPerRequest,
              target[0].toNumber()
            ],
            [...filter, oldestFirst],
            active && account ? account : ZERO_ADDRESS
          )
          request++
        }
        const cursorIndex = target[0].toNumber()

        // Edge case: Query items sets the cursor to the last item if
        // we are sorting by the newest items and the cursor index is 0.
        // This means we must take special care if the last page has a
        // single item.
        if (cursorIndex === 0 && !oldestFirst && page !== '1')
          encodedItems = await gtcrView.queryItems(
            gtcr.address,
            0,
            1,
            filter,
            true,
            active && account ? account : ZERO_ADDRESS
          )
        else
          encodedItems = await gtcrView.queryItems(
            gtcr.address,
            cursorIndex,
            ITEMS_PER_PAGE,
            filter,
            oldestFirst,
            active && account ? account : ZERO_ADDRESS
          )

        // Filter out empty slots from the results.
        encodedItems = encodedItems[0].filter(item => item.ID !== ZERO_BYTES32)
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
    account
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
      (oldActiveItems.address && oldActiveItems.address !== tcrAddress)
    )
      return

    const { data: encodedItems } = fetchItems
    const { columns } = metaEvidence.metadata

    // If on page 1, display also old items with new pending
    // requests, if any.
    const displayedItems =
      page && Number(page) > 1
        ? encodedItems
        : [...oldActiveItems.data, ...encodedItems]

    return displayedItems.map((item, i) => {
      let decodedItem
      const errors = []
      try {
        decodedItem = gtcrDecode({ values: item.data, columns })
        // eslint-disable-next-line no-unused-vars
      } catch (err) {
        console.warn(
          `Error decoding item ${item.ID} of TCR at ${tcrAddress} in items view`
        )
        errors.push(`Error decoding item ${item.ID} of TCR at ${tcrAddress}`)
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
  }, [fetchItems, metaEvidence, oldActiveItems, page, tcrAddress])

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

  if (!tcrAddress)
    return (
      <ErrorPage
        code="404"
        message="The gods are having trouble finding this TCR."
        tip="Is your wallet set to the correct network?"
      />
    )

  if (tcrError || error)
    return (
      <ErrorPage
        code="400"
        message={tcrError || error || 'Decoding this item.'}
        tip="Is your wallet set to the correct network?"
      />
    )

  const metadata = metaEvidence && metaEvidence.metadata

  return (
    <>
      <WarningBanner />
      <StyledBanner>
        <StyledHeader>
          {metadata ? (
            <Typography.Title ellipsis style={{ marginBottom: '0' }}>
              {metadata.tcrTitle}
            </Typography.Title>
          ) : (
            <Skeleton active paragraph={false} title={{ width: 100 }} />
          )}
          {metadata && (
            <StyledButton
              type="primary"
              size="large"
              onClick={() => requestWeb3Auth(() => setSubmissionFormOpen(true))}
            >
              Submit{' '}
              {metadata && metadata.itemName ? metadata.itemName : 'Item'}
              <Icon type="plus-circle" />
            </StyledButton>
          )}
        </StyledHeader>
        {metadata ? (
          <Typography.Text
            ellipsis
            type="secondary"
            style={{ maxWidth: '100%' }}
          >
            {capitalizeFirstLetter(metadata.tcrDescription)}
          </Typography.Text>
        ) : (
          <Skeleton active paragraph={{ rows: 1, width: 150 }} title={false} />
        )}
        {connectedTCRAddr && connectedTCRAddr !== ZERO_ADDRESS && (
          <>
            <br />
            <Typography.Text
              ellipsis
              type="secondary"
              style={{ maxWidth: '100%', textDecoration: 'underline' }}
            >
              <Link
                to={`/tcr/${connectedTCRAddr}`}
                style={{ color: '#4d00b473' }}
              >
                View connected TCRs
              </Link>
            </Typography.Text>
          </>
        )}
      </StyledBanner>
      <SearchBar />
      <StyledLayoutContent>
        <StyledContent>
          <Spin
            spinning={
              fetchItems.isFetching || fetchItemCount.isFetching || !metadata
            }
          >
            <>
              <StyledFilters>
                <div>
                  <StyledSwitch
                    checkedChildren="NSFW Filter: On"
                    unCheckedChildren="NSFW Filter: Off"
                    checked={nsfwFilterOn}
                    onChange={toggleNSFWFilter}
                  />
                  {Object.keys(queryOptions)
                    .filter(
                      key =>
                        key !== FILTER_KEYS.PAGE &&
                        key !== FILTER_KEYS.OLDEST_FIRST
                    )
                    .map(key => (
                      <StyledTag
                        key={key}
                        checked={queryOptions[key]}
                        onChange={checked => {
                          const newQueryStr = updateFilter({
                            prevQuery: search,
                            filter: key,
                            checked
                          })
                          history.push({
                            search: newQueryStr
                          })
                          setFetchItems({ fetchStarted: true })
                          setFetchItemCount({ fetchStarted: true })
                        }}
                      >
                        {filterLabel[key]}
                      </StyledTag>
                    ))}
                </div>
                <StyledSelect
                  defaultValue={oldestFirst ? 'oldestFirst' : 'newestFirst'}
                  style={{ width: 120 }}
                  onChange={val => {
                    const newQueryStr = updateFilter({
                      prevQuery: search,
                      filter: 'oldestFirst',
                      checked: val === 'oldestFirst'
                    })
                    history.push({
                      search: newQueryStr
                    })
                    setFetchItems({ fetchStarted: true })
                  }}
                >
                  <Select.Option value="newestFirst">Newest</Select.Option>
                  <Select.Option value="oldestFirst">Oldest</Select.Option>
                </StyledSelect>
              </StyledFilters>
              <StyledGrid>
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
        {metaEvidence && (
          <>
            {metaEvidence.metadata.isConnectedTCR ? (
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
                tcrAddress={tcrAddress}
                metaEvidence={metaEvidence}
              />
            )}
          </>
        )}
      </StyledLayoutContent>
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
