import React, { useEffect, useContext, useState } from 'react'
import { Divider, Collapse, Skeleton, Row, Col, Button } from 'antd'
import jsOrdinal from 'js-ordinal'
import styled from 'styled-components/macro'
import { TCRViewContext } from '../../../bootstrap/tcr-view-context'
import Timeline from './timeline'
import itemPropTypes from '../../../prop-types/item'
import {
  REQUEST_TYPE_LABEL,
  hasPendingRequest
} from '../../../utils/item-status'
import EvidenceModal from '../modals/evidence'
import { WalletContext } from '../../../bootstrap/wallet-context'

const StyledButton = styled(Button)`
  margin: 16px 0;
`

const RequestTimelines = ({ item }) => {
  const { gtcrView, tcrAddress } = useContext(TCRViewContext)
  const { requestWeb3Auth } = useContext(WalletContext)
  const [requests, setRequests] = useState()
  const [evidenceModalOpen, setEvidenceModalOpen] = useState()
  const itemID = item && item.ID

  useEffect(() => {
    ;(async () => {
      try {
        if (!gtcrView || !tcrAddress || !itemID) return
        setRequests(await gtcrView.getItemRequests(tcrAddress, itemID))
      } catch (err) {
        console.error('Error fetching item requests', err)
      }
    })()
  }, [gtcrView, itemID, tcrAddress])

  if (!item) return <Skeleton active />

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
  item: itemPropTypes
}

RequestTimelines.defaultProps = {
  item: null
}

export default RequestTimelines
