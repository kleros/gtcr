import React from 'react'
import styled, { css } from 'styled-components'

const ListWrapper = styled.div<{ $bordered?: boolean }>`
  font-size: 14px;
  color: ${({ theme }) => theme.textPrimary};
  background: ${({ theme }) => theme.componentBackground};
  border-radius: 4px;

  ${({ $bordered, theme }) =>
    $bordered &&
    css`
      border: 1px solid ${theme.borderColor};
    `}
`

const ListHeader = styled.div`
  padding: 12px 24px;
  border-bottom: 1px solid ${({ theme }) => theme.borderColor};
  font-weight: 500;
  color: ${({ theme }) => theme.textPrimary};
`

const ListFooter = styled.div`
  padding: 12px 24px;
  border-top: 1px solid ${({ theme }) => theme.borderColor};
  color: ${({ theme }) => theme.textSecondary};
`

const ListContentWrapper = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`

const sizeMap: Record<string, ReturnType<typeof css>> = {
  small: css`
    padding: 8px 16px;
  `,
  default: css`
    padding: 12px 24px;
  `,
  large: css`
    padding: 16px 24px;
  `,
}

const ListItemWrapper = styled.li<{ $size?: string; $split?: boolean }>`
  display: flex;
  align-items: center;
  ${({ $size }) => sizeMap[$size || 'default'] || sizeMap.default}

  ${({ $split, theme }) =>
    $split &&
    css`
      &:not(:last-child) {
        border-bottom: 1px solid ${theme.borderColor};
      }
    `}
`

const ListItemContent = styled.div`
  flex: 1;
  min-width: 0;
`

const ListItemActions = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-left: 24px;
  flex-shrink: 0;
`

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
  min-width: 0;
`

const MetaTitle = styled.div`
  color: ${({ theme }) => theme.textPrimary};
  font-weight: 500;
  font-size: 14px;
  margin-bottom: 4px;
`

const MetaDescription = styled.div`
  color: ${({ theme }) => theme.textSecondary};
  font-size: 13px;
`

const LoadingWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  color: ${({ theme }) => theme.textSecondary};
`

interface MetaProps {
  title?: React.ReactNode
  description?: React.ReactNode
  avatar?: React.ReactNode
}

const Meta: React.FC<MetaProps> = ({ title, description, avatar }) => (
  <MetaWrapper className="ui-list-item-meta">
    {avatar && <MetaAvatar>{avatar}</MetaAvatar>}
    <MetaDetail>
      {title && <MetaTitle>{title}</MetaTitle>}
      {description && <MetaDescription>{description}</MetaDescription>}
    </MetaDetail>
  </MetaWrapper>
)

Meta.displayName = 'List.Item.Meta'

interface ListItemProps {
  actions?: React.ReactNode[]
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
  $size?: string
  $split?: boolean
}

interface ListItemComponent extends React.FC<ListItemProps> {
  Meta: React.FC<MetaProps>
}

const ListItem: ListItemComponent = ({
  actions,
  children,
  style,
  className,
  $size,
  $split,
}) => (
  <ListItemWrapper
    $size={$size}
    $split={$split}
    style={style}
    className={`ui-list-item${className ? ` ${className}` : ''}`}
  >
    <ListItemContent>{children}</ListItemContent>
    {actions && actions.length > 0 && (
      <ListItemActions>
        {actions.map((action, i) => (
          <span key={i}>{action}</span>
        ))}
      </ListItemActions>
    )}
  </ListItemWrapper>
)

ListItem.displayName = 'List.Item'
ListItem.Meta = Meta

interface ListProps {
  bordered?: boolean
  dataSource?: unknown[]
  renderItem?: (item: unknown, index: number) => React.ReactNode
  loading?: boolean
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
  size?: string
  header?: React.ReactNode
  footer?: React.ReactNode
  split?: boolean
}

interface ListComponent extends React.FC<ListProps> {
  Item: ListItemComponent
}

const List: ListComponent = ({
  bordered = false,
  dataSource,
  renderItem,
  loading = false,
  children,
  style,
  className,
  size = 'default',
  header,
  footer,
  split = true,
}) => {
  let content: React.ReactNode

  if (loading) content = <LoadingWrapper>Loading...</LoadingWrapper>
  else if (dataSource && renderItem)
    content = (
      <ListContentWrapper>
        {dataSource.map((item, index) => {
          const rendered = renderItem(item, index) as React.ReactElement
          if (rendered && rendered.type === ListItem)
            return React.cloneElement(rendered, {
              key: rendered.key || index,
              $size: size,
              $split: split,
            })

          return (
            <ListItemWrapper key={index} $size={size} $split={split}>
              <ListItemContent>{rendered}</ListItemContent>
            </ListItemWrapper>
          )
        })}
      </ListContentWrapper>
    )
  else if (children)
    content = (
      <ListContentWrapper>
        {React.Children.map(children, (child, index) => {
          const element = child as React.ReactElement
          if (element && element.type === ListItem)
            return React.cloneElement(element, {
              key: element.key || index,
              $size: size,
              $split: split,
            })

          return child
        })}
      </ListContentWrapper>
    )

  return (
    <ListWrapper
      $bordered={bordered}
      style={style}
      className={`ui-list${className ? ` ${className}` : ''}`}
    >
      {header && <ListHeader>{header}</ListHeader>}
      {content}
      {footer && <ListFooter>{footer}</ListFooter>}
    </ListWrapper>
  )
}

List.Item = ListItem

export default List
