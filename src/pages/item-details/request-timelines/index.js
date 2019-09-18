import React, { useEffect, useContext, useState } from 'react'
import { Divider, Collapse, Skeleton } from 'antd'
import jsOrdinal from 'js-ordinal'
import { TCRViewContext } from '../../../bootstrap/tcr-view-context'
import Timeline from './timeline'
import itemPropTypes from '../../../prop-types/item'
import { REQUEST_TYPE_LABEL } from '../../../utils/item-status'

const RequestTimelines = ({ item }) => {
  const { gtcrView, tcrAddress } = useContext(TCRViewContext)
  const [requests, setRequests] = useState()
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

  return (
    <>
      <Divider orientation="left">Timeline</Divider>
      {requests ? (
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
      ) : (
        <Skeleton active />
      )}
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
