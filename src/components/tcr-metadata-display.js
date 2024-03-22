import React from 'react'
import styled from 'styled-components'
import { Icon, Tooltip } from 'antd'
import { ItemTypes } from '@kleros/gtcr-encoder'
import PropTypes from 'prop-types'
import DisplaySelector from './display-selector'
import { parseIpfs } from 'utils/ipfs-parse'

const StyledField = styled.div`
  margin-bottom: 16px;
  margin-right: 16px;
  word-break: break-word;
`

const TCRMetadataDisplay = ({ logoURI, tcrTitle, tcrDescription, fileURI }) => (
  <>
    <StyledField>
      <span>
        Logo:
        <Tooltip title="The list logo.">
          &nbsp;
          <Icon type="question-circle-o" />
        </Tooltip>
      </span>
      : <DisplaySelector type={ItemTypes.IMAGE} linkImage value={logoURI} />
    </StyledField>
    <StyledField>
      <span>
        Title
        <Tooltip title="The list title.">
          &nbsp;
          <Icon type="question-circle-o" />
        </Tooltip>
      </span>
      : <DisplaySelector type={ItemTypes.TEXT} value={tcrTitle} />
    </StyledField>
    <StyledField>
      <span>
        Description
        <Tooltip title="The list description.">
          &nbsp;
          <Icon type="question-circle-o" />
        </Tooltip>
      </span>
      : <DisplaySelector type={ItemTypes.TEXT} value={tcrDescription} />
    </StyledField>
    <StyledField>
      <span>
        Primary document
        <Tooltip title="The primary document used by this list.">
          &nbsp;
          <Icon type="question-circle-o" />
        </Tooltip>
      </span>
      :{' '}
      <a href={parseIpfs(fileURI)} target="_blank" rel="noopener noreferrer">
        Link
      </a>
    </StyledField>
  </>
)

TCRMetadataDisplay.propTypes = {
  tcrTitle: PropTypes.string.isRequired,
  tcrDescription: PropTypes.string.isRequired,
  logoURI: PropTypes.string,
  fileURI: PropTypes.string.isRequired
}

TCRMetadataDisplay.defaultProps = {
  logoURI: null
}

export default TCRMetadataDisplay
