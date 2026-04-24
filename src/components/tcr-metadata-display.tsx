import React from 'react'
import styled from 'styled-components'
import { Tooltip } from 'components/ui'
import Icon from 'components/ui/Icon'
import { ItemTypes } from '@kleros/gtcr-encoder'
import DisplaySelector from './display-selector'
import { parseIpfs } from 'utils/ipfs-parse'
import { useAttachment } from 'hooks/use-attachment'
import { buttonReset } from 'styles/button-reset'

const StyledField = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 16px;
  margin-right: 16px;
  word-break: break-word;

  div {
    margin: 0;
  }
`

const InlineLinkButton = styled.button`
  ${buttonReset}
  color: ${({ theme }) => theme.linkColor};
  text-decoration: underline;

  &:hover {
    color: ${({ theme }) => theme.primaryColorHover};
  }
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
}: TCRMetadataDisplayProps) => {
  const openAttachment = useAttachment()
  return (
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
        <InlineLinkButton
          type="button"
          onClick={() => openAttachment(parseIpfs(fileURI))}
        >
          Link
        </InlineLinkButton>
      </StyledField>
    </>
  )
}

export default TCRMetadataDisplay
