import React from 'react'
import styled, { css } from 'styled-components'
import { smallScreenStyle } from 'styles/small-screen-style'
import { buttonReset } from 'styles/button-reset'
import { parseIpfs } from 'utils/ipfs-parse'
import { useAttachment } from 'hooks/use-attachment'
import PaperclipIcon from 'assets/icons/paperclip.svg?react'

const StyledFileLink = styled.button`
  ${buttonReset}
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  color: ${({ theme }) => theme.cardHeaderLinkColor};

  &:hover {
    color: ${({ theme }) => theme.cardHeaderLinkHoverColor};
    text-decoration: none !important;
  }
`

const DesktopText = styled.span`
  ${smallScreenStyle(
    () => css`
      display: none;
    `,
  )}
`

const MobileText = styled.span`
  display: none;
  ${smallScreenStyle(
    () => css`
      display: inline;
    `,
  )}
`

/**
 * "View attached file" button rendered in the evidence timeline card
 * extras slot. Shared between classic/light (`request-timelines.tsx`)
 * and permanent (`permanent-request-timelines.tsx`).
 */
const EvidenceFileLink: React.FC<{ fileURI: string }> = ({ fileURI }) => {
  const openAttachment = useAttachment()
  return (
    <StyledFileLink
      type="button"
      onClick={() => openAttachment(parseIpfs(fileURI))}
    >
      <PaperclipIcon />
      <DesktopText>View attached file</DesktopText>
      <MobileText>File</MobileText>
    </StyledFileLink>
  )
}

export default EvidenceFileLink
