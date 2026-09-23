import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import styled from 'styled-components'
import ExternalLinkWarning from 'components/external-link-warning'
import { isSafeNavigationUrl } from 'utils/url-validation'

const MARKDOWN_ELEMENTS = [
  'a',
  'blockquote',
  'br',
  'code',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'li',
  'ol',
  'p',
  'pre',
  'strong',
  'ul',
]

const Container = styled.div`
  overflow-wrap: anywhere;
  white-space: normal;
  font-weight: 400;
  color: ${({ theme }) => theme.textPrimary};

  > :first-child {
    margin-top: 0;
  }

  > :last-child {
    margin-bottom: 0;
  }

  p,
  blockquote,
  ol,
  ul,
  pre {
    margin: 0 0 0.75em;
  }

  p,
  li {
    white-space: pre-line;
  }

  ol,
  ul {
    padding-left: 1.5em;
  }

  li + li {
    margin-top: 0.25em;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin: 0.75em 0 0.4em;
    font-size: 1em;
    font-weight: 600;
  }

  a {
    color: ${({ theme }) => theme.linkColor};
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  blockquote {
    padding-left: 0.75em;
    border-left: 3px solid ${({ theme }) => theme.borderColor};
    color: ${({ theme }) => theme.textSecondary};
  }

  code {
    padding: 0.1em 0.3em;
    border-radius: 3px;
    background: ${({ theme }) => theme.quaternaryColor};
  }

  pre {
    overflow-x: auto;
    padding: 0.75em;
    border-radius: 4px;
    background: ${({ theme }) => theme.elevatedBackground};

    code {
      padding: 0;
      background: transparent;
    }
  }
`

interface EvidenceDescriptionProps {
  children?: string | null
}

interface EvidenceLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href?: string
}

const EvidenceLink = ({ href, children, ...props }: EvidenceLinkProps) => {
  const [warningVisible, setWarningVisible] = useState(false)
  const safeHref = isSafeNavigationUrl(href) ? href : undefined

  if (!safeHref) return <>{children}</>

  const closeWarning = () => setWarningVisible(false)

  const openLink = () => {
    closeWarning()
    window.open(safeHref, '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      <a
        {...props}
        href={safeHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => {
          event.preventDefault()
          setWarningVisible(true)
        }}
      >
        {children}
      </a>
      <ExternalLinkWarning
        visible={warningVisible}
        url={safeHref}
        onConfirm={openLink}
        onCancel={closeWarning}
      />
    </>
  )
}

const EvidenceDescription = ({ children }: EvidenceDescriptionProps) => (
  <Container>
    <ReactMarkdown
      allowedElements={MARKDOWN_ELEMENTS}
      components={{
        a: ({ node: _node, ...props }) => <EvidenceLink {...props} />,
      }}
      skipHtml
      unwrapDisallowed
    >
      {children ?? ''}
    </ReactMarkdown>
  </Container>
)

export default EvidenceDescription
