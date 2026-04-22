import React, { useMemo } from 'react'
import styled from 'styled-components'
import DocViewer, { DocViewerRenderers } from '@cyntler/react-doc-viewer'
import '@cyntler/react-doc-viewer/dist/index.css'
import MarkdownRenderer from './markdown-viewer'

const Wrapper = styled.div`
  background-color: ${({ theme }) => theme.componentBackground};
  border-radius: 3px;
  box-shadow: 0px 2px 8px ${({ theme }) => theme.cardShadow};
  max-height: 80vh;
  overflow: auto;
`

const StyledDocViewer = styled(DocViewer)`
  background-color: ${({ theme }) => theme.componentBackground} !important;
`

interface FileViewerProps {
  url: string
}

/**
 * In-app viewer for policies, evidence attachments, and arbitrary
 * file-URI links. Supports PDFs, images, markdown, plaintext, and
 * common document formats via `@cyntler/react-doc-viewer`.
 */
const FileViewer: React.FC<FileViewerProps> = ({ url }) => {
  const docs = useMemo(() => [{ uri: url }], [url])

  const pluginRenderers = useMemo(
    () => [...DocViewerRenderers, MarkdownRenderer],
    [],
  )

  const config = useMemo(
    () => ({
      header: {
        disableHeader: true,
        disableFileName: true,
      },
      pdfZoom: {
        defaultZoom: 0.8,
        zoomJump: 0.1,
      },
      pdfVerticalScrollByDefault: true,
    }),
    [],
  )

  return (
    <Wrapper className="file-viewer-wrapper">
      <StyledDocViewer
        documents={docs}
        pluginRenderers={pluginRenderers}
        config={config}
      />
    </Wrapper>
  )
}

export default FileViewer
