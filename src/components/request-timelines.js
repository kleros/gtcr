import React, { useMemo, useContext, useState, useEffect } from 'react'
import styled, { css } from 'styled-components'
import { responsiveSize } from 'styles/responsive-size'
import { smallScreenStyle } from 'styles/small-screen-style'
import {
  Timeline as AntdTimeline,
  Icon,
  Card,
  Skeleton,
  Typography,
  Divider,
  Button,
  Collapse,
  Row,
  Col
} from 'antd'
import { useWeb3Context } from 'web3-react'
import ETHAddress from 'components/eth-address'
import {
  CONTRACT_STATUS,
  REQUEST_TYPE_LABEL,
  SUBGRAPH_RULING,
  hasPendingRequest
} from 'utils/item-status'
import { capitalizeFirstLetter } from 'utils/string'
import { getTxPage } from 'utils/network-utils'
import { parseIpfs } from 'utils/ipfs-parse'
import ClassicEvidenceModal from 'pages/item-details/modals/evidence'
import LightEvidenceModal from 'pages/light-item-details/modals/evidence'
import jsOrdinal from 'js-ordinal'
import { WalletContext } from 'contexts/wallet-context'

const StyledText = styled(Typography.Text)`
  text-transform: capitalize;
`

const StyledCard = styled(Card)`
  cursor: default;

  ${smallScreenStyle(
    () => css`
      & > .ant-card-head > .ant-card-head-wrapper > .ant-card-head-title {
        max-width: ${responsiveSize(160, 450)};
      }
    `
  )}
`

const StyledEvidenceTitle = styled.div`
  white-space: pre-line;
  font-weight: 400;
  color: #4d00b4;
`

const StyledIcon = styled(Icon)`
  color: #fff;
`

const secondTimestamp = timestamp =>
  ` - ${new Date(new Date(timestamp * 1000)).toGMTString()}`

