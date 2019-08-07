import { Typography, Layout, Skeleton, Table, Button, Icon } from 'antd'
import { Link } from 'react-router-dom'
import React, { useEffect, useState, useContext } from 'react'
import PropTypes from 'prop-types'
import { useWeb3Context } from 'web3-react'
import { ethers } from 'ethers'
import { useDebounce } from 'use-debounce'
import ErrorPage from '../error-page'
import styled from 'styled-components/macro'
import { abi } from '../../assets/contracts/GTCRMock.json'
import SubmissionModal from '../../components/submission-modal'
import { WalletContext } from '../../bootstrap/wallet-context'
import web3EthAbi from 'web3-eth-abi'
import { typeToSolidity } from '../../utils/item-types'
import { ZERO_ADDRESS, ZERO_BYTES32 } from '../../utils/string'

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

const Items = ({
  match: {
    params: { tcrAddress }
  }
}) => {
  const { library, active } = useWeb3Context()
  const { requestWeb3Auth } = useContext(WalletContext)
  const [errored, setErrored] = useState()
  const [metaEvidencePath, setMetaEvidencePath] = useState()
  const [metaEvidence, setMetaEvidence] = useState()
  const [debouncedMetaEvidencePath] = useDebounce(metaEvidencePath, 300)
  const [tcr, setTcr] = useState()
  const [items, setItems] = useState()
  const [submissionFormOpen, setSubmissionFormOpen] = useState(false)

  // Wire up the TCR.
  useEffect(() => {
    if (!library || !active || !tcrAddress) return
    setTcr(new ethers.Contract(tcrAddress, abi, library))
  }, [setTcr, library, active, tcrAddress])

  // Fetch meta evidence logs.
  useEffect(() => {
    if (!tcr || !library) return

    const saveMetaEvidencePath = (_, metaEvidencePath) => {
      setMetaEvidencePath(metaEvidencePath)
    }
    try {
      tcr.on('MetaEvidence', saveMetaEvidencePath)
      library.resetEventsBlock(0) // Reset provider to fetch logs.
    } catch (err) {
      console.error(err)
      setErrored(true)
    }

    return () => {
      tcr.removeListener('MetaEvidence', saveMetaEvidencePath)
    }
  }, [tcr, library])

  // Fetch latest meta evidence file.
  useEffect(() => {
    ;(async () => {
      if (!debouncedMetaEvidencePath) return
      try {
        const file = await (await fetch(
          process.env.REACT_APP_IPFS_GATEWAY + debouncedMetaEvidencePath
        )).json()
        setMetaEvidence(file)
      } catch (err) {
        console.error(err)
        setErrored(true)
      }
    })()
  }, [debouncedMetaEvidencePath, setMetaEvidence])

  // Fetch items
  useEffect(() => {
    ;(async () => {
      if (!tcr || !metaEvidence) return
      try {
        const { columns } = metaEvidence
        const types = columns.map(column => typeToSolidity[column.type])
        const items = (await tcr.queryItems(
          ZERO_BYTES32, // Cursor.
          50, // Count.
          [false, true, true, true, true, true, true, true], // Filter.
          false, // Oldest first.
          ZERO_ADDRESS
        ))[0]
          .filter(item => item.ID !== ZERO_BYTES32) // Filter out empty slots from the results.
          .map((item, i) => {
            const decodedItem = web3EthAbi.decodeParameters(types, item.data)
            return columns.reduce(
              (acc, curr, i) => ({
                ...acc,
                [curr.label]: decodedItem[i],
                ID: item.ID
              }),
              { key: i }
            )
          })

        setItems(items)
      } catch (err) {
        console.error(err)
        setErrored(true)
      }
    })()
  }, [tcr, metaEvidence])

  if (!tcrAddress || errored)
    return (
      <ErrorPage
        code="400"
        message="The gods are having trouble finding this TCR."
        tip="Is your wallet set to the correct network?"
      />
    )

  const columns = !metaEvidence
    ? []
    : metaEvidence.columns
        .filter(column => !!column.isIdentifier)
        .map(column => ({
          title: column.label,
          key: column.label,
          dataIndex: column.label,
          render: (text, item) => (
            <Link to={`/tcr/${tcrAddress}/${item.ID}`}>{text}</Link>
          )
        }))

  return (
    <StyledLayoutContent>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
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
      </div>
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
  match: PropTypes.shape({
    params: PropTypes.objectOf(PropTypes.string)
  }).isRequired
}

export default Items
