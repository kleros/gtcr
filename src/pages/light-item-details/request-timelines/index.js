import React, { useContext, useState } from 'react'
import { Divider, Collapse, Row, Col, Button, Card } from 'antd'
import jsOrdinal from 'js-ordinal'
import styled from 'styled-components/macro'
import Timeline from './timeline'
import {
  REQUEST_TYPE_LABEL,
  hasPendingRequest
} from 'utils/helpers/item-status'
import EvidenceModal from '../modals/evidence'
import { WalletContext } from 'contexts/wallet-context'
import { capitalizeFirstLetter } from 'utils/helpers/string'
import { LightTCRViewContext } from 'contexts/light-tcr-view-context'

const StyledDivider = styled(Divider)`
  text-transform: capitalize;
`

const StyledButton = styled(Button)`
  text-transform: capitalize;
  margin: 16px 0;
`

const StyledCard = styled(Card)`
  margin-top: 40px;
`

const StyledCollapse = styled(Collapse)`
  background-color: white;
`

const RequestTimelines = ({ item, requests }) => {
  const { requestWeb3Auth } = useContext(WalletContext)
  const { metaEvidence } = useContext(LightTCRViewContext)
  const [evidenceModalOpen, setEvidenceModalOpen] = useState()

  const { metadata } = metaEvidence || {}
  const { itemName } = metadata || {}

  if (!item)
    return (
      <>
        <StyledCard loading id="request-timelines" />
      </>
    )

  return (
    <div id="request-timelines">
      {!hasPendingRequest(item.status) && (
        <StyledDivider orientation="left">{`${capitalizeFirstLetter(itemName) ||
          'Item'} History`}</StyledDivider>
      )}
      {hasPendingRequest(item.status) && (
        <Row gutter={16}>
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
                request={request}
                requestID={requests.length - i - 1}
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
