import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import { getExtension } from 'mime'
import { parseIpfs } from 'utils/ipfs-parse'
import { useAttachment } from 'hooks/use-attachment'
import { buttonReset } from 'styles/button-reset'
import { CurateIcon } from 'components/curate/icons'
import { Small, StatusDot } from 'components/curate/primitives'

/*
 * A file field: a chip with the file's type and name that opens it in the
 * in-app viewer. When the list restricts file types and this file is not
 * one of them, a warning dot says so.
 */

const Wrap = styled.span`
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 12px;
  min-width: 0;
  max-width: 100%;
`

const Chip = styled.button`
  ${buttonReset}
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  max-width: 100%;
  height: 36px;
  padding: 0 12px 0 4px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  background: var(--glass);
  box-shadow: inset 0 1px 0 var(--glass-highlight);
  color: var(--color-text);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 500;
  cursor: pointer;
  transition:
    border-color var(--motion),
    background var(--motion),
    transform var(--motion);

  > span:nth-child(2) {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Opens in the in-app viewer, so a forward chevron, not an exit arrow. */
  > svg {
    flex: 0 0 auto;
    color: var(--color-faint);
    transform: rotate(-90deg);
    transition:
      color var(--motion),
      transform 240ms var(--ease-out);
  }

  &:hover {
    border-color: var(--color-border-strong);
    background: var(--color-raised);
    transform: translateY(-1px);
  }

  &:hover > svg {
    color: var(--color-primary);
    transform: rotate(-90deg) translateY(2px);
  }
`

/* The file's own type, read from its name or the gateway's content type. */
const Kind = styled.span`
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  min-width: 28px;
  height: 26px;
  padding: 0 6px;
  border-radius: var(--radius-sm);
  background: var(--color-raised);
  box-shadow: inset 0 0 0 1px var(--glass-border);
  color: var(--color-muted);
  font-family: var(--font-label);
  font-size: 10px;
  line-height: 1;
  font-weight: 600;
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
`

const Unsupported = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

/** "name.pdf" from ".../ipfs/<cid>/name.pdf"; nothing for a bare hash. */
const fileName = (value: string): string | null => {
  const last = value.split(/[?#]/)[0].split('/').filter(Boolean).pop()
  if (!last || !last.includes('.')) return null
  try {
    return decodeURIComponent(last)
  } catch {
    return last
  }
}

const cleanExtension = (ext: string) =>
  /^[a-z0-9]{1,5}$/i.test(ext) ? ext.toLowerCase() : ''

interface FileDisplayProps {
  value?: string | null
  allowedFileTypes?: string | null
}

const FileDisplay = ({ value, allowedFileTypes }: FileDisplayProps) => {
  const [supported, setSupported] = useState(true)
  const [kind, setKind] = useState('')
  const openAttachment = useAttachment()

  useEffect(() => {
    let live = true
    const check = async () => {
      if (!value) return
      let ext = ''
      if (value.includes('.')) ext = value.slice(value.lastIndexOf('.') + 1)
      else if (allowedFileTypes)
        try {
          const res = await fetch(parseIpfs(value), { method: 'HEAD' })
          ext = getExtension(res.headers.get('content-type') || '') || ''
        } catch {
          if (live) setSupported(false)
          return
        }

      if (!live) return
      setKind(cleanExtension(ext))
      if (!allowedFileTypes) {
        setSupported(true)
        return
      }
      const allowed = allowedFileTypes.split(' ')
      setSupported(allowed.includes(ext))
    }
    check()
    return () => {
      live = false
    }
  }, [value, allowedFileTypes])

  if (!value) return <Small $faint>No file</Small>

  const name = fileName(value)

  return (
    <Wrap>
      <Chip
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          openAttachment(parseIpfs(value))
        }}
        aria-label={name ? `View file ${name}` : 'View file'}
        title={name ?? undefined}
      >
        <Kind aria-hidden>
          {kind || <CurateIcon name="policy" size={14} />}
        </Kind>
        <span>{name ?? 'View file'}</span>
        <CurateIcon name="chevron-down" size={13} />
      </Chip>
      {!supported && (
        <Unsupported>
          <StatusDot $tone="contested" aria-hidden />
          File type not supported
        </Unsupported>
      )}
    </Wrap>
  )
}

export default FileDisplay
