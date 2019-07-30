import React from 'react'
import PropTypes from 'prop-types'
import StyledLayoutContent from '../layout-content'
import ErrorPage from '../error-page'

const Items = ({
  match: {
    params: { tcrAddress }
  }
}) => {
  if (!tcrAddress)
    return (
      <ErrorPage
        code="400"
        message="A TCR was not found at this address. Are you in the correct network?"
      />
    )

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
