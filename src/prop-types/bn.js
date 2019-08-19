import PropTypes from 'prop-types'

const BNPropType = PropTypes.shape({
  add: PropTypes.func.isRequired,
  mul: PropTypes.func.isRequired
})

export default BNPropType
