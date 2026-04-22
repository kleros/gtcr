import React from 'react'
import styled from 'styled-components'
import { type DocRenderer } from '@cyntler/react-doc-viewer'
import ReactMarkdown from 'react-markdown'

const Container = styled.div`
  padding: 16px;
`

const StyledMarkdown = styled(ReactMarkdown)`
  background-color: ${({ theme }) => theme.componentBackground};
  color: ${({ theme }) => theme.textPrimary};

  a {
    font-size: 16px;
    color: ${({ theme }) => theme.linkColor};
  }

  code {
    color: ${({ theme }) => theme.textSecondary};
  }
`

const MarkdownRenderer: DocRenderer = ({ mainState: { currentDocument } }) => {
  if (!currentDocument) return null
  const fileData = currentDocument.fileData as string
  const base64String = fileData.includes(',')
    ? fileData.split(',')[1]
    : fileData
  const decodedData = atob(base64String)

  return (
    <Container id="md-renderer">
      <StyledMarkdown>{decodedData}</StyledMarkdown>
    </Container>
  )
}

MarkdownRenderer.fileTypes = ['md', 'text/plain']
MarkdownRenderer.weight = 1

export default MarkdownRenderer
