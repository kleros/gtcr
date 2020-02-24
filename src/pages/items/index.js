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
  Card
} from 'antd'
import { Link } from 'react-router-dom'
import React, { useEffect, useState, useContext, useMemo, useRef } from 'react'
import PropTypes from 'prop-types'
import ErrorPage from '../error-page'
import styled from 'styled-components/macro'
import { WalletContext } from '../../bootstrap/wallet-context'
import {
  ZERO_ADDRESS,
  ZERO_BYTES32,
  capitalizeFirstLetter
} from '../../utils/string'
import { TCRViewContext } from '../../bootstrap/tcr-view-context'
import ItemStatusBadge from '../../components/item-status-badge'
import { bigNumberify } from 'ethers/utils'
import { gtcrDecode } from '../../utils/encoder'
import SubmitModal from '../item-details/modals/submit'
import SubmitConnectModal from '../item-details/modals/submit-connect'
import SearchBar from '../../components/search-bar'
import {
  searchStrToFilterObj,
  filterLabel,
  FILTER_KEYS,
  updateFilter,
  queryOptionsToFilterArray
} from '../../utils/filters'
import DisplaySelector from '../../components/display-selector'
import { useWeb3Context } from 'web3-react'
import itemTypes from '../../utils/item-types'

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

const StyledItemCol = styled.div`
  margin-bottom: 8px;
  text-align: center;
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
  const { library } = useWeb3Context()
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
  const [oldActiveItems, setOldActiveItems] = useState([])
  const [error, setError] = useState()
  const [fetchItems, setFetchItems] = useState({
    fetchStarted: true,
    isFetching: false,
    data: null
  })
  const [fetchItemCount, setFetchItemCount] = useState({
    fetchStarted: true,
    isFetching: false,
    data: null
  })
  const refAttr = useRef()
  const [eventListenerSet, setEventListenerSet] = useState()
  const queryOptions = searchStrToFilterObj(search)

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
            ZERO_ADDRESS
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
    queryOptions
  ])

  // Fetch items.
  useEffect(() => {
    if (
      !gtcr ||
      !gtcrView ||
      !tcrAddress ||
      fetchItems.isFetching ||
      !fetchItems.fetchStarted
    )
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
        const requests = Math.ceil(itemCount / itemsPerRequest)
        let request = 1 // Number calls required to fetch all the data required.
        let target = [bigNumberify(0), itemCount > 0, false]
        while (request <= requests && !target[2]) {
          target = await gtcrView.findIndexForPage(
            tcrAddress,
            [
              Number(page),
              ITEMS_PER_PAGE,
              itemsPerRequest,
              target[0].toNumber()
            ],
            [...filter, oldestFirst],
            ZERO_ADDRESS
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
            tcrAddress,
            0,
            1,
            filter,
            true,
            ZERO_ADDRESS
          )
        else
          encodedItems = await gtcrView.queryItems(
            tcrAddress,
            cursorIndex,
            ITEMS_PER_PAGE,
            filter,
            oldestFirst,
            ZERO_ADDRESS
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
          tcrAddress
        })
      }
    })()
  }, [gtcrView, tcrAddress, fetchItems, gtcr, search, queryOptions])

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
      fetchItems.tcrAddress !== tcrAddress ||
      !challengePeriodDuration ||
      !library
    )
      return
    ;(async () => {
      // Fetch request events within one challenge period duration.
      const BLOCK_TIME = 15 // Assuming a blocktime of 15 seconds.
      const filter = {
        ...gtcr.filters.RequestSubmitted(),
        fromBlock:
          latestBlock -
          (challengePeriodDuration.div(bigNumberify(BLOCK_TIME)).toNumber() +
            100) // Add 100 block margin.
      }

      const requestSubmissionLogs = (await library.getLogs(filter))
        .map(log => ({
          ...gtcr.interface.parseLog(log),
          blockNumber: log.blockNumber
        }))
        .sort((a, b) => b.blockNumber - a.blockNumber)
        .filter(
          log =>
            !fetchItems.data.map(item => item.ID).includes(log.values._itemID)
        ) // Remove items already fetched.

      if (requestSubmissionLogs.length === 0) return

      // Fetch item details.
      setOldActiveItems(
        (
          await Promise.all(
            requestSubmissionLogs.map(log =>
              gtcrView.getItem(tcrAddress, log.values._itemID)
            )
          )
        ).filter(item => !item.resolved)
      )
    })()
  }, [
    challengePeriodDuration,
    fetchItems.data,
    fetchItems.tcrAddress,
    gtcr,
    gtcrView,
    latestBlock,
    library,
    search,
    tcrAddress
  ])

  const { oldestFirst, page } = queryOptions

  // Decode items once meta evidence and items were fetched.
  const items = useMemo(() => {
    if (
      !fetchItems.data ||
      !metaEvidence ||
      metaEvidence.tcrAddress !== tcrAddress ||
      fetchItems.tcrAddress !== tcrAddress
    )
      return

    const { data: encodedItems } = fetchItems
    const { columns } = metaEvidence.metadata

    // If on page 1, display also old items with new pending
    // requests, if any.
    const displayedItems =
      page && Number(page) > 1
        ? encodedItems
        : [...oldActiveItems, ...encodedItems]

    try {
      return displayedItems.map((item, i) => {
        const decodedItem = gtcrDecode({ values: item.data, columns })
        // Return the item columns along with its TCR status data.
        return {
          tcrData: {
            ...item // Spread to convert from array to object.
          },
          columns: columns.map(
            (col, i) => ({
              value: decodedItem[i],
              ...col
            }),
            { key: i }
          )
        }
      })
    } catch (err) {
      console.error('Error decoding items', err)
      setError('Error decoding items')
    }
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
                  items.map((item, i) => (
                    <Card
                      key={i}
                      extra={
                        <Link to={`/tcr/${tcrAddress}/${item.tcrData.ID}`}>
                          <Icon type="arrow-right" style={{ color: 'white' }} />
                        </Link>
                      }
                      title={
                        <ItemStatusBadge
                          item={item.tcrData}
                          challengePeriodDuration={challengePeriodDuration}
                          timestamp={timestamp}
                          dark
                        />
                      }
                    >
                      {item.columns
                        .filter(
                          col =>
                            col.isIdentifier || col.type === itemTypes.IMAGE
                        )
                        .map((column, j) => (
                          <StyledItemCol key={j}>
                            <DisplaySelector
                              type={column.type}
                              value={column.value}
                            />
                          </StyledItemCol>
                        ))}
                    </Card>
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
