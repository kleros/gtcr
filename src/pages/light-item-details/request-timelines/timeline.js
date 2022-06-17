import React, { useMemo, useEffect, useContext, useState } from 'react'
import {
  Timeline as AntdTimeline,
  Icon,
  Card,
  Skeleton,
  Result,
  Typography
} from 'antd'
import { useWeb3Context } from 'web3-react'
import { ethers } from 'ethers'
import styled from 'styled-components/macro'
import { bigNumberify } from 'ethers/utils'
import { abi as _arbitrator } from '@kleros/erc-792/build/contracts/IArbitrator.json'
import { LightTCRViewContext } from 'contexts/light-tcr-view-context'
import ETHAddress from 'components/eth-address'
import {
  CONTRACT_STATUS,
  PARTY,
  STATUS_COLOR,
  getResultStatus,
  STATUS_CODE
} from 'utils/helpers/item-status'
import { WalletContext } from 'contexts/wallet-context'
import { capitalizeFirstLetter } from 'utils/helpers/string'
import { getTxPage } from 'utils/helpers/network-utils'
import useGetLogs from 'hooks/get-logs'

const StyledText = styled(Typography.Text)`
  text-transform: capitalize;
`

const StyledCard = styled(Card)`
  cursor: default;

  @media (max-width: 768px) {
    & > .ant-card-head > .ant-card-head-wrapper > .ant-card-head-title {
      max-width: 450px;
    }
  }

  @media (max-width: 480px) {
    & > .ant-card-head > .ant-card-head-wrapper > .ant-card-head-title {
      max-width: 160px;
    }
  }
`

const StyledEvidenceTitle = styled.div`
  white-space: pre-line;
  font-weight: 400;
  color: #4d00b4;
`

const StyledIcon = styled(Icon)`
  color: #fff;
`

const EventTimestamp = ({ blockNumber }) => {
  const [eventTime, setEventTime] = useState()
  const { library, active } = useWeb3Context()
  useEffect(() => {
    ;(async () => {
      if (!library || !active) return
      const block = await library.getBlock(blockNumber)
      if (block) setEventTime(block.timestamp)
    })()
  }, [active, blockNumber, library])

  return eventTime
    ? ` - ${new Date(new Date(eventTime * 1000)).toGMTString()}`
    : null
}

