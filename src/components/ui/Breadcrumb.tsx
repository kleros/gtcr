import React from 'react'
import styled from 'styled-components'

const BreadcrumbWrapper = styled.nav`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  font-size: 14px;
  line-height: 1.5;
`

const BreadcrumbSeparator = styled.span`
  margin: 0 8px;
  color: ${({ theme }) => theme.textSecondary};
`

const BreadcrumbItemWrapper = styled.span<{ $isLast?: boolean }>`
  color: ${({ $isLast, theme }) =>
    $isLast ? theme.textPrimary : theme.textSecondary};
  transition: color 0.2s;

  a {
    color: inherit;
    text-decoration: none;
    transition: color 0.2s;

    &:hover {
      color: ${({ theme }) => theme.primaryColor};
    }
  }

  &:not(:last-child):hover {
    color: ${({ theme }) => theme.primaryColor};
  }
`

interface BreadcrumbItemProps {
  children?: React.ReactNode
  href?: string
  onClick?: (e: React.MouseEvent) => void
  $isLast?: boolean
}

const BreadcrumbItem: React.FC<BreadcrumbItemProps> = ({ children, href, onClick, $isLast }) => (
  <BreadcrumbItemWrapper $isLast={$isLast} className="ui-breadcrumb-item">
    {href ? (
      <a href={href} onClick={onClick}>
        {children}
      </a>
    ) : onClick ? (
      <a
        href="#"
        onClick={(e: React.MouseEvent) => {
          e.preventDefault()
          onClick(e)
        }}
      >
        {children}
      </a>
    ) : (
      <span>{children}</span>
    )}
  </BreadcrumbItemWrapper>
)

BreadcrumbItem.displayName = 'Breadcrumb.Item'

interface BreadcrumbProps {
  separator?: React.ReactNode
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

interface BreadcrumbComponent extends React.FC<BreadcrumbProps> {
  Item: React.FC<BreadcrumbItemProps>
}

const Breadcrumb: BreadcrumbComponent = ({ separator = '/', children, style, className }) => {
  const items = React.Children.toArray(children)

  return (
    <BreadcrumbWrapper
      style={style}
      className={`ui-breadcrumb${className ? ` ${className}` : ''}`}
    >
      {items.map((child, index) => {
        const isLast = index === items.length - 1
        return (
          <React.Fragment key={index}>
            {React.cloneElement(child as React.ReactElement<any>, { $isLast: isLast })}
            {!isLast && (
              <BreadcrumbSeparator>{separator}</BreadcrumbSeparator>
            )}
          </React.Fragment>
        )
      })}
    </BreadcrumbWrapper>
  )
}

Breadcrumb.Item = BreadcrumbItem

export default Breadcrumb
