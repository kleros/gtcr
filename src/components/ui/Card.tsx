import React from 'react'
import styled, { css, keyframes } from 'styled-components'

const shimmer = keyframes`
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
`

const StyledCard = styled.div<{ $bordered?: boolean; $hoverable?: boolean }>`
  background: ${({ theme }) => theme.componentBackground};
  border-radius: 12px;
  border: ${({ $bordered, theme }) =>
    $bordered ? `1px solid ${theme.borderColor}` : 'none'};
  box-shadow: ${({ theme }) => `0 2px 8px ${theme.shadowColor}`};
  transition: all 0.3s;
  overflow: hidden;

  ${({ $hoverable }) =>
    $hoverable &&
    css`
      cursor: pointer;
      &:hover {
        box-shadow: ${({ theme }) => `0 4px 16px ${theme.shadowColor}`};
        transform: translateY(-2px);
      }
    `}
`

const CardHead = styled.div`
  background: ${({ theme }) => theme.elevatedBackground};
  border-bottom: 1px solid ${({ theme }) => theme.borderColor};
  padding: 16px 24px;
  min-height: 48px;
`

const CardHeadWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const CardHeadTitle = styled.div`
  color: ${({ theme }) => theme.textPrimary};
  font-weight: 500;
  font-size: 16px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`

const CardExtra = styled.div`
  margin-left: auto;
  padding-left: 16px;
  color: ${({ theme }) => theme.textPrimary};
`

const CardBody = styled.div`
  padding: 24px;
  color: ${({ theme }) => theme.textPrimary};
`

const CardActions = styled.div`
  display: flex;
  align-items: center;
  border-top: 1px solid ${({ theme }) => theme.borderColor};

  & > * {
    flex: 1;
    text-align: center;
    padding: 12px 0;
    cursor: pointer;
    transition: color 0.3s;

    &:not(:last-child) {
      border-right: 1px solid ${({ theme }) => theme.borderColor};
    }
  }
`

const SkeletonLine = styled.div<{ $height?: string; $width?: string }>`
  height: ${({ $height }) => $height || '16px'};
  width: ${({ $width }) => $width || '100%'};
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.skeletonBase} 25%,
    ${({ theme }) => theme.skeletonHighlight} 37%,
    ${({ theme }) => theme.skeletonBase} 63%
  );
  background-size: 400px 100%;
  animation: ${shimmer} 1.4s ease infinite;
  margin-bottom: 12px;
`

const SkeletonContent = () => (
  <div>
    <SkeletonLine $width="38%" $height="16px" />
    <SkeletonLine $width="100%" $height="16px" />
    <SkeletonLine $width="61%" $height="16px" />
    <SkeletonLine $width="80%" $height="16px" />
  </div>
)

// Card.Meta sub-component
const MetaWrapper = styled.div`
  display: flex;
  align-items: flex-start;
`

const MetaAvatar = styled.div`
  margin-right: 16px;
  flex-shrink: 0;
`

const MetaDetail = styled.div`
  flex: 1;
  overflow: hidden;
`

const MetaTitle = styled.div`
  color: ${({ theme }) => theme.textPrimary};
  font-weight: 500;
  font-size: 16px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  margin-bottom: 8px;
`

const MetaDescription = styled.div`
  color: ${({ theme }) => theme.textSecondary};
  font-size: 14px;
`

interface CardMetaProps {
  title?: React.ReactNode
  description?: React.ReactNode
  avatar?: React.ReactNode
}

const Meta: React.FC<CardMetaProps> = ({ title, description, avatar }) => (
  <MetaWrapper className="ui-card-meta">
    {avatar && (
      <MetaAvatar className="ui-card-meta-avatar">{avatar}</MetaAvatar>
    )}
    <MetaDetail className="ui-card-meta-detail">
      {title && <MetaTitle className="ui-card-meta-title">{title}</MetaTitle>}
      {description && (
        <MetaDescription className="ui-card-meta-description">
          {description}
        </MetaDescription>
      )}
    </MetaDetail>
  </MetaWrapper>
)

Meta.displayName = 'Card.Meta'

interface CardProps {
  title?: React.ReactNode
  extra?: React.ReactNode
  actions?: React.ReactNode[]
  bordered?: boolean
  loading?: boolean
  hoverable?: boolean
  style?: React.CSSProperties
  className?: string
  children?: React.ReactNode
}

interface CardComponent extends React.FC<CardProps> {
  Meta: React.FC<CardMetaProps>
}

const Card: CardComponent = ({
  title,
  extra,
  actions,
  bordered = true,
  loading = false,
  hoverable = false,
  style,
  className,
  children,
}) => (
  <StyledCard
    className={`ui-card${className ? ` ${className}` : ''}`}
    $bordered={bordered}
    $hoverable={hoverable}
    style={style}
  >
    {(title || extra) && (
      <CardHead className="ui-card-head">
        <CardHeadWrapper className="ui-card-head-wrapper">
          {title && (
            <CardHeadTitle className="ui-card-head-title">
              {title}
            </CardHeadTitle>
          )}
          {extra && <CardExtra className="ui-card-extra">{extra}</CardExtra>}
        </CardHeadWrapper>
      </CardHead>
    )}
    <CardBody className="ui-card-body">
      {loading ? <SkeletonContent /> : children}
    </CardBody>
    {actions && actions.length > 0 && (
      <CardActions className="ui-card-actions">
        {actions.map((action, i) => (
          <span key={i}>{action}</span>
        ))}
      </CardActions>
    )}
  </StyledCard>
)

Card.Meta = Meta

export default Card
