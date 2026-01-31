// fetch registry data (you need to know about the period cooldown)
// fetch items according to selected filter
// assign NSFW and render everything as usual

/* eslint-disable no-unused-vars */
// Rule disabled temporarly as filters will be added back.
import React, {
  useEffect,
  useState,
  useContext,
  useMemo,
  useCallback
} from 'react'
import styled, { css } from 'styled-components'
import { smallScreenStyle } from 'styles/small-screen-style'
import { Layout, Spin, Pagination, Tag, Select, Switch } from 'antd'
import { useHistory, useParams } from 'react-router'
import { bigNumberify } from 'ethers/utils'
import localforage from 'localforage'
import qs from 'qs'
import { abi as _arbitrator } from '@kleros/erc-792/build/contracts/IArbitrator.json'
import ErrorPage from '../error-page'
import { WalletContext } from 'contexts/wallet-context'
import SubmitModal from '../permanent-item-details/modals/submit'
import {
  filterLabelPermanent,
  LIGHT_FILTER_KEYS,
  searchStrToFilterObjPermanent,
  updateLightFilter
} from 'utils/filters'
import ItemCard from './item-card'
import Banner from './banner'
import { DISPUTE_STATUS } from 'utils/item-status'
import {
  ApolloClient,
  HttpLink,
  InMemoryCache,
  useLazyQuery,
  useQuery
} from '@apollo/client'
import { PERMANENT_ITEMS_QUERY, PERMANENT_REGISTRY_QUERY } from 'utils/graphql'
import PermanentSearchBar from 'components/permanent-search-bar'
import { parseIpfs } from 'utils/ipfs-parse'
import { subgraphUrlPermanent } from 'config/tcr-addresses'
import { ethers } from 'ethers'
import useArbitrationCost from 'hooks/arbitration-cost'
import { useWeb3Context } from 'web3-react'
import { getIPFSPath } from 'utils/get-ipfs-path'
import ipfsPublish from 'utils/ipfs-publish'

export const NSFW_FILTER_KEY = 'NSFW_FILTER_KEY'
export const ITEMS_TOUR_DISMISSED = 'ITEMS_TOUR_DISMISSED'

export const StyledTopPadding = styled.div`
  padding-top: 24px;
  display: flex;
`

export const StyledContent = styled(Layout.Content)`
  word-break: break-word;
`

export const StyledLayoutContent = styled.div`
  padding: 0 9.375vw 42px;
  display: flex;
  flex-direction: column;

  ${smallScreenStyle(
    () => css`
      padding: 0 16px 42px;
    `
  )}
`

export const FiltersContainer = styled.div`
  display: flex;
  margin-top: 24px;
  width: 100%;
  justify-content: space-between;

  ${smallScreenStyle(
    () => css`
      flex-direction: column;
    `
  )}
`

export const StyledFilters = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 0;
  flex: 1;
`

export const StyledSelect = styled(Select)`
  width: 120px;
  height: 32px;
  margin-left: auto;
  flex-shrink: 0;

  ${smallScreenStyle(
    () => css`
      &.ant-select {
        margin-top: 8px !important;
        margin-left: 0;
      }
    `
  )}
`

export const StyledTag = styled(Tag.CheckableTag)`
  cursor: pointer;
  transition: all 0.2s ease !important;

  &.ant-tag-checkable {
    background-color: ${({ theme }) =>
      theme.name === 'dark'
        ? theme.elevatedBackground
        : 'transparent'} !important;
    border: 1px solid ${({ theme }) => theme.filterBorderColor} !important;
    color: ${({ theme }) => theme.filterTextColor} !important;
    height: 32px;
    line-height: 30px;
    cursor: pointer;
  }

  &.ant-tag-checkable:hover {
    color: ${({ theme }) => theme.filterTextColor} !important;
    border-color: ${({ theme }) => theme.textPrimary} !important;
    cursor: pointer;
  }

  &.ant-tag-checkable-checked {
    background-color: ${({ theme }) => theme.buttonSecondaryBg} !important;
    border-color: ${({ theme }) => theme.buttonSecondaryBg} !important;
    color: ${({ theme }) => theme.buttonSecondaryText} !important;
  }
`

export const StyledPagination = styled(Pagination)`
  justify-content: flex-end;
  display: flex;
  flex-wrap: wrap;
  margin-top: 2em;
`

export const StyledGrid = styled.div`
  display: grid;
  margin: 24px 0;
  grid-gap: 20px;
  grid-template-columns: repeat(auto-fill, minmax(225px, 1fr));
`

export const StyledSwitch = styled(Switch)`
  &.ant-switch-checked {
    background-color: ${({ theme }) => theme.buttonSecondaryBg};
    margin-right: 8px;
  }

  &.ant-switch {
    margin-right: 8px;
  }
