import React, { useEffect, useState } from 'react'
import { Icon } from 'antd'
import { getExtension } from 'mime'
import { parseIpfs } from 'utils/ipfs-parse'

const FileDisplay = ({ value, allowedFileTypes }) => {
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

  if (!value) return <span style={{ color: 'gray' }}>empty</span>

  return (
    <>
      <a href={parseIpfs(value)} target="_blank" rel="noopener noreferrer">
        View File <Icon type="paper-clip" />
      </a>
      {!supported && (
        <span style={{ marginLeft: 6, color: 'red' }}>
          File type not supported
        </span>
      )}
    </>
  )
}

export default FileDisplay