const Timeline = ({ request, requestID, item }) => {
  const { library, active, networkId } = useWeb3Context()
  const { gtcr, metaEvidence } = useContext(LightTCRViewContext)
  const { archon } = useContext(WalletContext)
  const [logs, setLogs] = useState([])
  const [error, setError] = useState()
  const [appealableRulings, setAppealableRulings] = useState({})
  const [evidenceFiles, setEvidenceFiles] = useState({})
  const [arbitrator, setArbitrator] = useState()
  const [fetchingLogs, setFetchingLogs] = useState()
  const itemID = item && item.ID
  const evidenceGroupID = useMemo(() => {
    if (!request) return
    return bigNumberify(request.evidenceGroupID)
  }, [request])
  const getLogs = useGetLogs(library)

  // Setup arbitrator instance.
  useEffect(() => {
    if (
      !request ||
      !library ||
      !active ||
      (arbitrator && arbitrator.address === request.arbitrator)
    )
      return

    setArbitrator(new ethers.Contract(request.arbitrator, _arbitrator, library))
  }, [active, arbitrator, library, request])

  // TODO: Listen for events and update timeline, if this is request is
  // not resolved/executed.

  // Fetch logs.
  useEffect(() => {
    if (
      !request ||
      !gtcr ||
      !archon ||
      !itemID ||
      !evidenceGroupID ||
      !library ||
      !arbitrator ||
      fetchingLogs
    )
      return

    setFetchingLogs(true)

    const { disputeID, disputed } = request
    const { address: gtcrAddr } = gtcr

    ;(async () => {
      if (!getLogs) return
      // Fetch logs in parallel.
      const logsArr = (
        await Promise.all([
          getLogs({
            ...gtcr.filters.Evidence(arbitrator.address, evidenceGroupID),
            fromBlock: 0
          }),
          disputed
            ? getLogs({
                ...gtcr.filters.Ruling(arbitrator.address, disputeID),
                fromBlock: 0
              })
            : null,
          disputed
            ? getLogs({
                ...arbitrator.filters.AppealPossible(disputeID, gtcrAddr),
                fromBlock: 0
              })
            : null,
          disputed
            ? getLogs({
                ...arbitrator.filters.AppealDecision(disputeID, gtcrAddr),
                fromBlock: 0
              })
            : null
        ])
      )
        .filter(logs => !!logs)
        .map((e, i) => {
          // Parse and sort event logs.
          if (i <= 1)
            // Arbitrable Logs.
            return e.map(log => ({
              ...gtcr.interface.parseLog(log),
              blockNumber: log.blockNumber,
              transactionHash: log.transactionHash
            }))
          // Arbitrator Logs.
          else
            return e.map(log => ({
              ...arbitrator.interface.parseLog(log),
              blockNumber: log.blockNumber,
              transactionHash: log.transactionHash
            }))
        })
        .reduce((acc, curr) => acc.concat(curr), [])

      setLogs(logsArr)

      // Fetch evidence files.
      archon.arbitrable
        .getEvidence(gtcrAddr, arbitrator.address, evidenceGroupID)
        .then(data =>
          data
            .filter(evidenceFile => evidenceFile.evidenceJSONValid)
            .filter(
              evidenceFile =>
                !evidenceFile.fileURI ||
                (evidenceFile.fileURI && evidenceFile.fileValid)
            )
            .map(evidenceFile =>
              setEvidenceFiles(evidenceFiles => ({
                ...evidenceFiles,
                [evidenceFile.transactionHash]: evidenceFile
              }))
            )
        )
        .catch(err => {
          console.error('Error fetching evidence files', err)
          setError('Error fetching evidence files')
        })

      // Fetch appealable rulings.
      logsArr
        .filter(
          log =>
            log.name === 'AppealPossible' &&
            disputeID.toNumber() === log.values._disputeID.toNumber()
        )
        .forEach(log =>
          arbitrator
            .currentRuling(disputeID, { blockTag: log.blockNumber })
            .then(currentRuling =>
              setAppealableRulings(appealableRulings => ({
                ...appealableRulings,
                [log.transactionHash]: currentRuling.toNumber()
              }))
            )
            .catch(err => {
              console.error(
                'Error fetching current ruling for appealable events',
                err
              )
            })
        )
    })()
  }, [
    arbitrator,
    archon,
    evidenceGroupID,
    fetchingLogs,
    gtcr,
    itemID,
    library,
    request,
    requestID,
    getLogs
  ])

  if (error) return <Result status="warning" title={error} />

  const {
    requestType,
    submissionTime,
    creationTx,
    resolutionTx,
    resolutionTime
  } = request ?? {}

  // Display loading indicator
  if (!item || !request || typeof requestType !== 'number')
    return <Skeleton active />

  const { metadata } = metaEvidence || {}

  // TODO: RequestSubmitted might need some refactoring.
  // Build nodes from request events.
  const itemName = metadata ? capitalizeFirstLetter(metadata.itemName) : 'Item'
  const requestSubmittedItem = (
    <AntdTimeline.Item key={0}>
      <span>
        <StyledText>
          {requestType === CONTRACT_STATUS.REGISTRATION_REQUESTED
            ? `${itemName} submitted`
            : 'Removal requested'}
        </StyledText>
        <Typography.Text type="secondary">
          <a href={getTxPage({ networkId, txHash: creationTx })}>
            - {new Date(new Date(submissionTime * 1000)).toGMTString()}
          </a>
        </Typography.Text>
      </span>
    </AntdTimeline.Item>
  )

  const sortedLogs = logs
    .sort((a, b) => a.blockNumber - b.blockNumber)
    .map(({ name, values, blockNumber, transactionHash }, i) => {
      const index = i + 1 // We add one here because the first item is the request submitted.
      const txPage = getTxPage({ networkId, txHash: transactionHash })
      if (name === 'Evidence') {
        const evidenceFile = evidenceFiles[transactionHash]
        if (!evidenceFile)
          return (
            <AntdTimeline.Item dot={<Icon type="file-text" />} key={index}>
              <StyledCard loading={!evidenceFile} />
            </AntdTimeline.Item>
          )
        const { submittedAt, submittedBy } = evidenceFile
        const { title, description, fileURI } = evidenceFile.evidenceJSON
        /* eslint-disable unicorn/new-for-builtins */
        const submissionTime = (
          <span>
            <a href={txPage}>
              Submitted {new Date(new Date(submittedAt * 1000)).toGMTString()}
            </a>{' '}
            by <ETHAddress address={submittedBy} />
          </span>
        )

        /* eslint-enable unicorn/new-for-builtins */
        return (
          <AntdTimeline.Item
            dot={<Icon type="file-text" />}
            key={index}
            color="grey"
          >
            <StyledCard
              title={title}
              extra={
                fileURI && (
                  <a
                    href={`${process.env.REACT_APP_IPFS_GATEWAY}${fileURI}`}
                    alt="evidence-file"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <StyledIcon type="file-text" />
                  </a>
                )
              }
            >
              <Card.Meta
                title={<StyledEvidenceTitle>{description}</StyledEvidenceTitle>}
                description={submissionTime}
              />
            </StyledCard>
          </AntdTimeline.Item>
        )
      } else if (name === 'AppealPossible') {
        const appealableRuling = appealableRulings[transactionHash]
        if (typeof appealableRuling === 'undefined')
          return (
            <AntdTimeline.Item dot={<Icon type="file-text" />} key={index}>
              <Skeleton active paragraph={false} title={{ width: '200px' }} />
            </AntdTimeline.Item>
          )

        return (
          <AntdTimeline.Item key={index}>
            <span>
              {appealableRuling === PARTY.NONE
                ? 'The arbitrator refused to rule'
                : appealableRuling === PARTY.REQUESTER
                ? `The arbitrator ruled in favor of the ${
                    requestType === CONTRACT_STATUS.REGISTRATION_REQUESTED
                      ? 'submitter'
                      : 'requester'
                  }`
                : appealableRuling === PARTY.CHALLENGER
                ? 'The arbitrator ruled in favor of the challenger'
                : 'The arbitrator gave an unknown ruling'}
              <Typography.Text type="secondary">
                <a href={txPage}>
                  <EventTimestamp blockNumber={blockNumber} />
                </a>
              </Typography.Text>
            </span>
          </AntdTimeline.Item>
        )
      } else if (name === 'AppealDecision')
        return (
          <AntdTimeline.Item key={index}>
            Ruling appealed{' '}
            <Typography.Text type="secondary">
              <a href={txPage}>
                <EventTimestamp blockNumber={blockNumber} />
              </a>
            </Typography.Text>
          </AntdTimeline.Item>
        )
      else if (name === 'Ruling') {
        let resultMessage
        const finalRuling = values._ruling.toNumber()
        switch (finalRuling) {
          case PARTY.NONE: {
            resultMessage =
              requestType === CONTRACT_STATUS.REGISTRATION_REQUESTED
                ? 'Submission rejected'
                : 'Removal refused'
            break
          }
          case PARTY.REQUESTER: {
            resultMessage =
              requestType === CONTRACT_STATUS.REGISTRATION_REQUESTED
                ? 'Submission accepted'
                : `${itemName || 'item'} removed.`
            break
          }
          case PARTY.CHALLENGER: {
            resultMessage =
              requestType === CONTRACT_STATUS.REGISTRATION_REQUESTED
                ? 'Submission rejected'
                : `Removal refused.`
            break
          }
          default:
            throw new Error('Unhandled ruling')
        }
        const finalStatus = getResultStatus({
          ruling: finalRuling,
          requestType: requestType
        })

        return (
          <AntdTimeline.Item key={index} color={STATUS_COLOR[finalStatus]}>
            {resultMessage}
            <Typography.Text type="secondary">
              <a href={txPage}>
                <EventTimestamp blockNumber={blockNumber} />
              </a>
            </Typography.Text>
          </AntdTimeline.Item>
        )
      } else throw new Error(`Unhandled event ${name}`)
    })

  const items = [requestSubmittedItem, ...sortedLogs]

  if (resolutionTime) {
    const resultMessage =
      item.status === STATUS_CODE.REGISTERED
        ? `${itemName || 'item'} accepted.`
        : `${itemName || 'item'} removed.`
    items.push(
      <AntdTimeline.Item key={items.length} color={STATUS_COLOR[item.status]}>
        {resultMessage}
        <Typography.Text type="secondary">
          <a href={getTxPage({ networkId, txHash: resolutionTx })}>
            ` - {new Date(new Date(resolutionTime * 1000)).toGMTString()}`
          </a>
        </Typography.Text>
      </AntdTimeline.Item>
    )
  }

  return <AntdTimeline>{items}</AntdTimeline>
}

export default Timeline
