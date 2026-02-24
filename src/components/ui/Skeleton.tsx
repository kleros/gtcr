import React from 'react'
import styled, { css, keyframes } from 'styled-components'

const shimmer = keyframes`
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
`

const shimmerMixin = css`
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.skeletonBase} 25%,
    ${({ theme }) => theme.skeletonHighlight} 37%,
    ${({ theme }) => theme.skeletonBase} 63%
  );
  background-size: 400px 100%;
  animation: ${shimmer} 1.4s ease infinite;
`

const staticMixin = css`
  background: ${({ theme }) => theme.skeletonBase};
`

const SkeletonWrapper = styled.div`
  display: flex;
  gap: 16px;
  padding: 12px 0;
  width: 100%;
`

const AvatarPlaceholder = styled.div<{ $active: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
  ${({ $active }) => ($active ? shimmerMixin : staticMixin)}
`

const ContentArea = styled.div`
  flex: 1;
`

const TitleBar = styled.div<{ $active: boolean; $width?: string }>`
  height: 16px;
  margin-bottom: 16px;
  border-radius: 4px;
  width: ${({ $width }) => $width || '38%'};
  ${({ $active }) => ($active ? shimmerMixin : staticMixin)}
`

const ParagraphLine = styled.div<{ $active: boolean }>`
  height: 16px;
  margin-bottom: 12px;
  border-radius: 4px;
  ${({ $active }) => ($active ? shimmerMixin : staticMixin)}

  &:last-child {
    width: 61%;
  }
`

interface SkeletonProps {
  active?: boolean
  paragraph?: boolean | { rows?: number }
  title?: boolean | { width?: string }
  loading?: boolean
  avatar?: boolean
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

const Skeleton: React.FC<SkeletonProps> = ({
  active = true,
  paragraph = true,
  title = true,
  loading = true,
  avatar = false,
  children,
  style,
  className,
}) => {
  if (!loading && children) return <>{children}</>
  if (!loading) return null

  const titleWidth =
    title && typeof title === 'object' ? title.width : undefined

  const paraRows =
    paragraph === false
      ? 0
      : paragraph && typeof paragraph === 'object' && paragraph.rows
        ? paragraph.rows
        : 3

  return (
    <SkeletonWrapper style={style} className={className}>
      {avatar && <AvatarPlaceholder $active={active} />}
      <ContentArea>
        {title !== false && (
          <TitleBar
            className="ui-skeleton-title"
            $active={active}
            $width={titleWidth}
          />
        )}
        {Array.from({ length: paraRows }).map((_, i) => (
          <ParagraphLine
            className="ui-skeleton-paragraph"
            key={i}
            $active={active}
          />
        ))}
      </ContentArea>
    </SkeletonWrapper>
  )
}

export default Skeleton
