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
import matchSorter from 'match-sorter'
import DisplaySelector from './display-selector'
import itemTypes, { onchainTextFields } from '../utils/item-types'
import { TCRViewContext } from '../bootstrap/tcr-view-context'
import { WalletContext } from '../bootstrap/wallet-context'
import { itemToStatusCode, STATUS_COLOR } from '../utils/item-status'

const StyledSelect = styled(Select)`
  margin: 24px 9.375vw;
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

const OptionItem = ({ item: { itemID, columns = [] } }) => {
  const { gtcrView, challengePeriodDuration, tcrAddress } = useContext(
    TCRViewContext
  )
  const { timestamp } = useContext(WalletContext)
  const [itemInfo, setItemInfo] = useState()

  useEffect(() => {
    if (!itemID || !gtcrView || !tcrAddress) return
    ;(async () => {
      try {
        setItemInfo(await gtcrView.getItem(tcrAddress, itemID))
      } catch (err) {
        console.error(`Error fetching item info for ${itemID}`, err)
      }
    })()
  }, [gtcrView, itemID, tcrAddress])

  const statusCode = useMemo(() => {
    if (!itemInfo || !timestamp || !challengePeriodDuration) return

    return itemToStatusCode(itemInfo, timestamp, challengePeriodDuration)
  }, [challengePeriodDuration, itemInfo, timestamp])

  return (
    <StyledOptionItem>
      <StyledStatus>
        <Badge color={statusCode ? STATUS_COLOR[statusCode] : '#ccc'} />
      </StyledStatus>
      <StyledFieldsContainer>
        {columns
          .filter(col => col.isIdentifier)
          .map((column, j) => (
            <StyledItemField>
              <DisplaySelector
                type={column.type}
                value={column.value}
                key={j}
              />
            </StyledItemField>
          ))}
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
        type: PropTypes.oneOf(Object.values(itemTypes)),
        value: PropTypes.string.isRequired
      })
    )
  }).isRequired
}

const SearchBar = ({ dataSource = [] }) => {
  const [value, setValue] = useState()
  const [data, setData] = useState([])
  const [debouncedCallback] = useDebouncedCallback(input => {
    if (!input || input.length === 0 || dataSource.length === 0) setData([])

    // Iterate every column and search for a match against the user input.
    const keys =
      dataSource.length > 0
        ? Object.keys(dataSource[0].keys).map(key => `keys.${key}`)
        : []
    const results =
      dataSource.length > 0
        ? matchSorter(dataSource, input, { keys })
            .map(result => ({
              itemID: result.itemID,
              columns: result.columns,
              text: result.itemID
            }))
            .splice(0, MAX_ITEM_COUNT) // Limit the number of items to be displayed.
        : []

    setData(results)
  }, 700)
  const onSearch = useCallback(value => debouncedCallback(value), [
    debouncedCallback
  ])

  const options = data.map(d => {
    // Iterate through the item fields and find the first text field
    // to display on the input box.
    // If none are available use the first address field.
    // If none are available use the itemID.
    const itemLabels = d.columns
      .filter(col => onchainTextFields.includes(col.type))
      .sort((a, b) => {
        if (a.type === itemTypes.TEXT && b.type !== itemTypes.TEXT) return -1
        if (b.type === itemTypes.TEXT && a.type !== itemTypes.TEXT) return 1
        return 0
      })
      .map(col => col.value)

    const label = itemLabels.length > 0 ? itemLabels[0] : d.itemID

    return (
      <Select.Option key={d.itemID} label={label}>
        <OptionItem item={d} />
      </Select.Option>
    )
  })

  const onChange = useCallback(itemID => setValue(itemID), [])

  return (
    <StyledSelect
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

SearchBar.propTypes = {
  dataSource: PropTypes.arrayOf(
    PropTypes.shape({
      itemID: PropTypes.string.isRequired,
      keys: PropTypes.arrayOf(PropTypes.string).isRequired,
      columns: PropTypes.arrayOf(
        PropTypes.shape({
          value: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
        })
      ).isRequired
    })
  )
}

SearchBar.defaultProps = {
  dataSource: []
}

export default SearchBar
