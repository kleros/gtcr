import React, {
  useState,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useCallback,
} from 'react'
import styled from 'styled-components'
import { Badge } from 'components/ui'
import Icon from 'components/ui/Icon'
import { Link } from 'react-router-dom'
import useUrlChainId from 'hooks/use-url-chain-id'
import { useQuery } from '@tanstack/react-query'
import { useDebouncedCallback } from 'use-debounce'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import DisplaySelector from './display-selector'
import { LightTCRViewContext } from 'contexts/light-tcr-view-context'
import { WalletContext } from 'contexts/wallet-context'
import { itemToStatusCode, STATUS_COLOR } from '../utils/item-status'
import ITEM_SEARCH_QUERY from '../utils/graphql/item-search'
import { getGraphQLClient } from 'utils/graphql-client'

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
}

const OptionItem = ({ item }: OptionItemProps) => {
  const { itemID, props, registry } = item
  const { id: tcrAddress } = registry
  const {
    gtcrView,
    challengePeriodDuration,
    tcrAddress: itemTCRAddr,
    metaEvidence,
  } = useContext(LightTCRViewContext)
  const { timestamp } = useContext(WalletContext)
  const chainId = useUrlChainId()
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
            typeof statusCode === 'number' ? STATUS_COLOR[statusCode] : 'gray'
          }
        />
      </StyledStatus>
      <StyledFieldsContainer>
        {isTCRofTCRs ? (
          <>
            <StyledItemField>
              <DisplaySelector
                type={props?.[0]?.type}
                value={props?.[0]?.value}
                allowedFileTypes={props?.[0]?.allowedFileTypes}
              />
            </StyledItemField>
          </>
        ) : (
          props
            .filter((col) => col.isIdentifier)
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
      <StyledLink to={`/tcr/${chainId}/${tcrAddress}/${itemID}`}>
        <Icon type="right-circle" style={{ fontSize: '24px' }} />
      </StyledLink>
    </StyledOptionItem>
  )
}

const LightSearchBar = () => {
  const [inputValue, setInputValue] = useState('')
  const [data, setData] = useState<SubgraphItem[]>([])
  const [writing, setWriting] = useState(false)
  const [focused, setFocused] = useState(false)
  const { tcrAddress } = useContext(LightTCRViewContext)
  const chainId = useUrlChainId()
  const client = useMemo(
    () => (chainId ? getGraphQLClient(chainId) : null),
    [chainId],
  )
  const containerRef = useRef<HTMLDivElement>(null)

  const [searchVariables, setSearchVariables] = useState<Record<
    string,
    unknown
  > | null>(null)

  const itemSearchQuery = useQuery({
    queryKey: ['itemSearch', searchVariables],
    queryFn: () => client!.request(ITEM_SEARCH_QUERY, searchVariables),
    enabled: !!searchVariables && !!client,
  })

  const debouncedSearch = useDebouncedCallback((input: string) => {
    if (!input || input.length === 0) {
      setData([])
      setSearchVariables(null)
    } else {
      const where = {
        keywords: { _ilike: `%${input.trim()}%` },
        registry_id: { _eq: tcrAddress.toLowerCase() },
      }
      setSearchVariables({
        where: where,
        limit: MAX_ITEM_COUNT,
      })
    }
    setWriting(false)
  }, 700)

  useEffect(() => {
    const results = itemSearchQuery.data?.itemSearch || []
    setData(results)
  }, [itemSearchQuery.data])

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
  const isLoading = writing || itemSearchQuery.isLoading

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
          {isLoading ? (
            <DropdownMessage>Loading...</DropdownMessage>
          ) : data.length === 0 ? (
            <DropdownMessage>No results</DropdownMessage>
          ) : (
            data.map((d) => (
              <DropdownItem key={d.itemID} onClick={() => setFocused(false)}>
                <OptionItem item={d} />
              </DropdownItem>
            ))
          )}
        </Dropdown>
      )}
    </Container>
  )
}

export default LightSearchBar
