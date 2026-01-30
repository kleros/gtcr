import React, { useState, useMemo } from 'react'
import styled from 'styled-components'
import { Select, Badge, Icon } from 'antd'
import { Link } from 'react-router-dom'
import { useDebouncedCallback } from 'use-debounce'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import DisplaySelector from './display-selector'

// Status colors for permanent items based on contract status
const STATUS_COLOR_MAP = {
  Absent: 'red',
  Submitted: 'blue',
  Reincluded: 'green',
  Disputed: 'orange'
}

const StyledSelect = styled(Select)`
  width: 100%;
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

const OptionItem = ({ item, chainId, tcrAddress }) => {
  const { itemID, status, metadata } = item
  const props = metadata?.props || []

  return (
    <StyledOptionItem>
      <StyledStatus>
        <Badge color={STATUS_COLOR_MAP[status] || 'gray'} />
      </StyledStatus>
      <StyledFieldsContainer>
        {props
          .filter(col => col.isIdentifier)
          .map((column, j) => (
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

const PermanentSearchBar = ({ items, chainId, tcrAddress }) => {
  const [value, setValue] = useState()
  const [searchTerm, setSearchTerm] = useState('')
  const [writing, setWriting] = useState(false)

  const [debouncedCallback] = useDebouncedCallback(input => {
    setSearchTerm(input?.trim()?.toLowerCase() || '')
    setWriting(false)
  }, 300)

  const filteredItems = useMemo(() => {
    if (!searchTerm || !items) return []

    return items
      .filter(item => {
        const props = item.metadata?.props || []
        return props.some(prop => {
          const propValue = prop.value?.toLowerCase() || ''
          return propValue.includes(searchTerm)
        })
      })
      .slice(0, MAX_ITEM_COUNT)
  }, [items, searchTerm])

  const options = filteredItems.map(item => {
    const props = item.metadata?.props || []
    const identifierProps = props.filter(prop => prop.isIdentifier)
    const label =
      identifierProps.length > 0
        ? identifierProps[0].value
        : item.itemID.slice(0, 10)

    return (
      <Select.Option key={item.itemID} label={label}>
        <OptionItem item={item} chainId={chainId} tcrAddress={tcrAddress} />
      </Select.Option>
    )
  })

  const onSearch = value => {
    debouncedCallback(value)
    setWriting(true)
  }

  const onChange = itemID => setValue(itemID)

  const shownOptions = () => {
    if (!searchTerm) return []
    if (writing) return <Select.Option key="Loading">Loading...</Select.Option>
    if (options.length === 0)
      return <Select.Option key="NoResult">No results</Select.Option>
    return options
  }

  return (
    <StyledSelect
      id="items-search-bar"
      showSearch
      value={value}
      defaultActiveFirstOption={false}
      showArrow={false}
      filterOption={false}
      onSearch={onSearch}
      onChange={onChange}
      optionLabelProp="label"
      notFoundContent={null}
      placeholder={
        <>
          <FontAwesomeIcon icon="search" /> Search...
        </>
      }
    >
      {shownOptions()}
    </StyledSelect>
  )
}

export default PermanentSearchBar
