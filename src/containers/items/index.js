import { Typography, Layout, Skeleton, Table, Button, Icon } from 'antd'
import { Link } from 'react-router-dom'
import React, { useEffect, useState, useContext } from 'react'
import PropTypes from 'prop-types'
import ErrorPage from '../error-page'
import styled from 'styled-components/macro'
import SubmissionModal from '../submission-modal'
import { WalletContext } from '../../bootstrap/wallet-context'
import { ZERO_ADDRESS, ZERO_BYTES32 } from '../../utils/string'
import { TCRViewContext } from '../../bootstrap/tcr-view-context'
import ItemStatus from '../../components/item-status'
import { useWeb3Context } from 'web3-react'
import { bigNumberify } from 'ethers/utils'
import { gtcrDecode } from '../../utils/encoder'

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

  // Fetch items
  useEffect(() => {
    ;(async () => {
      if (!gtcr || !metaEvidence) return
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
              tcrData: { ...item }, // Spread to convert from array to object.
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

        setTimestamp(bigNumberify((await library.getBlock()).timestamp))
        setItems(items)
      } catch (err) {
        console.error(err)
        setErrored(true)
      }
    })()
  }, [gtcr, metaEvidence, library])

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
          .map(column => ({
            title: column.label,
            key: column.label,
            dataIndex: column.label,
            render: (text, item) => (
              <Link to={`/tcr/${tcrAddress}/${item.ID}`}>{text}</Link>
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
        metaEvidence={metaEvidence}
        tcrAddress={tcrAddress}
      />
    </StyledLayoutContent>
  )
}

Items.propTypes = {
  tcrAddress: PropTypes.string.isRequired
}

export default Items
