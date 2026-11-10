import React, { useState } from 'react'
import styled from 'styled-components'
import { isSafeNavigationUrl } from 'utils/url-validation'
import { CurateIcon } from 'components/curate/icons'
import ExternalLinkWarning from './external-link-warning'

/*
 * A link shown in a dense place (rows, tables, cards): the domain in the
 * link colour, the path quieter, cut at 50 characters. Opening it always
 * goes through the leaving-the-site confirmation.
 */

const StyledA = styled.a`
  && {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    max-width: 100%;
    color: var(--color-primary);
    font-size: inherit;
    line-height: inherit;
    text-decoration: none;
    transition: color var(--motion);
  }

  > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  i {
    color: var(--color-muted);
    font-style: normal;
    transition: color var(--motion);
  }

  > svg {
    flex: 0 0 auto;
    opacity: 0.7;
    transition:
      opacity var(--motion),
      transform 240ms var(--ease-out);
  }

  &&:hover {
    color: var(--color-primary-hover);
  }

  &:hover i {
    color: var(--color-text);
  }

  &:hover > svg {
    opacity: 1;
    transform: translate(1px, -1px);
  }
`

const truncateUrl = (url: string, maxLength = 50) => {
  if (!url || url.length <= maxLength) return url
  return `${url.substring(0, maxLength)}…`
}

interface TruncatedLinkProps {
  url: string
}

const TruncatedLink = ({ url }: TruncatedLinkProps) => {
  const [warningVisible, setWarningVisible] = useState(false)

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setWarningVisible(true)
  }

  const handleConfirm = () => {
    setWarningVisible(false)
    if (!isSafeNavigationUrl(url)) return
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleCancel = () => {
    setWarningVisible(false)
  }

  const shown = truncateUrl(url.replace(/^https?:\/\//i, ''))
  const cut = shown.indexOf('/')
  const host = cut < 0 ? shown : shown.slice(0, cut)
  const rest = cut < 0 ? '' : shown.slice(cut)

  return (
    <>
      <StyledA href={url} onClick={handleClick} title={url}>
        <span>
          {host}
          {rest && <i>{rest}</i>}
        </span>
        <CurateIcon name="external" size={12} />
      </StyledA>
      {/* The dialog is portalled, but its clicks still bubble through React:
          keep them from reaching a clickable row or card around the link. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- not a control: it only stops the dialog's clicks from bubbling */}
      <span
        style={{ display: 'contents' }}
        onClick={(event) => event.stopPropagation()}
      >
        <ExternalLinkWarning
          visible={warningVisible}
          url={url}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      </span>
    </>
  )
}

export default TruncatedLink
