import PropTypes from 'prop-types'
import BNPropType from './bn'

const ItemPropTypes = PropTypes.shape({
  ID: PropTypes.string.isRequired,
  status: PropTypes.number.isRequired,
  disputed: PropTypes.bool.isRequired,
  disputeStatus: PropTypes.number.isRequired,
  hasPaid: PropTypes.arrayOf(PropTypes.bool).isRequired,
  data: PropTypes.string.isRequired,
  decodedData: PropTypes.array,
  currentRuling: PropTypes.number.isRequired,
  appealStart: BNPropType.isRequired,
  appealEnd: BNPropType.isRequired,
  submissionTime: BNPropType.isRequired,
  paidFees: PropTypes.arrayOf(BNPropType).isRequired
})

export default ItemPropTypes
