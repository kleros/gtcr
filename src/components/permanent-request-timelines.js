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
import { CONTRACT_STATUS, SUBGRAPH_RULING } from 'utils/permanent-item-status'
import { capitalizeFirstLetter } from 'utils/string'
import { getTxPage } from 'utils/network-utils'
import { parseIpfs } from 'utils/ipfs-parse'
import PermanentEvidenceModal from 'pages/permanent-item-details/modals/evidence'
import jsOrdinal from 'js-ordinal'
import { WalletContext } from 'contexts/wallet-context'

const StyledText = styled(Typography.Text)`
  text-transform: capitalize;
`

const StyledCard = styled(Card)`
  cursor: default;
  background: ${({ theme }) => theme.elevatedBackground} !important;
  border-color: ${({ theme }) => theme.borderColor} !important;

  & > .ant-card-head {
    background: ${({ theme }) => theme.cardBackground} !important;
    border-color: ${({ theme }) => theme.borderColor} !important;
    color: ${({ theme }) => theme.textPrimary} !important;
  }

  & > .ant-card-head .ant-card-head-title {
    color: ${({ theme }) => theme.textPrimary} !important;
  }

  & > .ant-card-body {
    background: ${({ theme }) => theme.elevatedBackground} !important;
  }

  .ant-card-meta-description {
    color: ${({ theme }) => theme.textSecondary} !important;
  }

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
  color: ${({ theme }) => theme.textPrimary};
`

const StyledIcon = styled(Icon)`
  color: ${({ theme }) => theme.primaryColor};
`

const secondTimestamp = timestamp =>
  ` - ${new Date(new Date(timestamp * 1000)).toGMTString()}`

