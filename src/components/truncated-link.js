import React, { useState } from 'react'
import { Typography } from 'antd'
import PropTypes from 'prop-types'
import ExternalLinkWarning from './external-link-warning'

const truncateUrl = (url, maxLength = 50) => {
  if (!url || url.length <= maxLength) return url
  return `${url.substring(0, maxLength)}...`
}

const TruncatedLink = ({ url }) => {
  const [warningVisible, setWarningVisible] = useState(false)

  const handleClick = e => {
    e.preventDefault()
    setWarningVisible(true)
  }

  const handleConfirm = () => {
    setWarningVisible(false)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleCancel = () => {
    setWarningVisible(false)
  }

  return (
    <>
      <a href={url} onClick={handleClick} title={url}>
        <Typography.Text>{truncateUrl(url)}</Typography.Text>
      </a>
      <ExternalLinkWarning
        visible={warningVisible}
        url={url}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  )
}

TruncatedLink.propTypes = {
  url: PropTypes.string.isRequired
}

export default TruncatedLink
