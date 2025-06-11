import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import { Icon } from 'antd'
import { parseIpfs } from 'utils/ipfs-parse'

const StyledSpan = styled.span`
  color: gray;
`

const mimeToExt = {
  'application/json': 'json',
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif'
}

const FileDisplay = ({ value, allowedFileTypes }) => {
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    const check = async () => {
      if (!value) {
        setStatus('empty')
        return
      }
      if (!allowedFileTypes) {
        setStatus('noAllowed')
        return
      }
      const allowed = allowedFileTypes.split(' ')
      if (value.includes('.')) {
        const ext = value.slice(value.lastIndexOf('.') + 1)
        setStatus(allowed.includes(ext) ? 'ok' : 'forbidden')
        return
      }
      try {
        const r = await fetch(parseIpfs(value), { method: 'HEAD' })
        const mime = (r.headers.get('content-type') || '').split(';')[0]
        const ext = mimeToExt[mime] || ''
        setStatus(allowed.includes(ext) ? 'ok' : 'forbidden')
      } catch {
        setStatus('forbidden')
      }
    }
    check()
  }, [value, allowedFileTypes])

  if (status === 'loading') return null
  if (status === 'empty') return <StyledSpan>empty</StyledSpan>
  if (status === 'noAllowed') return 'No allowed file types specified'
  if (status === 'forbidden') return 'Forbidden file type'

  return (
    <a href={parseIpfs(value)} target="_blank" rel="noopener noreferrer">
      View File <Icon type="paper-clip" />
    </a>
  )
}

export default FileDisplay
