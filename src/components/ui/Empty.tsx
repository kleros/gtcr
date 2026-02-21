import React from 'react'
import styled from 'styled-components'

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 0;
  color: ${({ theme }) => theme.textSecondary};
  font-size: 14px;
`

const ImageWrapper = styled.div`
  margin-bottom: 8px;
`

const DescriptionText = styled.div`
  color: ${({ theme }) => theme.textSecondary};
`

const Extra = styled.div`
  margin-top: 16px;
`

const DefaultSvg: React.FC = () => (
  <svg width="64" height="41" viewBox="0 0 64 41" xmlns="http://www.w3.org/2000/svg">
    <g fill="none" fillRule="evenodd" transform="translate(0 1)">
      <ellipse cx="32" cy="33" rx="32" ry="7" fill="#f5f5f5" />
      <g fillRule="nonzero" stroke="#d9d9d9">
        <path d="M55 12.76L44.854 1.258C44.367.474 43.656 0 42.907 0H21.093c-.749 0-1.46.474-1.947 1.257L9 12.761V22h46v-9.24z" />
        <path
          d="M41.613 15.931c0-1.605.994-2.93 2.227-2.931H55v18.137C55 33.26 53.68 35 52.05 35h-40.1C10.32 35 9 33.259 9 31.137V13h11.16c1.233 0 2.227 1.323 2.227 2.928v.022c0 1.605 1.005 2.901 2.237 2.901h14.752c1.232 0 2.237-1.308 2.237-2.913v-.007z"
          fill="#fafafa"
        />
      </g>
    </g>
  </svg>
)

const SimpleSvg: React.FC = () => (
  <svg width="64" height="41" viewBox="0 0 64 41" xmlns="http://www.w3.org/2000/svg">
    <g fill="none" fillRule="evenodd" transform="translate(0 1)">
      <ellipse cx="32" cy="33" rx="32" ry="7" fill="none" stroke="#d9d9d9" />
      <g fillRule="nonzero" stroke="#d9d9d9" fill="none">
        <path d="M55 12.76L44.854 1.258C44.367.474 43.656 0 42.907 0H21.093c-.749 0-1.46.474-1.947 1.257L9 12.761V22h46v-9.24z" />
        <path d="M41.613 15.931c0-1.605.994-2.93 2.227-2.931H55v18.137C55 33.26 53.68 35 52.05 35h-40.1C10.32 35 9 33.259 9 31.137V13h11.16c1.233 0 2.227 1.323 2.227 2.928v.022c0 1.605 1.005 2.901 2.237 2.901h14.752c1.232 0 2.237-1.308 2.237-2.913v-.007z" />
      </g>
    </g>
  </svg>
)

interface EmptyProps {
  description?: React.ReactNode | false
  image?: React.ReactNode | string
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

interface EmptyComponent extends React.FC<EmptyProps> {
  PRESENTED_IMAGE_SIMPLE: string
}

const Empty: EmptyComponent = ({
  description = 'No Data',
  image,
  children,
  style,
  className
}) => {
  const isSimple = image === Empty.PRESENTED_IMAGE_SIMPLE

  return (
    <Wrapper style={style} className={className}>
      <ImageWrapper>
        {image && !isSimple && typeof image !== 'string' ? (
          image
        ) : isSimple ? (
          <SimpleSvg />
        ) : (
          <DefaultSvg />
        )}
      </ImageWrapper>
      {description !== false && (
        <DescriptionText>{description}</DescriptionText>
      )}
      {children && <Extra>{children}</Extra>}
    </Wrapper>
  )
}

Empty.PRESENTED_IMAGE_SIMPLE = 'simple'

export default Empty