const Timeline = ({ request, item, metaEvidence }) => {
  const { networkId } = useWeb3Context()
  const [evidenceMap, setEvidenceMap] = useState()

  const logs = useMemo(() => {
    if (!request) return null

    const appealPossibles = request.rounds
      .map(r => ({
        name: 'AppealPossible',
        timestamp: r.appealPeriodStart,
        transactionHash: r.txHashAppealPossible,
        appealableRuling: r.ruling
      }))
      .filter(appeal => !!appeal.transactionHash)

    const appealDecisions = request.rounds
      .map(r => ({
        name: 'AppealDecision',
        timestamp: r.appealedAt,
        transactionHash: r.txHashAppealDecision
      }))
      .filter(appeal => !!appeal.transactionHash)

    const evidences = request.evidenceGroup.evidences.map(e => ({
      name: 'Evidence',
      timestamp: e.timestamp,
      transactionHash: e.txHash,
      title: e.title,
      description: e.description,
      URI: e.uri,
      fileURI: e.fileURI,
      fileTypeExtension: e.fileTypeExtension,
      party: e.party
    }))

    const resolution = {
      name: 'Resolution',
      timestamp: request.resolutionTime,
      transactionHash: request.resolutionTx,
      disputeOutcome: !request.disputed
        ? SUBGRAPH_RULING.ACCEPT
        : request.disputeOutcome
    }

    const logArray = [...appealPossibles, ...appealDecisions, ...evidences]

    if (resolution.transactionHash) logArray.push(resolution)

    return logArray.sort((a, b) => a.timestamp - b.timestamp)
  }, [request])

  const requestType = request.requestType

  // The Graph can fail to index the evidence fields. Load unloaded fields manually
  useEffect(() => {
    const evidenceManualFetch = async () => {
      const unindexedEvidenceURIs = logs
        .filter(e => e.name === 'Evidence')
        .filter(
          e =>
            e.title === null &&
            e.description === null &&
            e.fileURI === null &&
            e.fileTypeExtension === null
        )
        .map(e => e.URI)

      const evidenceJSONs = await Promise.all(
        unindexedEvidenceURIs.map(async uri => {
          const file = await (await fetch(parseIpfs(uri))).json()
          return file
        })
      )
      const evidenceMapProcess = {}
      unindexedEvidenceURIs.forEach((uri, index) => {
        evidenceMapProcess[uri] = evidenceJSONs[index]
      })
      setEvidenceMap(evidenceMapProcess)
    }
    if (!logs || evidenceMap) return
    evidenceManualFetch()
  }, [logs, evidenceMap, setEvidenceMap])

  // Display loading indicator
  if (!item || !request) return <Skeleton active />

  const { metadata } = metaEvidence || {}
  // Build nodes from request events.
  const itemName = metadata ? capitalizeFirstLetter(metadata.itemName) : 'Item'

  const requestSubmittedNode = (
    <AntdTimeline.Item key={1337}>
      <span>
        <StyledText>
          {requestType === 'RegistrationRequested'
            ? `${itemName} submitted`
            : 'Removal requested'}
        </StyledText>
        <Typography.Text type="secondary">
          <a href={getTxPage({ networkId, txHash: request.creationTx })}>
            {secondTimestamp(request.submissionTime)}
          </a>
        </Typography.Text>
      </span>
    </AntdTimeline.Item>
  )

  const items = logs
    .sort((a, b) => a.blockNumber - b.blockNumber)
    .map((event, i) => {
      const { name, transactionHash, timestamp } = event
      const txPage = getTxPage({ networkId, txHash: transactionHash })

      if (name === 'Evidence') {
        const { party } = event
        const { title, description, fileURI } = evidenceMap?.[event.URI]
          ? evidenceMap[event.URI]
          : event
        /* eslint-disable unicorn/new-for-builtins */
        const submissionTime = (
          <span>
            <a href={txPage}>Submitted{secondTimestamp(timestamp)}</a> by{' '}
            <ETHAddress address={party} />
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
              title={title}
              extra={
                fileURI && (
                  <a
                    href={parseIpfs(fileURI)}
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
        const appealableRuling = event.appealableRuling
        if (typeof appealableRuling === 'undefined')
          return (
            <AntdTimeline.Item dot={<Icon type="file-text" />} key={i}>
              <Skeleton active paragraph={false} title={{ width: '200px' }} />
            </AntdTimeline.Item>
          )

        return (
          <AntdTimeline.Item key={i}>
            <span>
              {appealableRuling === SUBGRAPH_RULING.NONE
                ? 'The arbitrator refused to rule'
                : appealableRuling === SUBGRAPH_RULING.ACCEPT
                ? `The arbitrator ruled in favor of the ${
                    requestType === CONTRACT_STATUS.REGISTRATION_REQUESTED
                      ? 'submitter'
                      : 'requester'
                  }`
                : appealableRuling === SUBGRAPH_RULING.REJECT
                ? 'The arbitrator ruled in favor of the challenger'
                : 'The arbitrator gave an unknown ruling'}
              <Typography.Text type="secondary">
                <a href={txPage}>{secondTimestamp(timestamp)}</a>
              </Typography.Text>
            </span>
          </AntdTimeline.Item>
        )
      } else if (name === 'AppealDecision')
        return (
          <AntdTimeline.Item key={i}>
            Ruling appealed{' '}
            <Typography.Text type="secondary">
              <a href={txPage}>{secondTimestamp(timestamp)}</a>
            </Typography.Text>
          </AntdTimeline.Item>
        )
      else if (name === 'Resolution') {
        let resultMessage, statusColor
        switch (event.disputeOutcome) {
          case 'None': {
            resultMessage =
              requestType === CONTRACT_STATUS.REGISTRATION_REQUESTED
                ? 'Submission rejected'
                : 'Removal refused'
            statusColor =
              requestType === CONTRACT_STATUS.REGISTRATION_REQUESTED
                ? 'red'
                : 'green'
            break
          }
          case 'Accept': {
            resultMessage =
              requestType === CONTRACT_STATUS.REGISTRATION_REQUESTED
                ? 'Submission accepted'
                : `${itemName || 'item'} removed.`

            statusColor =
              requestType === CONTRACT_STATUS.REGISTRATION_REQUESTED
                ? 'green'
                : 'red'
            break
          }
          case 'Reject': {
            resultMessage =
              requestType === CONTRACT_STATUS.REGISTRATION_REQUESTED
                ? 'Submission rejected'
                : `Removal refused.`

            statusColor =
              requestType === CONTRACT_STATUS.REGISTRATION_REQUESTED
                ? 'red'
                : 'green'
            break
          }
          default:
            throw new Error('Unhandled ruling')
        }
        const differentAppealableRuling =
          request.disputed &&
          request.rounds[0].ruling !== request.disputeOutcome

        return (
          <AntdTimeline.Item key={i} color={statusColor}>
            {differentAppealableRuling &&
              'The winner of the last round did not fund the appeal. '}
            {resultMessage}
            <Typography.Text type="secondary">
              <a href={txPage}>{secondTimestamp(timestamp)}</a>
            </Typography.Text>
          </AntdTimeline.Item>
        )
      } else throw new Error(`Unhandled event ${name}`)
    })

  return <AntdTimeline>{[requestSubmittedNode, ...items]}</AntdTimeline>
}

const StyledDivider = styled(Divider)`
  text-transform: capitalize;
`

const StyledButton = styled(Button)`
  text-transform: capitalize;
  margin: 16px 0;
`

const StyledLoadingCard = styled(Card)`
  margin-top: 40px;
`

const StyledCollapse = styled(Collapse)`
  background-color: white !important;
`

const RequestTimelines = ({ item, requests, kind, metaEvidence }) => {
  const { requestWeb3Auth } = useContext(WalletContext)
  const [evidenceModalOpen, setEvidenceModalOpen] = useState()
  const EvidenceModal =
    kind === 'classic' ? ClassicEvidenceModal : LightEvidenceModal

  const { metadata } = metaEvidence || {}
  const { itemName } = metadata || {}

  if (!item)
    return (
      <>
        <StyledLoadingCard loading id="request-timelines" />
      </>
    )

  return (
    <div id="request-timelines">
      {!hasPendingRequest(item.status) && (
        <StyledDivider orientation="left">{`${capitalizeFirstLetter(itemName) ||
          'Item'} History`}</StyledDivider>
      )}
      {hasPendingRequest(item.status) && (
        <Row>
          <Col xs={14} sm={17} md={19} lg={20} xl={20} xxl={21}>
            <StyledDivider orientation="left">{`${capitalizeFirstLetter(
              itemName
            ) || 'Item'} History`}</StyledDivider>
          </Col>
          <Col xs={5} sm={5} md={5} lg={4} xl={3} xxl={3}>
            <StyledButton
              onClick={() => requestWeb3Auth(() => setEvidenceModalOpen(true))}
            >
              Submit Evidence
            </StyledButton>
          </Col>
        </Row>
      )}
      {requests && (
        <StyledCollapse bordered={false} defaultActiveKey={['0']}>
          {requests.map((request, i) => (
            <Collapse.Panel
              header={`${jsOrdinal.toOrdinal(requests.length - i)} request - ${
                REQUEST_TYPE_LABEL[request.requestType]
              }`}
              key={i}
            >
              {/* We spread `requests` to convert it from an array to an object. */}
              <Timeline
                item={item}
                request={{ ...request }}
                metaEvidence={metaEvidence}
              />
            </Collapse.Panel>
          ))}
        </StyledCollapse>
      )}
      <EvidenceModal
        item={item}
        visible={evidenceModalOpen}
        onCancel={() => setEvidenceModalOpen(false)}
      />
    </div>
  )
}

export default RequestTimelines
