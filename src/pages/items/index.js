import {
  Typography,
  Layout,
  Skeleton,
  Table,
  Button,
  Icon,
  Spin,
  Pagination
} from 'antd'
import { Link } from 'react-router-dom'
import React, {
  useEffect,
  useState,
  useContext,
  useCallback,
  useMemo
} from 'react'
import PropTypes from 'prop-types'
import qs from 'qs'
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

const StyledContent = styled(Layout.Content)`
  margin: 32px 0;
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
  const [encodedItems, setEncodedItems] = useState()
  const [submissionFormOpen, setSubmissionFormOpen] = useState()
  const [errored, setErrored] = useState()
  const [timestamp, setTimestamp] = useState()
  const [isFetching, setIsFetching] = useState(true)
  const [itemCount, setItemCount] = useState()
  const {
    filter = [false, true, true, true, true, true, true, true],
    oldestFirst = false,
    page
  } = qs.parse(search.replace(/\?/g, ''))

  // Warning: This function should only be called when all
  // its dependencies are set.
  const fetchItems = useCallback(async () => {
    try {
      const itemCount = (await gtcr.itemCount()).toNumber()
      const itemsPerRequest = 10000
      const requests = Math.ceil(itemCount / itemsPerRequest)
      let request = 1
      let target = [bigNumberify(0), itemCount > 0, false]
      while (request <= requests && !target[2]) {
        target = await gtcrView.findIndexForPage(
          tcrAddress,
          [Number(page), ITEMS_PER_PAGE, itemsPerRequest, target[0].toNumber()],
          [...filter, oldestFirst],
          ZERO_ADDRESS
        )
        request++
      }
      const cursorIndex = target[0].toNumber()

      // Edge case: Query items sets the cursor to the last item if
      // we are sorting by the newest items and the cursor index is 0.
      // This is the case where the last page has only one item.
      let encodedItems = []
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
          cursorIndex, // Cursor.
          ITEMS_PER_PAGE, // Count.
          filter,
          oldestFirst,
          ZERO_ADDRESS
        )

      encodedItems = encodedItems[0].filter(item => item.ID !== ZERO_BYTES32) // Filter out empty slots from the results.
      setEncodedItems(encodedItems)
    } catch (err) {
      console.error(err)
      setErrored(true)
    } finally {
      setIsFetching(false)
    }
  }, [filter, gtcr, gtcrView, oldestFirst, page, tcrAddress])

  // Set to first page if none is provided.
  useEffect(() => {
    if (page || !history) return
    history.push({ search: '?page=1' })
  }, [history, page])

  // Fetch number of pages for the current filter
  // TODO: This effect can run more times than necessary. Update
  // logic so that it only runs when the filters, page, party
  // address or sorting option changes.
  useEffect(() => {
    if (!gtcrView) return
    ;(async () => {
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
      setItemCount(count)
    })()
  }, [filter, gtcr, gtcrView, tcrAddress])

  // Fetch timestamp.
  useEffect(() => {
    if (!library || timestamp) return
    ;(async () => {
      try {
        setTimestamp(bigNumberify((await library.getBlock()).timestamp))
      } catch (err) {
        console.error(err)
        setErrored(true)
      }
    })()
  }, [library, timestamp])

  // Fetch items.
  // TODO: This effect can run more times than necessary. Update
  // logic so that it only runs when the filters, page, party
  // address or sorting option changes.
  useEffect(() => {
    if (!gtcr || !gtcrView || !tcrAddress || !page || !isFetching) return
    fetchItems()
  }, [gtcrView, tcrAddress, page, isFetching, fetchItems, gtcr])

  // Decode items once meta evidence and items were fetched.
  const items = useMemo(() => {
    if (!encodedItems || !metaEvidence) return
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
  }, [encodedItems, metaEvidence])

  // Watch for submissions and status change events to refetch items.
  useEffect(() => {
    if (!gtcr || !metaEvidence) return
    gtcr.on(gtcr.filters.ItemStatusChange(), () => setIsFetching(true))
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
      <StyledContent>
        {items && metaEvidence ? (
          <Spin spinning={isFetching}>
            <>
              <Table
                dataSource={items}
                columns={columns}
                bordered
                pagination={false}
              />
              <StyledPagination
                total={itemCount || 0}
                current={Number(page)}
                itemRender={pagingItem}
                pageSize={ITEMS_PER_PAGE}
                onChange={newPage => {
                  history.push({
                    search: search.replace(/page=\d+/g, `page=${newPage}`)
                  })
                  setIsFetching(true)
                }}
              />
            </>
          </Spin>
        ) : (
          <Skeleton active paragraph={{ rows: 8 }} title={false} />
        )}
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