const Timeline = ({ submission, item, metaEvidence }) => {
  const { networkId } = useWeb3Context()
  const [evidenceMap, setEvidenceMap] = useState()
  // this submission has a range associated createdAt finishedAt
  // take ALL data from the item
  // then filter out all data whose "inclusion" is not in the provided range.
  // there might be stuff to debug here once an item gets multiple submissions

  const logs = useMemo(() => {
    if (!submission) return null

    const allRounds = item.challenges.flatMap(c => c.rounds)

    const appealPossibles = allRounds
      .map(r => ({
        name: 'AppealPossible',
        timestamp: r.appealPeriodStart,
        transactionHash: r.txHashAppealPossible,
        appealableRuling: r.ruling
      }))
      .filter(appeal => !!appeal.transactionHash)

    const appealDecisions = allRounds
      .map(r => ({
        name: 'AppealDecision',
        timestamp: r.appealedAt,
        transactionHash: r.txHashAppealDecision
      }))
      .filter(appeal => !!appeal.transactionHash)

    const evidences = item.evidences.map(e => ({
      name: 'Evidence',
      timestamp: e.timestamp,
      transactionHash: e.txHash,
      title: e.metadata?.title,
      description: e.metadata?.description,
      URI: e.URI,
      fileURI: e.metadata?.fileURI,
      fileTypeExtension: e.metadata?.fileTypeExtension,
      party: e.party
    }))

    const resolutions = item.challenges.map(e => ({
      name: 'Resolution',
      timestamp: e.resolutionTime,
      transactionHash: e.resolutionTx,
      disputeOutcome: e.disputeOutcome,
      lastRoundRuling: e.rounds[0].ruling
    }))

    const challenges = item.challenges.map(e => ({
      name: 'Challenge',
      timestamp: e.createdAt,
      transactionHash: e.creationTx
    }))

    const logArray = [
      ...appealPossibles,
      ...appealDecisions,
      ...evidences,
      ...resolutions,
      ...challenges
    ]

    const withdrawal =
      Number(submission.withdrawingTimestamp) !== 0
        ? {
            name: 'Withdrawal',
            timestamp: submission.withdrawingTimestamp,
            transactionHash: submission.withdrawingTx
          }
        : null

    if (withdrawal) logArray.push(withdrawal)

    // purge then sort

    return logArray
      .filter(
        log =>
          Number(submission.createdAt) <= Number(log.timestamp) &&
          (submission.finishedAt === null ||
            Number(submission.finishedAt) >= Number(log.timestamp))
      )
      .sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
  }, [item, submission])

  // The Graph can fail to index the evidence fields. Load unloaded fields manually
  useEffect(() => {
    const evidenceManualFetch = async () => {
      const unindexedEvidenceURIs = logs
        .filter(e => e.metadata?.name === 'Evidence')
        .filter(
          e =>
            e.metadata?.title === null &&
            e.metadata?.description === null &&
            e.metadata?.fileURI === null &&
            e.metadata?.fileTypeExtension === null
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
  if (!item || !submission) return <Skeleton active />

  const { metadata } = metaEvidence || {}
  // Build nodes from request events.
  const itemName = metadata ? capitalizeFirstLetter(metadata.itemName) : 'Item'

  const requestSubmittedNode = (
    <AntdTimeline.Item key={1337}>
      <span>
        <StyledText>{`${itemName} submitted`}</StyledText>
        <Typography.Text type="secondary">
          <a href={getTxPage({ networkId, txHash: submission.creationTx })}>
            {secondTimestamp(submission.createdAt)}
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
                ? 'The arbitrator ruled in favor of the submitter'
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
            resultMessage = 'Item removed by non-rule'
            statusColor = 'red'
            break
          }
          case 'Accept': {
            resultMessage = 'Item accepted'
            statusColor = 'green'
            break
          }
          case 'Reject': {
            resultMessage = 'Item removed'
            statusColor = 'red'
            break
          }
          default:
            throw new Error('Unhandled ruling')
        }
        const differentAppealableRuling =
          event.lastRoundRuling !== event.disputeOutcome

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
      } else if (name === 'Challenge')
        return (
          <AntdTimeline.Item key={i}>
            <span>
              Item challenged
              <Typography.Text type="secondary">
                <a href={txPage}>{secondTimestamp(timestamp)}</a>
              </Typography.Text>
            </span>
          </AntdTimeline.Item>
        )
      else if (name === 'Withdrawal')
        return (
          <AntdTimeline.Item key={i} color="orange">
            <span>
              Item initiated withdrawal process
              <Typography.Text type="secondary">
                <a href={txPage}>{secondTimestamp(timestamp)}</a>
              </Typography.Text>
            </span>
          </AntdTimeline.Item>
        )
      else throw new Error(`Unhandled event ${name}`)
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
  background-color: ${({ theme }) => theme.componentBackground} !important;
`

const RequestTimelines = ({ item, metaEvidence }) => {
  const { requestWeb3Auth } = useContext(WalletContext)
  const [evidenceModalOpen, setEvidenceModalOpen] = useState()

  const { metadata } = metaEvidence || {}
  const { itemName } = metadata || {}
  const { submissions } = item || {}

  if (!item)
    return (
      <>
        <StyledLoadingCard loading id="request-timelines" />
      </>
    )

  return (
    <div id="request-timelines">
      <Row>
        <Col xs={14} sm={17} md={19} lg={20} xl={20} xxl={21}>
          <StyledDivider orientation="left">{`${capitalizeFirstLetter(
            itemName
          ) || 'Item'} History`}</StyledDivider>
        </Col>
        {item.status !== CONTRACT_STATUS.ABSENT && (
          <Col xs={5} sm={5} md={5} lg={4} xl={3} xxl={3}>
            <StyledButton
              onClick={() => requestWeb3Auth(() => setEvidenceModalOpen(true))}
            >
              Submit Evidence
            </StyledButton>
          </Col>
        )}
      </Row>

      {submissions && (
        <StyledCollapse bordered={false} defaultActiveKey={['0']}>
          {submissions.map((submission, i) => (
            <Collapse.Panel
              header={`${jsOrdinal.toOrdinal(
                submissions.length - i
              )} submission`}
              key={i}
            >
              {/* We spread `submissions` to convert it from an array to an object. */}
              <Timeline
                item={item}
                submission={{ ...submission }}
                metaEvidence={metaEvidence}
              />
            </Collapse.Panel>
          ))}
        </StyledCollapse>
      )}
      <PermanentEvidenceModal
        item={item}
        visible={evidenceModalOpen}
        onCancel={() => setEvidenceModalOpen(false)}
      />
    </div>
  )
}

export default RequestTimelines
