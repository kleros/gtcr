import React from 'react'
import { Link } from 'react-router-dom'
import PropTypes from 'prop-types'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import styled from 'styled-components/macro'
import { utils } from 'ethers'

const StyledIcon = styled(FontAwesomeIcon)`
  margin-left: 6px;
  margin-bottom: 2px;
`

const StyledLink = styled(Link)`
  text-decoration: underline;
`

const GTCRAddress = ({ address }) => (
  <StyledLink to={`/tcr/${utils.getAddress(address)}`}>
    Visit TCR
    <StyledIcon icon="external-link-alt" />
  </StyledLink>
)

GTCRAddress.propTypes = {
  address: PropTypes.string.isRequired
}

export default GTCRAddress
