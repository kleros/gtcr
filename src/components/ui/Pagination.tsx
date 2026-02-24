import React, { useState, useCallback, useMemo } from 'react'
import styled, { css } from 'styled-components'

const Wrapper = styled.nav`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  user-select: none;
`

const pageButtonBase = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 6px;
  border: 1px solid ${({ theme }) => theme.borderColor};
  border-radius: 4px;
  background: ${({ theme }) => theme.componentBackground};
  color: ${({ theme }) => theme.textPrimary};
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  line-height: 1;

  &:hover:not(:disabled):not(.active) {
    color: ${({ theme }) => theme.primaryColor};
    border-color: ${({ theme }) => theme.primaryColor};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`

const PageButton = styled.button`
  ${pageButtonBase}

  &.active {
    color: ${({ theme }) => theme.textOnPrimary || '#fff'};
    background: ${({ theme }) => theme.primaryColor};
    border-color: ${({ theme }) => theme.primaryColor};
    font-weight: 500;
  }
`

const Ellipsis = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  color: ${({ theme }) => theme.textSecondary};
  letter-spacing: 2px;
`

const SizeChanger = styled.select`
  height: 32px;
  padding: 0 8px;
  border: 1px solid ${({ theme }) => theme.borderColor};
  border-radius: 4px;
  background: ${({ theme }) => theme.componentBackground};
  color: ${({ theme }) => theme.textPrimary};
  font-size: 14px;
  cursor: pointer;
  margin-left: 8px;
  outline: none;

  &:focus {
    border-color: ${({ theme }) => theme.primaryColor};
  }
`

const SimplePagination = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: ${({ theme }) => theme.textPrimary};
`

const SimpleInput = styled.input`
  width: 48px;
  height: 32px;
  text-align: center;
  border: 1px solid ${({ theme }) => theme.borderColor};
  border-radius: 4px;
  background: ${({ theme }) => theme.componentBackground};
  color: ${({ theme }) => theme.textPrimary};
  font-size: 14px;
  outline: none;

  &:focus {
    border-color: ${({ theme }) => theme.primaryColor};
  }
`

const getPageNumbers = (
  current: number,
  total: number,
): (number | string)[] => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | string)[] = []
  pages.push(1)

  if (current > 3) pages.push('left-ellipsis')

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  for (let i = start; i <= end; i++) pages.push(i)

  if (current < total - 2) pages.push('right-ellipsis')

  if (total > 1) pages.push(total)

  return pages
}

interface PaginationProps {
  total?: number
  current?: number
  pageSize?: number
  onChange?: (page: number, pageSize: number) => void
  showSizeChanger?: boolean
  pageSizeOptions?: string[]
  onShowSizeChange?: (current: number, size: number) => void
  itemRender?: (
    page: number,
    type: string,
    originalElement: React.ReactNode,
  ) => React.ReactNode
  style?: React.CSSProperties
  className?: string
  defaultCurrent?: number
  simple?: boolean
}

const Pagination: React.FC<PaginationProps> = ({
  total = 0,
  current: controlledCurrent,
  pageSize: controlledPageSize,
  onChange,
  showSizeChanger = false,
  pageSizeOptions = ['10', '20', '50', '100'],
  onShowSizeChange,
  itemRender,
  style,
  className,
  defaultCurrent = 1,
  simple = false,
}) => {
  const [internalCurrent, setInternalCurrent] = useState(defaultCurrent)
  const [internalPageSize, setInternalPageSize] = useState(
    controlledPageSize || 10,
  )

  const isControlled = controlledCurrent !== undefined
  const current = isControlled ? controlledCurrent : internalCurrent
  const pageSize =
    controlledPageSize !== undefined ? controlledPageSize : internalPageSize
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const goTo = useCallback(
    (page: number) => {
      const p = Math.max(1, Math.min(page, totalPages))
      if (!isControlled) setInternalCurrent(p)
      if (onChange) onChange(p, pageSize)
    },
    [totalPages, isControlled, onChange, pageSize],
  )

  const handleSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newSize = Number(e.target.value)
      setInternalPageSize(newSize)
      const newTotal = Math.max(1, Math.ceil(total / newSize))
      const newCurrent = Math.min(current, newTotal)
      if (!isControlled) setInternalCurrent(newCurrent)
      if (onShowSizeChange) onShowSizeChange(newCurrent, newSize)
      if (onChange) onChange(newCurrent, newSize)
    },
    [total, current, isControlled, onShowSizeChange, onChange],
  )

  const renderItem = useCallback(
    (page: number, type: string, originalElement: React.ReactNode) => {
      if (itemRender) return itemRender(page, type, originalElement)
      return originalElement
    },
    [itemRender],
  )

  const pages = useMemo(
    () => getPageNumbers(current, totalPages),
    [current, totalPages],
  )

  if (simple)
    return (
      <SimplePagination
        style={style}
        className={`ui-pagination ui-pagination-simple${className ? ` ${className}` : ''}`}
      >
        <PageButton disabled={current <= 1} onClick={() => goTo(current - 1)}>
          &#8249;
        </PageButton>
        <SimpleInput
          value={current}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10)
            if (!isNaN(val)) goTo(val)
          }}
        />
        <span>/</span>
        <span>{totalPages}</span>
        <PageButton
          disabled={current >= totalPages}
          onClick={() => goTo(current + 1)}
        >
          &#8250;
        </PageButton>
      </SimplePagination>
    )

  return (
    <Wrapper
      style={style}
      className={`ui-pagination${className ? ` ${className}` : ''}`}
    >
      <PageButton
        disabled={current <= 1}
        onClick={() => goTo(current - 1)}
        aria-label="Previous Page"
      >
        {renderItem(current - 1, 'prev', <>&#8249;</>)}
      </PageButton>

      {pages.map((page, idx) => {
        if (typeof page === 'string')
          return <Ellipsis key={page + idx}>...</Ellipsis>

        return renderItem(
          page,
          'page',
          <PageButton
            key={page}
            className={page === current ? 'active' : ''}
            onClick={() => goTo(page)}
          >
            {page}
          </PageButton>,
        )
      })}

      <PageButton
        disabled={current >= totalPages}
        onClick={() => goTo(current + 1)}
        aria-label="Next Page"
      >
        {renderItem(current + 1, 'next', <>&#8250;</>)}
      </PageButton>

      {showSizeChanger && (
        <SizeChanger value={pageSize} onChange={handleSizeChange}>
          {pageSizeOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt} / page
            </option>
          ))}
        </SizeChanger>
      )}
    </Wrapper>
  )
}

export default Pagination
