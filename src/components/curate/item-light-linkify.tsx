import React, { useState } from 'react'
import styled from 'styled-components'
import ExternalLinkWarning from 'components/external-link-warning'
import { parseIpfs } from 'utils/ipfs-parse'
import { isSafeNavigationUrl } from 'utils/url-validation'

/*
 * Links inside evidence text. Jurors cite explorers, repositories and IPFS
 * files; each https or ipfs:// URL becomes a link, with the full URL as its
 * text so the reader sees where it goes. Evidence is written by anyone, so a
 * click opens the same warning as every other link from list data, which
 * shows the host the browser will really open (look-alike letters in their
 * punycode form) before anything loads. Plain http stays text. Trailing
 * punctuation stays outside the link. Nothing else is turned into a link.
 */

const URL_PATTERN = /(https?:\/\/[^\s<>"]+|ipfs:\/\/[^\s<>"]+)/g
const TRAILING = /[.,;:!?'")\]”’]+$/

const Link = styled.a`
  color: var(--color-primary);
  overflow-wrap: anywhere;
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, currentColor 40%, transparent);
  text-underline-offset: 2px;
  transition: text-decoration-color var(--motion);

  &:hover {
    text-decoration-color: currentColor;
  }
`

const EvidenceLink = ({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) => {
  const [warningVisible, setWarningVisible] = useState(false)
  return (
    <>
      <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow ugc"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setWarningVisible(true)
        }}
      >
        {children}
      </Link>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- not a control: it only stops the dialog's clicks from bubbling */}
      <span
        style={{ display: 'contents' }}
        onClick={(event) => event.stopPropagation()}
      >
        <ExternalLinkWarning
          visible={warningVisible}
          url={href}
          onConfirm={() => {
            setWarningVisible(false)
            if (isSafeNavigationUrl(href))
              window.open(href, '_blank', 'noopener,noreferrer')
          }}
          onCancel={() => setWarningVisible(false)}
        />
      </span>
    </>
  )
}

export const linkify = (text: string): React.ReactNode[] =>
  text.split(URL_PATTERN).flatMap((part, index): React.ReactNode[] => {
    // split() with a capture group: odd indexes are the matched URLs.
    if (index % 2 === 0) return part ? [part] : []
    const trail = part.match(TRAILING)?.[0] ?? ''
    const url = trail ? part.slice(0, -trail.length) : part
    const href = /^ipfs:\/\//i.test(url) ? parseIpfs(url) : url
    if (!isSafeNavigationUrl(href) || /^ipfs:\/\/$/i.test(url)) return [part]
    return [
      <EvidenceLink key={index} href={href}>
        {url}
      </EvidenceLink>,
      ...(trail ? [trail] : []),
    ]
  })

export default linkify
