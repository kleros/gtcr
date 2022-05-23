import React, { useState, useEffect, useContext, useMemo } from 'react'
import PropTypes from 'prop-types'
import { Select, Badge, Icon } from 'antd'
import { Link } from 'react-router-dom'
import styled from 'styled-components/macro'
import { useDebouncedCallback } from 'use-debounce'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import DisplaySelector from './display-selector'
import { ItemTypes, searchableFields } from '@kleros/gtcr-encoder'
import { LightTCRViewContext } from 'contexts/light-tcr-view-context'
import { WalletContext } from 'contexts/wallet-context'
import { itemToStatusCode, STATUS_COLOR } from '../utils/item-status'
import { useLazyQuery } from '@apollo/client'
import ITEM_SEARCH_QUERY from '../utils/graphql/item-search'
import { useWeb3Context } from 'web3-react'

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

const OptionItem = ({ item }) => {
  // note
  // there are a few ethers queries coming from here.
  // they might have to be changed to subgraph queries
  // TODO read and figure it out
  const { itemID, props, registry } = item
  const { id: tcrAddress } = registry
  const {
    gtcrView,
    challengePeriodDuration,
    tcrAddress: itemTCRAddr,
    metaEvidence
  } = useContext(LightTCRViewContext)
  const { timestamp } = useContext(WalletContext)
  const web3Context = useWeb3Context()
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
                type={props[0].type}
                value={props[0].value}
                allowedFileTypes={props[0].allowedFileTypes}
              />
            </StyledItemField>
          </>
        ) : (
          props
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
      <StyledLink to={`/tcr/${web3Context.networkId}/${tcrAddress}/${itemID}`}>
        <Icon type="right-circle" style={{ fontSize: '24px' }} />
      </StyledLink>
    </StyledOptionItem>
  )
}

OptionItem.propTypes = {
  item: PropTypes.shape({
    itemID: PropTypes.string,
    props: PropTypes.arrayOf(
      PropTypes.shape({
        type: PropTypes.oneOf(Object.values(ItemTypes)),
        value: PropTypes.string.isRequired
      })
    ),
    registry: PropTypes.shape({
      id: PropTypes.string
    })
  }).isRequired
}

const LightSearchBar = () => {
  const [value, setValue] = useState()
  const [data, setData] = useState([])
  const { tcrAddress } = useContext(LightTCRViewContext)
  const [makeItemSearchQuery, itemSearchQuery] = useLazyQuery(ITEM_SEARCH_QUERY)

  const [debouncedCallback] = useDebouncedCallback(input => {
    if (!input || input.length === 0) setData([])
    else
      makeItemSearchQuery({
        variables: {
          text: `${tcrAddress.toLowerCase()} & ${input
            .trim()
            .replace(' ', ' & ')}:*`,
          first: MAX_ITEM_COUNT
        }
      })
  }, 700)

  useEffect(() => {
    const results = itemSearchQuery.data?.itemSearch || []
    setData(results)
  }, [itemSearchQuery])

  const options = data.map(d => {
    const itemLabels = d.props.filter(prop =>
      searchableFields.includes(prop.type)
    )

    let label
    if (itemLabels.length > 0)
      label =
        itemLabels.find(prop => prop.type === ItemTypes.TEXT)?.value ||
        itemLabels[0].value
    else label = d.itemID

    return (
      <Select.Option key={d.itemID} label={label}>
        <OptionItem item={d} tcrAddress={d.registry.id} />
      </Select.Option>
    )
  })

  const onSearch = value => debouncedCallback(value)
  const onChange = itemID => setValue(itemID)

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

export default LightSearchBar
