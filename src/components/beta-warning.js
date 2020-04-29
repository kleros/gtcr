import React from 'react'
import styled from 'styled-components/macro'

const StyledWarning = styled.div`
  background: yellow;
  padding: 0 10%;
`

const WarningBanner = () => (
  <StyledWarning>
    Warning: This is beta software. There is a{' '}
    <a
      href="https://github.com/kleros/tcr/issues/20"
      target="_blank"
      rel="noopener noreferrer"
    >
      live bug bounty on the contracts
    </a>{' '}
    used by Curate.
  </StyledWarning>
)

export default WarningBanner
