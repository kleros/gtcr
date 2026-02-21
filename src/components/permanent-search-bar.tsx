import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import styled from 'styled-components'
import { Badge } from 'components/ui'
import Icon from 'components/ui/Icon'
import { Link } from 'react-router-dom'
import { useDebouncedCallback } from 'use-debounce'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import DisplaySelector from './display-selector'

// Status colors for permanent items based on contract status
const STATUS_COLOR_MAP: Record<string, string> = {
  Absent: 'red',
  Submitted: 'blue',
  Reincluded: 'green',
  Disputed: 'orange',
}

const Container = styled.div`
  position: relative;
  width: 100%;
`

const SearchInputWrapper = styled.div<{ $focused?: boolean }>`
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 32px;
  padding: 4px 11px;
  font-size: 14px;
  line-height: 1.5;
  color: ${({ theme }) => theme.textPrimary};
  background: ${({ theme }) => theme.componentBackground};
  border: 1px solid ${({ theme }) => theme.borderColor};
  border-radius: 4px;
  transition: all 0.3s;
  box-sizing: border-box;

  &:hover {
    border-color: ${({ theme }) => theme.primaryColor};
  }

  ${({ $focused, theme }) =>
    $focused &&
    `
      border-color: ${theme.primaryColor};
      box-shadow: 0 0 0 2px ${theme.focusShadowColor};
    `}
`

const StyledInput = styled.input`
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: ${({ theme }) => theme.textPrimary};
  padding: 0;
  margin-left: 8px;

  &::placeholder {
    color: ${({ theme }) => theme.textTertiary};
  }
`

const Dropdown = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 1050;
  background: ${({ theme }) => theme.componentBackground};
  border: 1px solid ${({ theme }) => theme.borderColor};
  border-radius: 4px;
  box-shadow: 0 4px 12px ${({ theme }) => theme.shadowColor};
  max-height: 300px;
  overflow-y: auto;
`

const DropdownItem = styled.div`
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.2s;
  color: ${({ theme }) => theme.textPrimary};
  font-size: 14px;

  &:hover {
    background: ${({ theme }) => theme.dropdownHoverBg};
  }
`

const DropdownMessage = styled.div`
  padding: 12px;
  text-align: center;
  color: ${({ theme }) => theme.textTertiary};
  font-size: 14px;
`

const StyledOptionItem = styled.div`
  display: flex;
  margin: 6px;
`

const StyledStatus = styled.div`
  margin-right: 4px;
`

const StyledFieldsContainer = styled.div`
  display: flex;
  flex-direction: column;
  overflow-x: auto;
  margin-right: 6px;
`

const StyledLink = styled(Link)`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
`

const StyledItemField = styled.div`
  margin-bottom: 6px;
`

const MAX_ITEM_COUNT = 5

interface OptionItemProps {
  item: SubgraphItem
  chainId: string | number
  tcrAddress: string
}

const OptionItem = ({ item, chainId, tcrAddress }: OptionItemProps) => {
  const { itemID, status, metadata } = item
  const props = metadata?.props || []

  return (
    <StyledOptionItem>
      <StyledStatus>
        <Badge color={STATUS_COLOR_MAP[status] || 'gray'} />
      </StyledStatus>
      <StyledFieldsContainer>
        {props
          .filter((col: Column) => col.isIdentifier)
          .map((column: Column, j: number) => (
            <StyledItemField key={j}>
              <DisplaySelector
                type={column.type}
                value={column.value}
                allowedFileTypes={[]}
                truncateLinks
                key={j}
              />
            </StyledItemField>
          ))}
      </StyledFieldsContainer>
      <StyledLink to={`/tcr/${chainId}/${tcrAddress}/${itemID}`}>
        <Icon type="right-circle" style={{ fontSize: '24px' }} />
      </StyledLink>
    </StyledOptionItem>
  )
}

interface PermanentSearchBarProps {
  items: SubgraphItem[]
  chainId: string | number
  tcrAddress: string
}

const PermanentSearchBar = ({
  items,
  chainId,
  tcrAddress,
}: PermanentSearchBarProps) => {
  const [inputValue, setInputValue] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [writing, setWriting] = useState(false)
  const [focused, setFocused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const debouncedSearch = useDebouncedCallback((input: string) => {
    setSearchTerm(input?.trim()?.toLowerCase() || '')
    setWriting(false)
  }, 300)

  const filteredItems = useMemo(() => {
    if (!searchTerm || !items) return []

    return items
      .filter((item) => {
        const props = item.metadata?.props || []
        return props.some((prop: Column) => {
          const propValue = (prop.value as string)?.toLowerCase() || ''
          return propValue.includes(searchTerm)
        })
      })
      .slice(0, MAX_ITEM_COUNT)
  }, [items, searchTerm])

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      )
        setFocused(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setInputValue(val)
      setWriting(true)
      debouncedSearch(val)
    },
    [debouncedSearch],
  )

  const showDropdown = focused && inputValue.length > 0

  return (
    <Container ref={containerRef} id="items-search-bar">
      <SearchInputWrapper $focused={focused}>
        <FontAwesomeIcon
          icon="search"
          style={{ color: 'inherit', opacity: 0.5 }}
        />
        <StyledInput
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setFocused(true)}
          placeholder="Search..."
        />
      </SearchInputWrapper>

      {showDropdown && (
        <Dropdown>
          {writing ? (
            <DropdownMessage>Loading...</DropdownMessage>
          ) : filteredItems.length === 0 ? (
            <DropdownMessage>No results</DropdownMessage>
          ) : (
            filteredItems.map((item: SubgraphItem) => (
              <DropdownItem key={item.itemID} onClick={() => setFocused(false)}>
                <OptionItem
                  item={item}
                  chainId={chainId}
                  tcrAddress={tcrAddress}
                />
              </DropdownItem>
            ))
          )}
        </Dropdown>
      )}
    </Container>
  )
}

export default PermanentSearchBar