`
export const pagingItem = (_, type, originalElement) => {
  if (type === 'prev') return <span>Previous</span>
  if (type === 'next') return <span>Next</span>
  return originalElement
}

export const pgtcrApolloClientFactory = chainId =>
  new ApolloClient({
    link: new HttpLink({ uri: subgraphUrlPermanent[chainId] }),
    cache: new InMemoryCache()
  })

export const ITEMS_PER_PAGE = 40

const Items = () => {
  const history = useHistory()
  const { tcrAddress, chainId } = useParams()
  const search = window.location.search
  const { requestWeb3Auth, timestamp } = useContext(WalletContext)
  const [submissionFormOpen, setSubmissionFormOpen] = useState()
  const [error, setError] = useState()
  const [columns, setColumns] = useState()
  const queryOptions = searchStrToFilterObjPermanent(search)
  const [nsfwFilterOn, setNSFWFilter] = useState(true)
  const [queryItemParams, setQueryItemParams] = useState()
  const toggleNSFWFilter = useCallback(checked => {
    setNSFWFilter(checked)
    localforage.setItem(NSFW_FILTER_KEY, checked)
  }, [])
  const { library } = useWeb3Context()

  const pgtcrClient = useMemo(() => pgtcrApolloClientFactory(chainId), [
    chainId
  ])

  // get registry data first, you need some variables from here to query the items.
  const registryQuery = useQuery(PERMANENT_REGISTRY_QUERY, {
    variables: { lowerCaseTCRAddress: tcrAddress.toLowerCase() },
    client: pgtcrClient
  })

  const [getItems, itemsQuery] = useLazyQuery(PERMANENT_ITEMS_QUERY, {
    client: pgtcrClient
  })

  const { oldestFirst, page, absent, registered, disputed } = queryOptions

  const itemsWhere = useMemo(() => {
    // Build status array for multi-select support
    const statuses = []

    if (absent) statuses.push('Absent')
    if (registered) {
      statuses.push('Submitted')
      statuses.push('Reincluded')
    }
    if (disputed) statuses.push('Disputed')

    // No filters selected - return all items
    if (statuses.length === 0) return { registry: tcrAddress.toLowerCase() }

    // Use status_in for filtering (handles both single and multi-select)
    return {
      registry: tcrAddress.toLowerCase(),
      status_in: statuses
    }
  }, [absent, registered, disputed, tcrAddress])

  const orderDirection = oldestFirst ? 'asc' : 'desc'

  const refreshItems = useCallback(
    () =>
      getItems({
        variables: {
          skip: (Number(page) - 1) * ITEMS_PER_PAGE,
          first: ITEMS_PER_PAGE,
          orderDirection: orderDirection,
          where: itemsWhere,
          registryId: tcrAddress.toLowerCase()
        }
      }),
    [getItems, itemsWhere, orderDirection, page, tcrAddress]
  )

  useEffect(() => {
    if (!registryQuery.data || registryQuery.loading) return
    refreshItems()
  }, [refreshItems, registryQuery.data, registryQuery.loading])

  const itemCount = useMemo(() => {
    if (!registryQuery.data || !itemsQuery.data || !registryQuery.data.registry)
      return 0
    const r = registryQuery.data.registry

    // Count selected filters and sum their counts
    const hasAnyFilter = absent || registered || disputed

    if (!hasAnyFilter)
      // No filters - return total count
      return (
        Number(r.numberOfAbsent) +
        Number(r.numberOfRegistered) +
        Number(r.numberOfDisputed)
      )

    // Sum counts for selected filters
    let sum = 0
    if (absent) sum += Number(r.numberOfAbsent)
    if (registered) sum += Number(r.numberOfRegistered)
    if (disputed) sum += Number(r.numberOfDisputed)

    return sum
  }, [absent, registered, disputed, registryQuery.data, itemsQuery.data])

  // Load NSFW user setting from localforage.
  useEffect(() => {
    ;(async () => {
      const savedSetting = await localforage.getItem(NSFW_FILTER_KEY)
      if (typeof savedSetting === 'boolean') setNSFWFilter(savedSetting)
    })()
  }, [])

  const items = useMemo(() => (itemsQuery.data ? itemsQuery.data.items : []), [
    itemsQuery.data
  ])

  useEffect(() => {
    if (!registryQuery.data || !registryQuery.data.registry) return
    ;(async () => {
      const arbSetting = registryQuery.data.registry.arbitrationSettings[0]
      const response = await fetch(parseIpfs(arbSetting.metaEvidenceURI))
      const file = await response.json()
      setColumns(file.metadata.columns) // btw we do this because thegraph doesnt have it... would be nice
    })()
  }, [registryQuery.data])

  const arbitrationCost = useArbitrationCost({
    address: registryQuery.data?.registry?.arbitrator?.id,
    arbitratorExtraData:
      registryQuery.data?.registry?.arbitrationSettings?.[0]
        ?.arbitratorExtraData,
    library
  })

  // provisional early return
  if (!registryQuery.data) return null

  const r = registryQuery.data.registry
  const metadata = r?.arbitrationSettings?.[0]?.metadata

  if (!r)
    return (
      <ErrorPage
        code="404"
        message="The gods are having trouble finding this list."
        tip="Make sure your wallet is set to the correct network (is this on Gnosis Chain?)."
      />
    )

  return (
    <>
      <Banner
        metadata={metadata}
        requestWeb3Auth={requestWeb3Auth}
        setSubmissionFormOpen={setSubmissionFormOpen}
        tcrAddress={tcrAddress}
      />
      <StyledLayoutContent>
        <StyledContent>
          <Spin spinning={itemsQuery.loading || !metadata}>
            <>
              <StyledTopPadding>
                <PermanentSearchBar
                  items={items}
                  chainId={chainId}
                  tcrAddress={tcrAddress}
                />
              </StyledTopPadding>
              <FiltersContainer id="items-filters">
                <StyledFilters>
                  <StyledSwitch
                    checkedChildren="NSFW Filter: On"
                    unCheckedChildren="NSFW Filter: Off"
                    checked={nsfwFilterOn}
                    onChange={toggleNSFWFilter}
                  />
                  {Object.keys(queryOptions)
                    .filter(
                      key =>
                        key !== LIGHT_FILTER_KEYS.PAGE &&
                        key !== LIGHT_FILTER_KEYS.OLDEST_FIRST
                      // &&
                      // key !== 'mySubmissions' &&
                      // key !== 'myChallenges'
                    )
                    .map(key =>
                      filterLabelPermanent[key] ? (
                        <StyledTag
                          key={key}
                          checked={queryOptions[key]}
                          onChange={checked => {
                            const newQueryStr = updateLightFilter({
                              prevQuery: search,
                              filter: key,
                              checked
                            })
                            history.push({
                              search: newQueryStr
                            })
                          }}
                        >
                          {filterLabelPermanent[key]}
                        </StyledTag>
                      ) : null
                    )}
                </StyledFilters>
                <StyledSelect
                  defaultValue={oldestFirst ? 'oldestFirst' : 'newestFirst'}
                  onChange={val => {
                    const newQueryStr = updateLightFilter({
                      prevQuery: search,
                      filter: 'oldestFirst',
                      checked: val === 'oldestFirst'
                    })
                    history.push({
                      search: newQueryStr
                    })
                  }}
                >
                  <Select.Option value="newestFirst">Newest</Select.Option>
                  <Select.Option value="oldestFirst">Oldest</Select.Option>
                </StyledSelect>
              </FiltersContainer>
              <StyledGrid id="items-grid-view">
                {items &&
                  items
                    // we're already kinda sorting them, no? this was legacy
                    // .sort(
                    //   (
                    //     { status: statusA, includedAt: includedAtA },
                    //     { status: statusB, includedAt: includedAtB }
                    //   ) => {
                    //     // Display items with pending requests first.
                    //     if (!statusA || !statusB) return 0 // Handle errored TCRs.
                    //     // you are pending if:

                    //     if (!tcrDataA.resolved && tcrDataB.resolved) return -1
                    //     if (tcrDataA.resolved && !tcrDataB.resolved) return 1
                    //     return 0
                    //   }
                    // )
                    .map((item, i) => (
                      <ItemCard
                        item={item}
                        columns={columns}
                        key={item.itemID}
                        metadata={metadata}
                        chainId={chainId}
                        tcrAddress={tcrAddress}
                        registry={r}
                        timestamp={timestamp}
                        forceReveal={!nsfwFilterOn}
                      />
                    ))}
              </StyledGrid>
              <StyledPagination
                total={itemCount || 0}
                current={Number(queryOptions.page)}
                itemRender={pagingItem}
                pageSize={ITEMS_PER_PAGE}
                onChange={newPage => {
                  history.push({
                    search: /page=\d+/g.test(search)
                      ? search.replace(/page=\d+/g, `page=${newPage}`)
                      : `${search}&page=${newPage}`
                  })
                }}
              />
            </>
          </Spin>
        </StyledContent>
        {metadata && columns && arbitrationCost.arbitrationCost && (
          <>
            <SubmitModal
              visible={submissionFormOpen}
              onCancel={() => setSubmissionFormOpen(false)}
              submissionDeposit={r.submissionMinDeposit}
              submissionPeriod={r.submissionPeriod}
              arbitrationCost={arbitrationCost.arbitrationCost}
              withdrawingPeriod={r.withdrawingPeriod}
              tcrAddress={tcrAddress}
              tokenAddress={r.token}
              metadata={metadata}
              columns={columns}
              initialValues={queryItemParams}
            />
          </>
        )}
      </StyledLayoutContent>
    </>
  )
}

export default Items
