import React, { useContext, useState } from 'react'
import PropTypes from 'prop-types'
import { Divider, Collapse, Row, Col, Button, Card } from 'antd'
import jsOrdinal from 'js-ordinal'
import styled from 'styled-components/macro'
import Timeline from './timeline'
import itemPropTypes from '../../../prop-types/item'
import {
  REQUEST_TYPE_LABEL,
  hasPendingRequest
} from '../../../utils/item-status'
import EvidenceModal from '../modals/evidence'
import { WalletContext } from '../../../bootstrap/wallet-context'
import BNPropType from '../../../prop-types/bn'

const StyledButton = styled(Button)`
  margin: 16px 0;
`

const RequestTimelines = ({ item, requests }) => {
  const { requestWeb3Auth } = useContext(WalletContext)
  const [evidenceModalOpen, setEvidenceModalOpen] = useState()

  if (!item)
    return (
      <>
        <br />
        <Card loading />
      </>
    )

  return (
    <>
      {!hasPendingRequest(item.status) && (
        <Divider orientation="left">Timeline</Divider>
      )}
      {hasPendingRequest(item.status) && (
        <Row gutter={16}>
          <Col xs={14} sm={17} md={19} lg={20} xl={20} xxl={21}>
            <Divider orientation="left">Timeline</Divider>
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
        <Collapse bordered={false} defaultActiveKey={['0']}>
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
                requestID={requests.length - i - 1}
              />
            </Collapse.Panel>
          ))}
        </Collapse>
      )}
      <EvidenceModal
        item={item}
        visible={evidenceModalOpen}
        onCancel={() => setEvidenceModalOpen(false)}
      />
    </>
  )
}

RequestTimelines.propTypes = {
  item: itemPropTypes,
  requests: PropTypes.arrayOf(
    PropTypes.shape({
      arbitrator: PropTypes.string.isRequired,
      requestType: PropTypes.number.isRequired,
      disputed: PropTypes.bool.isRequired,
      resolved: PropTypes.bool.isRequired,
      metaEvidenceID: BNPropType.isRequired
    })
  )
}

RequestTimelines.defaultProps = {
  item: null,
  requests: null
}

export default RequestTimelines
