import { Icon } from 'antd'
import React from 'react'
import { parseIpfs } from 'utils/ipfs-parse'

const FileDisplay = ({ value, allowedFileTypes }) => {
  if (!value) return <span style={{ color: 'gray' }}>empty</span>

  if (!allowedFileTypes) return 'No allowed file types specified'

  const allowedFileTypesArr = allowedFileTypes.split(' ')
  if (allowedFileTypesArr.length === 0) return 'No allowed file types specified'

  const fileExtension = value.slice(value.lastIndexOf('.') + 1)
  if (!allowedFileTypesArr.includes(fileExtension)) return 'Forbidden file type'

  return (
    <a href={parseIpfs(value || '')} target="_blank" rel="noopener noreferrer">
      View File <Icon type="paper-clip" />
    </a>
  )
}

export default FileDisplay
