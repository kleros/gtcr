import React from 'react'
import PropTypes from 'prop-types'
import StyledLayoutContent from '../layout-content'
import NotFound from '../not-found'

const Items = ({
  match: {
    params: { tcrAddress }
  }
}) => {
  if (!tcrAddress) return <NotFound />

  return (
    <StyledLayoutContent>
      <div>TODO</div>
    </StyledLayoutContent>
  )
}

Items.propTypes = {
  match: PropTypes.shape({
    params: PropTypes.objectOf(PropTypes.string)
  }).isRequired
}

export default Items
