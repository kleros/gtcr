import React from 'react'
import styled from 'styled-components'
import { parseIpfs } from 'utils/ipfs-parse'
import { useAttachment } from 'hooks/use-attachment'
import { Button } from 'components/curate/primitives'

const FileButton = styled(Button)`
  gap: 6px;

  .long {
    display: inline;
  }

  .short {
    display: none;
  }

  @media (max-width: 640px) {
    .long {
      display: none;
    }

    .short {
      display: inline;
    }
  }
`

const Paperclip = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M21 11.5 12.5 20a5.5 5.5 0 0 1-7.8-7.8l9-9a3.5 3.5 0 0 1 5 5l-9 9a1.5 1.5 0 0 1-2.1-2.1L16 6.7"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

/**
 * "View attached file" button rendered next to an evidence entry. Shared
 * between classic/light (`request-timelines.tsx`) and permanent
 * (`permanent-request-timelines.tsx`). Opens the in-app attachment viewer.
 */
const EvidenceFileLink: React.FC<{ fileURI: string }> = ({ fileURI }) => {
  const openAttachment = useAttachment()
  return (
    <FileButton
      type="button"
      $variant="ghost"
      $size="sm"
      onClick={() => openAttachment(parseIpfs(fileURI))}
    >
      <Paperclip />
      <span className="long">View attached file</span>
      <span className="short">File</span>
    </FileButton>
  )
}

export default EvidenceFileLink
