import React from 'react'
import styled from 'styled-components'
import { Tooltip } from 'components/ui'
import Icon from 'components/ui/icon'
import { ItemTypes } from '@kleros/gtcr-encoder'
import DisplaySelector from './display-selector'
import { parseIpfs } from 'utils/ipfs-parse'

const StyledField = styled.div`
  margin-bottom: 16px;
  margin-right: 16px;
  word-break: break-word;
`

interface TCRMetadataDisplayProps {
  logoURI?: string | null
  tcrTitle: string
  tcrDescription: string
  fileURI: string
}

const TCRMetadataDisplay = ({
  logoURI,
  tcrTitle,
  tcrDescription,
  fileURI,
}: TCRMetadataDisplayProps) => (
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

export default TCRMetadataDisplay
