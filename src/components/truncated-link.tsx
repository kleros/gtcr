import React, { useState } from 'react'
import styled from 'styled-components'
import { Typography } from 'components/ui'
import ExternalLinkWarning from './external-link-warning'

const StyledA = styled.a`
  text-decoration: none;
`

const truncateUrl = (url, maxLength = 50) => {
  if (!url || url.length <= maxLength) return url
  return `${url.substring(0, maxLength)}...`
}

interface TruncatedLinkProps {
  url: string
}

const TruncatedLink = ({ url }: TruncatedLinkProps) => {
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
      <StyledA href={url} onClick={handleClick} title={url}>
        <Typography.Text>{truncateUrl(url)}</Typography.Text>
      </StyledA>
      <ExternalLinkWarning
        visible={warningVisible}
        url={url}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  )
}

export default TruncatedLink
