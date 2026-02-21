import React, { Children, useMemo } from 'react'
import styled, { css } from 'styled-components'

interface DescriptionsItemProps {
  label?: React.ReactNode
  span?: number
  children?: React.ReactNode
}

// Descriptions.Item (declarative API)
const Item: React.FC<DescriptionsItemProps> = ({ children }) => children as React.ReactElement
Item.displayName = 'Descriptions.Item'

const DescriptionsWrapper = styled.div`
  font-size: 14px;
  color: ${({ theme }) => theme.textPrimary};
`

const Title = styled.div`
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
  color: ${({ theme }) => theme.textPrimary};
`

// ---- Bordered layout (table-like) ----
const BorderedTableWrapper = styled.div`
  border: 1px solid ${({ theme }) => theme.borderColor};
  border-radius: 8px;
  overflow: hidden;
`

const BorderedTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  background: ${({ theme }) => theme.componentBackground};
`

const BorderedLabelCell = styled.th<{ $size?: string }>`
  padding: ${({ $size }) =>
    $size === 'small' ? '8px 12px' : '12px 16px'};
  background: ${({ theme }) => theme.elevatedBackground};
  border: 1px solid ${({ theme }) => theme.borderColor};
  color: ${({ theme }) => theme.textSecondary};
  font-weight: 500;
  font-size: 14px;
  text-align: left;
  white-space: nowrap;
  width: 1%;

  tr:first-child & { border-top: none; }
  tr:last-child & { border-bottom: none; }
  &:first-child { border-left: none; }
`

const BorderedContentCell = styled.td<{ $size?: string }>`
  padding: ${({ $size }) =>
    $size === 'small' ? '8px 12px' : '12px 16px'};
  border: 1px solid ${({ theme }) => theme.borderColor};
  color: ${({ theme }) => theme.textPrimary};
  font-size: 14px;
  word-break: break-word;

  tr:first-child & { border-top: none; }
  tr:last-child & { border-bottom: none; }
  &:last-child { border-right: none; }
`

// ---- Non-bordered layout (list-like) ----
const ListGrid = styled.div<{ $columns?: number }>`
  display: grid;
  grid-template-columns: ${({ $columns }) => `repeat(${$columns}, 1fr)`};
  gap: 16px;
`

const ListItem = styled.div<{ $span?: number }>`
  ${({ $span }) =>
    $span && $span > 1 &&
    css`
      grid-column: span ${$span};
    `}
`

const ListLabel = styled.span`
  color: ${({ theme }) => theme.textSecondary};
  font-size: 14px;
  line-height: 1.5;
  margin-right: 4px;
  font-weight: 500;
`

const ListContent = styled.span`
  color: ${({ theme }) => theme.textPrimary};
  font-size: 14px;
  line-height: 1.5;
`

const getColumnCount = (column: number | Record<string, number> | undefined, defaultVal = 3): number => {
  if (typeof column === 'number') return column
  if (typeof column === 'object' && column !== null) {
    // Simple responsive approach: pick largest available
    const breakpoints = ['xxl', 'xl', 'lg', 'md', 'sm', 'xs'] as const
    const width = typeof window !== 'undefined' ? window.innerWidth : 1200
    const widthMap: Record<string, number> = { xxl: 1600, xl: 1200, lg: 992, md: 768, sm: 576, xs: 0 }
    for (const bp of breakpoints) {
      if (column[bp] !== undefined && width >= widthMap[bp]) {
        return column[bp]
      }
    }
  }
  return defaultVal
}

interface DescriptionsProps {
  bordered?: boolean
  column?: number | Record<string, number>
  title?: React.ReactNode
  size?: string
  style?: React.CSSProperties
  className?: string
  children?: React.ReactNode
}

interface DescriptionsComponent extends React.FC<DescriptionsProps> {
  Item: React.FC<DescriptionsItemProps>
}

const Descriptions: DescriptionsComponent = ({
  bordered = false,
  column = 3,
  title: descTitle,
  size,
  style,
  className,
  children
}) => {
  const columns = getColumnCount(column)

  // Parse items from children, flattening fragments
  const items = useMemo(() => {
    const result: { label: React.ReactNode; span: number; content: React.ReactNode }[] = []
    const flatten = (node: React.ReactNode) => {
      Children.forEach(node, (child: any) => {
        if (!child) return
        // If it's a fragment, recurse into its children
        if (child.type === React.Fragment) {
          flatten(child.props.children)
          return
        }
        if (!child.props) return
        result.push({
          label: child.props.label,
          span: child.props.span || 1,
          content: child.props.children
        })
      })
    }
    flatten(children)
    return result
  }, [children])

  if (bordered) {
    // Build rows for the table
    const rows: typeof items[] = []
    let currentRow: typeof items = []
    let currentSpan = 0

    items.forEach(item => {
      if (currentSpan + item.span > columns) {
        rows.push(currentRow)
        currentRow = []
        currentSpan = 0
      }
      currentRow.push(item)
      currentSpan += item.span
      if (currentSpan >= columns) {
        rows.push(currentRow)
        currentRow = []
        currentSpan = 0
      }
    })
    if (currentRow.length > 0) rows.push(currentRow)

    return (
      <DescriptionsWrapper style={style} className={className}>
        {descTitle && <Title>{descTitle}</Title>}
        <BorderedTableWrapper>
          <BorderedTable>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {row.map((item, cellIdx) => (
                    <React.Fragment key={cellIdx}>
                      <BorderedLabelCell $size={size}>
                        {item.label}
                      </BorderedLabelCell>
                      <BorderedContentCell
                        $size={size}
                        colSpan={item.span > 1 ? item.span * 2 - 1 : 1}
                      >
                        {item.content}
                      </BorderedContentCell>
                    </React.Fragment>
                  ))}
                </tr>
              ))}
            </tbody>
          </BorderedTable>
        </BorderedTableWrapper>
      </DescriptionsWrapper>
    )
  }

  return (
    <DescriptionsWrapper style={style} className={className}>
      {descTitle && <Title>{descTitle}</Title>}
      <ListGrid $columns={columns}>
        {items.map((item, idx) => (
          <ListItem key={idx} $span={item.span}>
            <ListLabel>{item.label}:</ListLabel>
            <ListContent>{item.content}</ListContent>
          </ListItem>
        ))}
      </ListGrid>
    </DescriptionsWrapper>
  )
}

Descriptions.Item = Item

export default Descriptions
