import { Typography, Layout, Skeleton, Table } from 'antd'
import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useWeb3Context } from 'web3-react'
import { ethers } from 'ethers'
import { useDebounce } from 'use-debounce'
import ErrorPage from '../error-page'
import styled from 'styled-components/macro'
import _GTCR from '../../assets/contracts/GTCRMock.json'

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

const Items = ({
  match: {
    params: { tcrAddress }
  }
}) => {
  const { abi } = _GTCR
  const { library, active } = useWeb3Context()
  const [errored, setErrored] = useState()
  const [metaEvidencePath, setMetaEvidencePath] = useState()
  const [metaEvidence, setMetaEvidence] = useState()
  const [debouncedMetaEvidencePath] = useDebounce(metaEvidencePath, 1000)
  const [tcr, setTcr] = useState()
  const [items, setItems] = useState()

  // Wire up the TCR.
  useEffect(() => {
    if (!library || !active || !tcrAddress) return
    setTcr(new ethers.Contract(tcrAddress, abi, library))
  }, [setTcr, library, active, tcrAddress, abi])

  // Fetch meta evidence logs.
  useEffect(() => {
    ;(async () => {
      if (!tcr) return
      try {
        tcr.on('MetaEvidence', (_, metaEvidencePath) => {
          setMetaEvidencePath(metaEvidencePath)
        })
        const blockNumber = await tcr.prevBlockNumber()
        library.resetEventsBlock(blockNumber) // Reset provider to fetch logs.
      } catch (err) {
        console.error(err)
        setErrored(true)
      }
    })()
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

  useEffect(() => {
    ;(async () => {
      if (!tcr) return
      try {
        setItems(await tcr.getItems(0))
      } catch (err) {
        console.error(err)
        setErrored(true)
      }
    })()
  }, [tcr])

  if (!tcrAddress || errored)
    return (
      <ErrorPage
        code="400"
        message="A TCR was not found at this address. Are you in the correct network?"
      />
    )

  // TODO: swap this for parsed results from TCR.
  const dataSource = [
    {
      key: 1,
      Name: 'Token² Curated List',
      Address: '0x25dd2659a1430cdbd678615c7409164ae486c146'
    },
    {
      key: 2,
      Name: 'ERC20 Badge',
      Address: '0x78895ec026aeff2db73bc30e623c39e1c69b1386'
    },
    {
      key: 3,
      Name: 'Ethfinex Badge',
      Address: '0xd58bdd286e8155b6223e2a62932ae3e0a9a75759'
    },
    {
      key: 4,
      Name: 'Malware Free Movies',
      Address: '0x0000000000000000000000000000000000000000'
    },
    {
      key: 5,
      Name: 'Actual News',
      Address: '0x0000000000000000000000000000000000000000'
    },
    {
      key: 6,
      Name: 'SF Earpods Trading',
      Address: '0x0000000000000000000000000000000000000000'
    }
  ]

  const columns = [
    {
      title: 'Name',
      dataIndex: 'Name',
      key: 'Name'
    },
    {
      title: 'Address',
      dataIndex: 'Address',
      key: 'Address'
    }
  ]

  return (
    <StyledLayoutContent>
      {metaEvidence ? (
        <>
          <Typography.Title ellipsis>{metaEvidence.title}</Typography.Title>
          <Typography.Text ellipsis type="secondary">
            {metaEvidence.description}
          </Typography.Text>
        </>
      ) : (
        <Skeleton active paragraph={{ rows: 1 }} />
      )}
      <StyledContent>
        {items ? (
          <Table dataSource={dataSource} columns={columns} bordered />
        ) : (
          <Skeleton active paragraph={{ rows: 8 }} title={false} />
        )}
      </StyledContent>
    </StyledLayoutContent>
  )
}

Items.propTypes = {
  match: PropTypes.shape({
    params: PropTypes.objectOf(PropTypes.string)
  }).isRequired
}

export default Items
