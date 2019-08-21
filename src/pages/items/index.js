import { Typography, Layout, Skeleton, Table, Button, Icon } from 'antd'
import { Link } from 'react-router-dom'
import React, { useEffect, useState, useContext, useCallback } from 'react'
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
import SubmissionModal from '../item-details/modals/submission-modal'

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

// TODO: Watch for new submissions and refetch when new items are submitted.
const Items = ({ tcrAddress }) => {
  const { requestWeb3Auth } = useContext(WalletContext)
  const { library } = useWeb3Context()
  const {
    gtcr,
    metaEvidence,
    challengePeriodDuration,
    tcrErrored
  } = useContext(TCRViewContext)
  const [items, setItems] = useState()
  const [submissionFormOpen, setSubmissionFormOpen] = useState(false)
  const [errored, setErrored] = useState()
  const [timestamp, setTimestamp] = useState()

  // Warning: This function should only be called when all its dependencies
  // are set.
  const fetchItems = useCallback(async () => {
    try {
      const { columns } = metaEvidence
      const items = (await gtcr.queryItems(
        ZERO_BYTES32, // Cursor.
        50, // Count.
        [false, true, true, true, true, true, true, true], // Filter.
        false, // Oldest first.
        ZERO_ADDRESS
      ))[0]
        .filter(item => item.ID !== ZERO_BYTES32) // Filter out empty slots from the results.
        .map((item, i) => {
          const decodedItem = gtcrDecode({ values: item.data, columns })
          // Return the item columns along with its TCR status data.
          return {
            tcrData: {
              ...item, // Spread to convert from array to object.
              currentRuling: item.currentRuling.toNumber()
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
      setItems(items)
    } catch (err) {
      console.error(err)
      setErrored(true)
    }
  }, [gtcr, metaEvidence])

  // Fetch items and timestamp.
  useEffect(() => {
    if (!gtcr || !metaEvidence || !library) return
    fetchItems()
    ;(async () => {
      try {
        setTimestamp(bigNumberify((await library.getBlock()).timestamp))
      } catch (err) {
        console.error(err)
        setErrored(true)
      }
    })()
  }, [gtcr, metaEvidence, library, fetchItems])

  // Watch for submissions and status change events to refetch items.
  useEffect(() => {
    if (!gtcr) return
    gtcr.on(gtcr.filters.ItemStatusChange(), fetchItems)
    return () => {
      gtcr.removeAllListeners(gtcr.filters.ItemStatusChange())
    }
  }, [fetchItems, gtcr])

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
          <Table
            dataSource={items}
            columns={columns}
            bordered
            pagination={false}
          />
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
  tcrAddress: PropTypes.string.isRequired
}

export default Items
