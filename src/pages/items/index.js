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
import { ZERO_ADDRESS, ZERO_BYTES32 } from '../../utils/string'
import { TCRViewContext } from '../../bootstrap/tcr-view-context'
import ItemStatus from '../../components/item-status-badge'
import { useWeb3Context } from 'web3-react'
import { bigNumberify } from 'ethers/utils'
import { gtcrDecode } from '../../utils/encoder'
import SubmissionModal from '../item-details/modals/submit'
import SearchBar from '../../components/search-bar'
import {
  searchStrToFilterObj,
  filterLabel,
  FILTER_KEYS,
  updateFilter,
  queryOptionsToFilterArray
} from '../../utils/filters'
import DisplaySelector from '../../components/display-selector'

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

const StyledSpan = styled.span`
  text-decoration: underline;
  cursor: pointer;
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
  const { active } = useWeb3Context()
  const {
    gtcr,
    metaEvidence,
    challengePeriodDuration,
    tcrError,
    gtcrView,
    tcrAddress
  } = useContext(TCRViewContext)
  const [submissionFormOpen, setSubmissionFormOpen] = useState()
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

  // Fetch number of pages for the current filter
  useEffect(() => {
    if (!gtcrView || fetchItemCount.isFetching || !fetchItemCount.fetchStarted)
      return
    const queryOptions = searchStrToFilterObj(search)
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
    search
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
    const queryOptions = searchStrToFilterObj(search)
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
  }, [gtcrView, tcrAddress, fetchItems, gtcr, search])

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
    const { columns } = metaEvidence

    try {
      return encodedItems.map((item, i) => {
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
  }, [fetchItems, metaEvidence, tcrAddress])

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

  if (!active && !process.env.REACT_APP_INFURA_PROJECT_ID)
    return (
      <ErrorPage
        code="Web3 Required"
        message="A provider is required to view blockchain data."
        tip={
          <div>
            Please{' '}
            <StyledSpan
              className="primary-color theme-color"
              onClick={requestWeb3Auth}
            >
              connect a wallet.
            </StyledSpan>
          </div>
        }
      />
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

  const queryOptions = searchStrToFilterObj(search)
  const { oldestFirst } = queryOptions

  return (
    <>
      <StyledBanner>
        <StyledHeader>
          {metaEvidence ? (
            <Typography.Title ellipsis style={{ marginBottom: '0' }}>
              {metaEvidence.tcrTitle}
            </Typography.Title>
          ) : (
            <Skeleton active paragraph={false} title={{ width: 100 }} />
          )}
          {metaEvidence && (
            <StyledButton
              type="primary"
              size="large"
              onClick={() => requestWeb3Auth(() => setSubmissionFormOpen(true))}
            >
              Submit{' '}
              {metaEvidence && metaEvidence.itemName
                ? metaEvidence.itemName
                : 'Item'}
              <Icon type="plus-circle" />
            </StyledButton>
          )}
        </StyledHeader>
        {metaEvidence ? (
          <Typography.Text ellipsis type="secondary">
            {metaEvidence.tcrDescription}
          </Typography.Text>
        ) : (
          <Skeleton active paragraph={{ rows: 1, width: 150 }} title={false} />
        )}
      </StyledBanner>
      <SearchBar />
      <StyledLayoutContent>
        <StyledContent>
          <Spin
            spinning={
              fetchItems.isFetching ||
              fetchItemCount.isFetching ||
              !metaEvidence
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
                        <ItemStatus
                          item={item.tcrData}
                          challengePeriodDuration={challengePeriodDuration}
                          timestamp={timestamp}
                          dark
                        />
                      }
                    >
                      {item.columns
                        .filter(col => col.isIdentifier)
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
                    search: search.replace(/page=\d+/g, `page=${newPage}`)
                  })
                  setFetchItems({ fetchStarted: true })
                  setFetchItemCount({ fetchStarted: true })
                }}
              />
            </>
          </Spin>
        </StyledContent>
        <SubmissionModal
          visible={submissionFormOpen}
          onCancel={() => setSubmissionFormOpen(false)}
        />
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
