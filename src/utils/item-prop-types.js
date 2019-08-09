import PropTypes from 'prop-types'

export default PropTypes.shape({
  status: PropTypes.number.isRequired,
  disputed: PropTypes.bool.isRequired,
  disputeStatus: PropTypes.number.isRequired,
  hasPaid: PropTypes.arrayOf(PropTypes.bool).isRequired,
  data: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.bool,
    PropTypes.number,
    PropTypes.shape({})
  ]).isRequired,

  // BN.js instances
  currentRuling: PropTypes.shape({}).isRequired,
  appealStart: PropTypes.shape({}).isRequired,
  appealEnd: PropTypes.shape({}).isRequired,
  submissionTime: PropTypes.shape({}).isRequired
})
