import React, { useState } from 'react'
import styled, { keyframes } from 'styled-components'
import { Typography, Avatar, Checkbox } from 'components/ui'
import GTCRAddress from './gtcr-address'
import { ItemTypes } from '@kleros/gtcr-encoder'
import { ZERO_ADDRESS } from '../utils/string'
import RichAddress from './rich-address'
import ETHAddress from './eth-address'
import LongText from './long-text'
import FileDisplay from './file-display'
import TruncatedLink from './truncated-link'
import { parseIpfs } from 'utils/ipfs-parse'

const pohRichAddress = 'eip155:1:0xc5e9ddebb09cd64dfacab4011a0d5cedaf7c9bdb'

const StyledImage = styled.img`
  object-fit: contain;
  height: 100px;
  width: 100px;
  padding: 5px;
`

const shimmer = keyframes`
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
`

const ImageContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100px;
  height: 100px;
  margin: 0 auto;
`

const ImageSkeleton = styled.div`
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.skeletonBase} 25%,
    ${({ theme }) => theme.skeletonHighlight} 50%,
    ${({ theme }) => theme.skeletonBase} 75%
  );
  background-size: 400px 100%;
  animation: ${shimmer} 1.4s ease infinite;
  border-radius: 50%;
`

interface ImageWithLoadingProps {
  src: string
  alt: string
  linkImage?: boolean | null
}

const ImageWithLoading = ({ src, alt, linkImage }: ImageWithLoadingProps) => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  if (error)
    return (
      <ImageContainer>
        <ImageSkeleton style={{ animation: 'none' }}>
          <Avatar shape="square" size="large" icon="file-image" />
        </ImageSkeleton>
      </ImageContainer>
    )

  const content = (
    <ImageContainer>
      {loading && <ImageSkeleton />}
      <StyledImage
        src={src}
        alt={alt}
        style={{ display: loading ? 'none' : 'block' }}
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false)
          setError(true)
        }}
      />
    </ImageContainer>
  )

  if (linkImage)
    return (
      <a href={src} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    )

  return content
}

const protocolRegex = /:\/\//

interface DisplaySelectorProps {
  type: any
  value?: any
  linkImage?: boolean | null
  allowedFileTypes?: string | null
  truncateLinks?: boolean
  disabled?: boolean
}

const DisplaySelector = ({
  type,
  value = null,
  linkImage = null,
  allowedFileTypes = null,
  truncateLinks = false,
  disabled = false
}: DisplaySelectorProps) => {
  switch (type) {
    case ItemTypes.GTCR_ADDRESS:
      return <GTCRAddress address={value || ZERO_ADDRESS} disabled={disabled} />
    case ItemTypes.ADDRESS:
      return <ETHAddress address={value || ZERO_ADDRESS} />
    case ItemTypes.RICH_ADDRESS:
      return <RichAddress crude={value || pohRichAddress} />
    case ItemTypes.TEXT:
    case ItemTypes.NUMBER:
      return <Typography.Text>{value}</Typography.Text>
    case ItemTypes.BOOLEAN:
      return <Checkbox disabled checked={value === 'true'} />
    case ItemTypes.LONG_TEXT:
      return <LongText value={value} />
    case ItemTypes.FILE: {
      return <FileDisplay value={value} allowedFileTypes={allowedFileTypes} />
    }
    case ItemTypes.IMAGE:
      return value ? (
        <ImageWithLoading src={parseIpfs(value)} alt="" linkImage={linkImage} />
      ) : (
        <Avatar shape="square" size="large" icon="file-image" />
      )
    case ItemTypes.LINK: {
      const fullUrl = protocolRegex.test(value) ? value : `https://${value}`
      if (truncateLinks) return <TruncatedLink url={fullUrl} />
      return (
        <a href={fullUrl} target="_blank" rel="noopener noreferrer">
          <Typography.Text>{value}</Typography.Text>
        </a>
      )
    }
    default:
      return (
        <Typography.Paragraph>
          Error: Unhandled Type {type} for data {value}
        </Typography.Paragraph>
      )
  }
}

export default DisplaySelector
