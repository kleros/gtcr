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
import { ethers } from 'ethers'
import { useWeb3Context } from 'web3-react'
import { abi as _gtcr } from '@kleros/tcr/build/contracts/GeneralizedTCR.json'
import DisplaySelector from './display-selector'
import itemTypes, { searchableFields } from '../utils/item-types'
import { TCRViewContext } from '../bootstrap/tcr-view-context'
import { WalletContext } from '../bootstrap/wallet-context'
import { itemToStatusCode, STATUS_COLOR } from '../utils/item-status'

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
        type: PropTypes.oneOf(Object.values(itemTypes)),
        value: PropTypes.string.isRequired
      })
    ),
    tcrAddress: PropTypes.string.isRequired
  }).isRequired
}

const SearchBar = () => {
  const [value, setValue] = useState()
  const [data, setData] = useState([])
  const [enhancedDataSource, setEnhancedDataSource] = useState([])
  const {
    itemSubmissionLogs: dataSource,
    metaEvidence,
    tcrAddress
  } = useContext(TCRViewContext)
  const { library, active } = useWeb3Context()

  // If this is a TCR of TCRs, we should not only
  // match against the decoded item value but also against
  // the TCR name (which is a field inside metadatada of the meta evidence).
  // Otherwise, match only the decoded item value.
  useEffect(() => {
    const { metadata, address } = metaEvidence || {}
    if (!dataSource || !active || !metadata || address !== tcrAddress) return
    if (dataSource.length > 0 && dataSource[0].tcrAddress !== tcrAddress) return

    const { isTCRofTCRs } = metadata
    if (!isTCRofTCRs) {
      // Match against the item decoded value only.
      setEnhancedDataSource(dataSource)
      return
    }

    // Add the TCR name to the matchable fields.
    ;(async () => {
      setEnhancedDataSource(
        await Promise.all(
          dataSource.map(async item => {
            const addr = item.decodedData[0]
            const arbitrable = new ethers.Contract(addr, _gtcr, library)
            try {
              // Take the latest meta evidence.
              const logs = (
                await library.getLogs({
                  ...arbitrable.filters.MetaEvidence(),
                  fromBlock: 0
                })
              ).map(log => arbitrable.interface.parseLog(log))
              if (logs.length === 0)
                throw new Error('No meta evidence available for this address.')

              // Take the penultimate item. This is the most recent meta evidence
              // for registration requests.
              const { _evidence: metaEvidencePath } = logs[
                logs.length - 2
              ].values
              const { metadata } = await (
                await fetch(
                  process.env.REACT_APP_IPFS_GATEWAY + metaEvidencePath
                )
              ).json()
              const { tcrTitle } = metadata

              // Push TCR metadata into the item so it is also searchable.
              item.keys.push(tcrTitle)
              item.decodedData.push(tcrTitle)
              item.columns.push({
                description: 'The list title.',
                isIdentifier: true,
                label: 'Title',
                type: itemTypes.TEXT,
                value: tcrTitle
              })
              return item
            } catch (err) {
              console.warn('Could not load list searcheable name.', err)
              return item
            }
          })
        )
      )
    })()
  }, [active, dataSource, library, metaEvidence, tcrAddress])

  const [debouncedCallback] = useDebouncedCallback(input => {
    if (!input || input.length === 0 || enhancedDataSource.length === 0)
      setData([])

    const keys =
      enhancedDataSource.length > 0
        ? Object.keys(enhancedDataSource[0].keys).map(key => `keys.${key}`)
        : []
    // Iterate every column and search for a match against the user input.
    const results =
      enhancedDataSource.length > 0
        ? matchSorter(enhancedDataSource, input, { keys })
            .map(result => ({
              itemID: result.itemID,
              columns: result.columns,
              text: result.itemID,
              tcrAddress: result.tcrAddress
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
      .filter(col => searchableFields.includes(col.type))
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
