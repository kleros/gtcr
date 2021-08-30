import React, {
  useState,
  useCallback,
  useEffect,
  useContext,
  useMemo
} from 'react'
import PropTypes from 'prop-types'
import { Select, Badge, Icon } from 'antd'
import { Link } from 'react-router-dom'
import styled from 'styled-components/macro'
import { useDebouncedCallback } from 'use-debounce'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import _gtcr from '../assets/abis/LightGeneralizedTCR.json'
import DisplaySelector from './display-selector'
import { ItemTypes, searchableFields } from '@kleros/gtcr-encoder'
import { TCRViewContext } from '../bootstrap/tcr-view-context'
import { WalletContext } from '../bootstrap/wallet-context'
import { itemToStatusCode, STATUS_COLOR } from '../utils/item-status'
import { useLazyQuery } from '@apollo/client'
import ITEM_SEARCH_QUERY from '../graphql/item-search'

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

const OptionItem = ({ item: { itemID, columns = [], tcrAddress } }) => {
  // note
  // there are a few ethers queries coming from here. they might have to be changed
  // to subgraph queries
  // TODO read and figure it out
  const {
    gtcrView,
    challengePeriodDuration,
    tcrAddress: itemTCRAddr,
    metaEvidence
  } = useContext(TCRViewContext)
  const { timestamp } = useContext(WalletContext)
  const [itemInfo, setItemInfo] = useState()
  const { metadata } = metaEvidence || {}
  const { isTCRofTCRs } = metadata || {}

  useEffect(() => {
    if (
      !itemID ||
      !gtcrView ||
      !tcrAddress ||
      itemInfo ||
      tcrAddress !== itemTCRAddr
    )
      return
    ;(async () => {
      try {
        setItemInfo(await gtcrView.getItem(tcrAddress, itemID))
      } catch (err) {
        setItemInfo({ errored: true })
        console.error(`Error fetching item status for ${itemID}`, err)
      }
    })()
  }, [gtcrView, itemID, itemInfo, itemTCRAddr, tcrAddress])

  const statusCode = useMemo(() => {
    if (
      !itemInfo ||
      (itemInfo && itemInfo.erroed) ||
      !timestamp ||
      !challengePeriodDuration
    )
      return

    return itemToStatusCode(itemInfo, timestamp, challengePeriodDuration)
  }, [challengePeriodDuration, itemInfo, timestamp])

  return (
    <StyledOptionItem>
      <StyledStatus>
        <Badge
          color={
            typeof statusCode === 'number' ? STATUS_COLOR[statusCode] : '#ccc'
          }
        />
      </StyledStatus>
      <StyledFieldsContainer>
        {isTCRofTCRs ? (
          <>
            <StyledItemField>
              <DisplaySelector
                type={columns[1].type}
                value={columns[1].value}
                allowedFileTypes={columns[1].allowedFileTypes}
              />
            </StyledItemField>
            <StyledItemField>
              <DisplaySelector
                type={columns[0].type}
                value={columns[0].value}
                allowedFileTypes={columns[0].allowedFileTypes}
              />
            </StyledItemField>
          </>
        ) : (
          columns
            .filter(col => col.isIdentifier)
            .map((column, j) => (
              <StyledItemField key={j}>
                <DisplaySelector
                  type={column.type}
                  value={column.value}
                  allowedFileTypes={column.allowedFileTypes}
                  key={j}
                />
              </StyledItemField>
            ))
        )}
      </StyledFieldsContainer>
      <StyledLink to={`/tcr/${tcrAddress}/${itemID}`}>
        <Icon type="right-circle" style={{ fontSize: '24px' }} />
      </StyledLink>
    </StyledOptionItem>
  )
}

OptionItem.propTypes = {
  item: PropTypes.shape({
    itemID: PropTypes.string,
    columns: PropTypes.arrayOf(
      PropTypes.shape({
        type: PropTypes.oneOf(Object.values(ItemTypes)),
        value: PropTypes.string.isRequired
      })
    ),
    tcrAddress: PropTypes.string.isRequired
  }).isRequired
}

const SearchBar = () => {
  const [value, setValue] = useState()
  const [data, setData] = useState([])
  const { tcrAddress } = useContext(TCRViewContext)

  // Set the lazyQuery
  const [makeItemSearchQuery, itemSearchQuery] = useLazyQuery(ITEM_SEARCH_QUERY)

  // we dont need previous datasource
  // after doing text based query, we filter by tcr, only showing items in current list
  // cannot use first. before we need to filter by tcr in query.
  // in the future, add tcr field to itemSearch query in subgraph

  // cannot use trailing because I don't understand it
  // TODO
  const [debouncedCallback] = useDebouncedCallback(input => {
    console.log('update :3', itemSearchQuery)

    if (!input || input.length === 0) setData([])

    makeItemSearchQuery({ variables: { text: input } })
    if (itemSearchQuery.loading || !itemSearchQuery.data) setData([])
    else {
      const results = itemSearchQuery.data.itemSearch

      setData(results)
    }
  }, 700)

  const onSearch = useCallback(value => debouncedCallback(value), [
    debouncedCallback
  ])

  const options = data
    .filter(
      // only show items in current tcr.
      // deprecate this later in favor of querying the tcr directly.
      d => d.registry.id === tcrAddress
    )
    .slice(0, MAX_ITEM_COUNT) // deprecate this later in favor of querying first = MAX_ITEM_COUNT
    .map(d => {
      // Iterate through the item fields and find the first text field
      // to display on the input box.
      // If none are available use the first address field.
      // If none are available use the itemID.

      d.columns = d.props // better variable name
      const itemLabels = d.columns
        .filter(column => searchableFields.includes(column.type))
        .sort((a, b) => {
          if (a.type === ItemTypes.TEXT && b.type !== ItemTypes.TEXT) return -1
          if (b.type === ItemTypes.TEXT && a.type !== ItemTypes.TEXT) return 1
          return 0
        })
        .map(column => column.value)

      const label = itemLabels.length > 0 ? itemLabels[0] : d.itemID

      d.tcrAddress = d.registry.id // this is to satisfy prop fields for OptionItem

      return (
        <Select.Option key={d.itemID} label={label}>
          <OptionItem item={d} />
        </Select.Option>
      )
    })

  const onChange = useCallback(itemID => setValue(itemID), [])

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
      {options}
    </StyledSelect>
  )
}

export default SearchBar
