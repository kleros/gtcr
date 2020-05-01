import React from 'react'
import { Link } from 'react-router-dom'
import PropTypes from 'prop-types'
import { Card } from 'antd'
import ItemStatusBadge from '../../components/item-status-badge'
import TCRCard from '../../components/tcr-card-content'
import ItemCardContent from '../../components/item-card-content'
import BNPropType from '../../prop-types/bn'
import ItemPropTypes from '../../prop-types/item'

const ItemCard = ({
  tcrAddress,
  item,
  challengePeriodDuration,
  timestamp,
  metaEvidence,
  key
}) => (
  <Link to={`/tcr/${tcrAddress}/${item.tcrData.ID}`} key={key}>
    <Card
      style={{ height: '100%' }}
      title={
        <ItemStatusBadge
          item={item.tcrData}
          challengePeriodDuration={challengePeriodDuration}
          timestamp={timestamp}
          dark
        />
      }
    >
      {metaEvidence.metadata.isTCRofTCRs ? (
        <TCRCard tcrAddress={item.columns[0].value} />
      ) : (
        <ItemCardContent item={item} />
      )}
    </Card>
  </Link>
)

ItemCard.propTypes = {
  key: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  tcrAddress: PropTypes.string.isRequired,
  challengePeriodDuration: BNPropType.isRequired,
  timestamp: BNPropType.isRequired,
  metaEvidence: PropTypes.shape({
    metadata: PropTypes.shape({
      isTCRofTCRs: PropTypes.bool
    }).isRequired
  }).isRequired,
  item: PropTypes.shape({
    tcrData: ItemPropTypes,
    columns: PropTypes.arrayOf(
      PropTypes.shape({
        value: PropTypes.string.isRequired
      })
    )
  }).isRequired
}

ItemCard.defaultProps = {
  key: 0
}

export default ItemCard
