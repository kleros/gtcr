import React from 'react'
import PropTypes from 'prop-types'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import styled from 'styled-components/macro'
import { utils } from 'ethers'
import { Button } from 'antd'

const StyledIcon = styled(FontAwesomeIcon)`
  margin-left: 6px;
  margin-bottom: 2px;
`

const StyledButton = styled(Button)`
  pointer-events: auto;
`

const GTCRAddress = ({ address }) => (
  <StyledButton
    href={`/tcr/${utils.getAddress(address)}`}
    target="_blank"
    rel="noopener noreferrer"
  >
    Visit TCR
    <StyledIcon icon="external-link-alt" />
  </StyledButton>
)

GTCRAddress.propTypes = {
  address: PropTypes.string.isRequired
}

export default GTCRAddress
