import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import Icon from 'components/ui/Icon'
import { getExtension } from 'mime'
import { parseIpfs } from 'utils/ipfs-parse'

const EmptyText = styled.span`
  color: ${({ theme }) => theme.textTertiary};
`

const ErrorText = styled.span`
  margin-left: 6px;
  color: ${({ theme }) => theme.errorColor};
`

const StyledA = styled.a`
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`

interface FileDisplayProps {
  value?: string | null
  allowedFileTypes?: string | null
}

const FileDisplay = ({ value, allowedFileTypes }: FileDisplayProps) => {
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    const check = async () => {
      if (!value) return
      if (!allowedFileTypes) {
        setSupported(true)
        return
      }
      const allowed = allowedFileTypes.split(' ')
      let ext = ''
      if (value.includes('.')) ext = value.slice(value.lastIndexOf('.') + 1)
      else
        try {
          const res = await fetch(parseIpfs(value), { method: 'HEAD' })
          ext = getExtension(res.headers.get('content-type') || '') || ''
        } catch {
          setSupported(false)
          return
        }

      setSupported(allowed.includes(ext))
    }
    check()
  }, [value, allowedFileTypes])

  if (!value) return <EmptyText>empty</EmptyText>

  return (
    <>
      <StyledA href={parseIpfs(value)} target="_blank" rel="noopener noreferrer">
        View File <Icon type="paper-clip" />
      </StyledA>
      {!supported && <ErrorText>File type not supported</ErrorText>}
    </>
  )
}

export default FileDisplay
