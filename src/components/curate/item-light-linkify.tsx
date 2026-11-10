import React from 'react'
import styled from 'styled-components'
import { parseIpfs } from 'utils/ipfs-parse'

/*
 * Links inside evidence text. Jurors cite explorers, repositories and IPFS
 * files; each http(s) or ipfs:// URL becomes a link that opens in a new tab,
 * with the full URL as its text so the reader sees where it goes. Trailing
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

export const linkify = (text: string): React.ReactNode[] =>
  text.split(URL_PATTERN).flatMap((part, index): React.ReactNode[] => {
    // split() with a capture group: odd indexes are the matched URLs.
    if (index % 2 === 0) return part ? [part] : []
    const trail = part.match(TRAILING)?.[0] ?? ''
    const url = trail ? part.slice(0, -trail.length) : part
    const href = /^ipfs:\/\//i.test(url) ? parseIpfs(url) : url
    if (!/^https?:\/\/\S+$/i.test(href) || /^ipfs:\/\/$/i.test(url))
      return [part]
    return [
      <Link
        key={index}
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow ugc"
      >
        {url}
      </Link>,
      ...(trail ? [trail] : []),
    ]
  })

export default linkify
