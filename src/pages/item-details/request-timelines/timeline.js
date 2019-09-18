import React, { useMemo, useEffect, useContext, useState } from 'react'
import { Timeline as AntdTimeline, Icon, Card, Skeleton } from 'antd'
import { useWeb3Context } from 'web3-react'
import { ethers } from 'ethers'
import Archon from '@kleros/archon'
import styled from 'styled-components/macro'
import { solidityKeccak256, bigNumberify } from 'ethers/utils'
import PropTypes from 'prop-types'
import { abi as _arbitrator } from '@kleros/tcr/build/contracts/Arbitrator.json'
import { TCRViewContext } from '../../../bootstrap/tcr-view-context'
import ETHAddress from '../../../components/eth-address'
import itemPropTypes from '../../../prop-types/item'
import {
  CONTRACT_STATUS,
  STATUS_CODE,
  PARTY,
  STATUS_COLOR,
  getResultStatus
} from '../../../utils/item-status'

const StyledCard = styled(Card)`
  cursor: default;
`

const StyledEvidenceTitle = styled.div`
  white-space: pre-line;
  font-weight: 400;
`

const Timeline = ({ request, requestID, item }) => {
  const { library, connector, active } = useWeb3Context()
  const { gtcr, metaEvidence } = useContext(TCRViewContext)
  const [logs, setLogs] = useState([])
  const [appealableRulings, setAppealableRulings] = useState({})
  const [evidenceFiles, setEvidenceFiles] = useState({})
  const arbitrator = useMemo(() => {
    if (!request || !library || !active) return
    return new ethers.Contract(request.arbitrator, _arbitrator, library)
  }, [library, request, active])
  const archon = useMemo(() => {
    if (!library || !connector || !connector.providerURL) return
    const { providerURL } = connector
    return new Archon(providerURL, process.env.REACT_APP_IPFS_GATEWAY)
  }, [connector, library])
  const itemID = item && item.ID
  const evidenceGroupID = useMemo(() => {
    if (!itemID || requestID == null) return
    return bigNumberify(
      solidityKeccak256(['bytes32', 'uint'], [itemID, requestID])
    )
  }, [itemID, requestID])

  // Fetch logs
  useEffect(() => {
    if (
      !request ||
      !arbitrator ||
      !gtcr ||
      !archon ||
      !itemID ||
      !evidenceGroupID
    )
      return

    const { disputeID, disputed } = request
    const { address: gtcrAddr } = gtcr

    try {
      ;(async () => {
        // Fetch logs in parallel.
        let logs = (await Promise.all([
          library.getLogs({
            ...gtcr.filters.Evidence(request.arbitrator, evidenceGroupID),
            fromBlock: 0
          }),
          disputed
            ? library.getLogs({
                ...gtcr.filters.Ruling(request.arbitrator, disputeID),
                fromBlock: 0
              })
            : null,
          disputed
            ? library.getLogs({
                ...arbitrator.filters.AppealPossible(disputeID, gtcrAddr),
                fromBlock: 0
              })
            : null,
          disputed
            ? library.getLogs({
                ...arbitrator.filters.AppealDecision(disputeID, gtcrAddr),
                fromBlock: 0
              })
            : null
        ])).filter(logs => !!logs)

        // Parse and sort event logs.
        logs = logs
          .map((e, i) => {
            if (i <= 1)
              return e.map(log => ({
                ...gtcr.interface.parseLog(log),
                blockNumber: log.blockNumber,
                transactionHash: log.transactionHash
              }))
            else
              return e.map(log => ({
                ...arbitrator.interface.parseLog(log),
                blockNumber: log.blockNumber,
                transactionHash: log.transactionHash
              }))
          })
          .reduce((acc, curr) => acc.concat(curr), [])

        setLogs(logs)

        // Fetch evidence files.
        archon.arbitrable
          .getEvidence(gtcrAddr, request.arbitrator, evidenceGroupID)
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

        // Fetch appealable rulings.
        logs
          .filter(log => log.name === 'AppealPossible')
          .forEach(log => {
            arbitrator
              .currentRuling(disputeID, { blockTag: log.blockNumber })
              .then(currentRuling => {
                setAppealableRulings(appealableRulings => ({
                  ...appealableRulings,
                  [log.transactionHash]: currentRuling.toNumber()
                }))
              })
          })
      })()
    } catch (err) {
      console.error('Error fetching request data', err)
    }
  }, [
    arbitrator,
    archon,
    evidenceGroupID,
    gtcr,
    itemID,
    library,
    request,
    requestID
  ])

  // Display loading indicator
  if (!item || !request) return <Skeleton active />
  const { requestType } = request

  // Build nodes from request events.
  const itemName = metaEvidence ? metaEvidence.itemName : 'Item'
  let items = [
    <AntdTimeline.Item key="first-node">
      {requestType === CONTRACT_STATUS.REGISTRATION_REQUESTED
        ? `${itemName} submitted`
        : 'Removal requested'}
    </AntdTimeline.Item>
  ].concat(
    logs
      .sort((a, b) => a.blockNumber - b.blockNumber)
      .map((log, i) => {
        if (log.name === 'Evidence') {
          const evidenceFile = evidenceFiles[log.transactionHash]
          if (!evidenceFile)
            return (
              <AntdTimeline.Item dot={<Icon type="file-text" />} key={i}>
                <StyledCard loading={!evidenceFile} hoverable />
              </AntdTimeline.Item>
            )
          const { submittedAt, submittedBy } = evidenceFile
          const { title, description, fileURI } = evidenceFile.evidenceJSON
          /* eslint-disable unicorn/new-for-builtins */
          const submissionTime = (
            <span>
              Submitted {new Date(Date(submittedAt * 1000)).toGMTString()} by{' '}
              <ETHAddress address={submittedBy} />
            </span>
          )

          /* eslint-enable unicorn/new-for-builtins */
          return (
            <AntdTimeline.Item
              dot={<Icon type="file-text" />}
              key={i}
              color="grey"
            >
              <StyledCard
                hoverable
                title={title}
                extra={
                  fileURI && (
                    <a
                      href={`${process.env.REACT_APP_IPFS_GATEWAY}/${fileURI}`}
                      alt="evidence-file"
                    >
                      <Icon type="file-text" />
                    </a>
                  )
                }
              >
                <Card.Meta
                  title={
                    <StyledEvidenceTitle>{description}</StyledEvidenceTitle>
                  }
                  description={submissionTime}
                />
              </StyledCard>
            </AntdTimeline.Item>
          )
        } else if (log.name === 'AppealPossible') {
          const appealableRuling = appealableRulings[log.transactionHash]
          if (!appealableRuling)
            return (
              <AntdTimeline.Item dot={<Icon type="file-text" />} key={i}>
                <Skeleton active paragraph={false} title={{ width: '200px' }} />
              </AntdTimeline.Item>
            )

          return (
            <AntdTimeline.Item key={i}>
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
            </AntdTimeline.Item>
          )
        } else if (log.name === 'AppealDecision')
          return <AntdTimeline.Item key={i}>Ruling appealed</AntdTimeline.Item>
        else if (log.name === 'Ruling') {
          let resultMessage
          const finalRuling = log.values._ruling.toNumber()
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
            requestType
          })

          return (
            <AntdTimeline.Item key={i} color={STATUS_COLOR[finalStatus]}>
              {resultMessage}
            </AntdTimeline.Item>
          )
        } else throw new Error('Unhandled event')
      })
  )

  if (request.resolved && !request.disputed)
    items = items.concat(
      <AntdTimeline.Item
        key={items.length}
        color={
          requestType === CONTRACT_STATUS.REGISTRATION_REQUESTED
            ? STATUS_COLOR[STATUS_CODE.REGISTERED]
            : STATUS_COLOR[STATUS_CODE.REJECTED]
        }
      >
        {`${(metaEvidence && metaEvidence.itemName) || 'Item'} ${
          requestType === CONTRACT_STATUS.REGISTRATION_REQUESTED
            ? 'accepted'
            : 'removed'
        }`}
      </AntdTimeline.Item>
    )

  return (
    <AntdTimeline
      pending={
        item.status !== STATUS_CODE.REJECTED &&
        item.status !== STATUS_CODE.REGISTERED &&
        !request.resolved
      }
    >
      {items}
    </AntdTimeline>
  )
}

Timeline.propTypes = {
  request: PropTypes.shape({
    arbitrator: PropTypes.string.isRequired,
    requestType: PropTypes.number.isRequired,
    disputed: PropTypes.bool.isRequired,
    resolved: PropTypes.bool.isRequired
  }).isRequired,
  requestID: PropTypes.number.isRequired,
  item: itemPropTypes
}

Timeline.defaultProps = {
  item: null
}

export default Timeline
