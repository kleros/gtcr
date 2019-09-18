import {
  Typography,
  Layout,
  Skeleton,
  Table,
  Button,
  Icon,
  Spin,
  Pagination,
  Tag,
  Divider,
  Select
} from 'antd'
import { Link } from 'react-router-dom'
import qs from 'qs'
import React, { useEffect, useState, useContext, useMemo } from 'react'
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
import itemTypes from '../../utils/item-types'
import ETHAddress from '../../components/eth-address'
import SubmissionModal from '../item-details/modals/submit'
import {
  searchStrToFilterObj,
  filterLabel,
  FILTER_KEYS,
  updateFilter,
  queryOptionsToFilterArray
} from '../../utils/filters'

const StyledContent = styled(Layout.Content)`
  word-break: break-word;
`

const StyledLayoutContent = styled(Layout.Content)`
  background: white;
  padding: 42px 9.375vw 42px;
  display: flex;
  flex-direction: column;
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

const StyledDivider = styled(Divider)`
  margin-bottom: 10px;
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
// TODO: Send http requests in parallel.
const ITEMS_PER_PAGE = 40
const Items = ({ tcrAddress, search, history }) => {
  const { requestWeb3Auth } = useContext(WalletContext)
  const { library, active } = useWeb3Context()
  const {
    gtcr,
    metaEvidence,
    challengePeriodDuration,
    tcrErrored,
    gtcrView
  } = useContext(TCRViewContext)
  const [submissionFormOpen, setSubmissionFormOpen] = useState()
  const [errored, setErrored] = useState()
  const [timestamp, setTimestamp] = useState()
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

  // Set page to 1 in the URI if none is set.
  useEffect(() => {
    if (qs.parse(search.replace(/\?/g, '')).page) return
    history.push({ search: '?page=1' })
  }, [history, search])

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
        setErrored(true)
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

  // Fetch timestamp.
  useEffect(() => {
    if (!library || timestamp) return
    ;(async () => {
      try {
        setTimestamp(bigNumberify((await library.getBlock()).timestamp))
      } catch (err) {
        console.error('Error fetching timestamp', err)
        setErrored(true)
      }
    })()
  }, [library, timestamp])

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
        setErrored(true)
        setFetchItems({ isFetching: false, fetchStarted: false })
      } finally {
        setFetchItems({
          isFetching: false,
          fetchStarted: false,
          data: encodedItems
        })
      }
    })()
  }, [gtcrView, tcrAddress, fetchItems, gtcr, search])

  // Decode items once meta evidence and items were fetched.
  const items = useMemo(() => {
    if (!fetchItems.data || !metaEvidence) return
    const { data: encodedItems } = fetchItems
    const { columns } = metaEvidence
    return encodedItems.map((item, i) => {
      const decodedItem = gtcrDecode({ values: item.data, columns })
      // Return the item columns along with its TCR status data.
      return {
        tcrData: {
          ...item // Spread to convert from array to object.
        },
        ...columns.reduce(
          (acc, curr, i) => ({
            ...acc,
            [curr.label]: decodedItem[i],
            ID: item.ID
          }),
          { key: i }
        )
      }
    })
  }, [fetchItems, metaEvidence])

  // Watch for submissions and status change events to refetch items.
  useEffect(() => {
    if (!gtcr || !metaEvidence) return
    gtcr.on(gtcr.filters.ItemStatusChange(), () =>
      setFetchItems({ fetchStarted: true })
    )
    return () => {
      gtcr.removeAllListeners(gtcr.filters.ItemStatusChange())
    }
  }, [gtcr, metaEvidence])

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

  if (!tcrAddress || tcrErrored || errored)
    return (
      <ErrorPage
        code="400"
        message="The gods are having trouble finding this TCR."
        tip="Is your wallet set to the correct network?"
      />
    )

  const columns = !metaEvidence
    ? []
    : [
        {
          title: 'Item Status',
          key: 'Item Status',
          dataIndex: 'Item Status',
          render: (_, item) => (
            <ItemStatus
              item={item.tcrData}
              challengePeriodDuration={challengePeriodDuration}
              timestamp={timestamp}
            />
          )
        }
      ].concat(
        metaEvidence.columns
          .filter(column => !!column.isIdentifier)
          .map((column, i) => ({
            title: column.label,
            key: column.label,
            dataIndex: column.label,
            render: (text, item) =>
              i === 0 ? (
                <Link to={`/tcr/${tcrAddress}/${item.ID}`}>{text}</Link>
              ) : column.type === itemTypes.ADDRESS ? (
                <ETHAddress address={text} />
              ) : (
                text
              )
          }))
      )

  const queryOptions = searchStrToFilterObj(search)
  const { oldestFirst } = queryOptions

  return (
    <StyledLayoutContent>
      <StyledHeader>
        {metaEvidence ? (
          <Typography.Title ellipsis>{metaEvidence.title}</Typography.Title>
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
          {metaEvidence.description}
        </Typography.Text>
      ) : (
        <Skeleton active paragraph={{ rows: 1, width: 150 }} title={false} />
      )}
      <StyledDivider />
      <StyledContent>
        <Spin
          spinning={
            fetchItems.isFetching || fetchItemCount.isFetching || !metaEvidence
          }
        >
          <>
            <Table
              title={() => (
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
              )}
              dataSource={items}
              columns={columns}
              pagination={false}
            />
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
  )
}

Items.propTypes = {
  tcrAddress: PropTypes.string.isRequired,
  search: PropTypes.string.isRequired,
  history: PropTypes.shape({
    push: PropTypes.func.isRequired
  }).isRequired
}

export default Items
