import { Layout, Pagination, Tag, Select, Switch, Spin } from 'antd'
import { useHistory } from 'react-router'
import React, { useEffect, useState, useContext, useCallback } from 'react'
import styled from 'styled-components/macro'
import localforage from 'localforage'
import qs from 'qs'
import ErrorPage from '../error-page'
import { WalletContext } from 'contexts/wallet-context'
import { bigNumberify } from 'ethers/utils'
import SubmitModal from '../light-item-details/modals/submit'
import SubmitConnectModal from '../light-item-details/modals/submit-connect'
import {
  filterLabelLight,
  LIGHT_FILTER_KEYS,
  searchStrToFilterObjLight,
  updateLightFilter
} from 'utils/helpers/filters'
import ItemCard from './item-card'
import Banner from './banner'
import AppTour from 'components/tour'
import itemsTourSteps from './tour-steps'
import LightSearchBar from 'components/light-search-bar'
import useTcrParams from 'hooks/use-tcr-params'
import { LightTCRViewContext } from 'contexts/light-tcr-view-context'
import { ITEMS_PER_PAGE, ORDER_DIR } from 'utils/constants'

const NSFW_FILTER_KEY = 'NSFW_FILTER_KEY'
const ITEMS_TOUR_DISMISSED = 'ITEMS_TOUR_DISMISSED'

const StyledTopPadding = styled.div`
  padding-top: 24px;
  display: flex;
`

const StyledContent = styled(Layout.Content)`
  word-break: break-word;
`

const StyledLayoutContent = styled.div`
  padding: 0 9.375vw 42px;
  display: flex;
  flex-direction: column;
`

const StyledFilters = styled.div`
  display: flex;
  margin-top: 24px;

  justify-content: space-between;
  @media (max-width: 479px) {
    flex-direction: column;
  }
`

const StyledSelect = styled(Select)`
  height: 32px;
`

const StyledTag = styled(Tag.CheckableTag)`
  margin-bottom: 12px;
  cursor: pointer;
  &.ant-tag-checkable-checked {
    background-color: #6826bf;
  }
`

const StyledPagination = styled(Pagination)`
  justify-content: flex-end;
  display: flex;
  flex-wrap: wrap;
  margin-top: 2em;
`

const StyledGrid = styled.div`
  display: grid;
  margin: 24px 0;
  grid-gap: 20px;
  grid-template-columns: repeat(auto-fill, minmax(225px, 1fr));
`

const StyledSwitch = styled(Switch)`
  margin-right: 8px;

  &.ant-switch-checked {
    background-color: #6826bf;
  }
`

const pagingItem = (_, type, originalElement) => {
  if (type === 'prev') return <span>Previous</span>
  if (type === 'next') return <span>Next</span>
  return originalElement
}

const Items = () => {
  const {
    push,
    location: { search }
  } = useHistory()
  const { tcrAddress, chainId } = useTcrParams()
  const { requestWeb3Auth, timestamp } = useContext(WalletContext)
  const {
    metaEvidence,
    regData,
    loading,
    items,
    setItemsWhere,
    setPage,
    setOrderDir,
    error
  } = useContext(LightTCRViewContext)

  const [submissionFormOpen, setSubmissionFormOpen] = useState()

  const [fetchItemCount, setFetchItemCount] = useState({
    fetchStarted: false,
    isFetching: false,
    data: null
  })

  const queryOptions = searchStrToFilterObjLight(search)
  const [nsfwFilterOn, setNSFWFilter] = useState(true)
  const [queryItemParams, setQueryItemParams] = useState()
  const toggleNSFWFilter = useCallback(checked => {
    setNSFWFilter(checked)
    localforage.setItem(NSFW_FILTER_KEY, checked)
  }, [])

  const {
    oldestFirst,
    page,
    absent,
    registered,
    submitted,
    removalRequested,
    challengedSubmissions,
    challengedRemovals
  } = queryOptions

  useEffect(() => {
    setOrderDir(oldestFirst ? ORDER_DIR.asc : ORDER_DIR.desc)
  }, [oldestFirst, setOrderDir])

  useEffect(() => {
    setPage(page)
  }, [page, setPage])

  useEffect(() => {
    let itemsWhere = {}
    if (absent) itemsWhere = { registry: tcrAddress, status: 'Absent' }
    if (registered) itemsWhere = { registry: tcrAddress, status: 'Registered' }
    if (submitted)
      itemsWhere = {
        registry: tcrAddress,
        status: 'RegistrationRequested'
      }
    if (removalRequested)
      itemsWhere = { registry: tcrAddress, status: 'ClearingRequested' }
    if (challengedSubmissions)
      itemsWhere = {
        registry: tcrAddress,
        status: 'RegistrationRequested',
        disputed: true
      }
    if (challengedRemovals)
      itemsWhere = {
        registry: tcrAddress,
        status: 'ClearingRequested',
        disputed: true
      }

    itemsWhere = { registry: tcrAddress }

    setItemsWhere(itemsWhere)
  }, [
    absent,
    challengedRemovals,
    challengedSubmissions,
    registered,
    removalRequested,
    submitted,
    tcrAddress,
    setItemsWhere
  ])

  // Load NSFW user setting from localforage.
  useEffect(() => {
    ;(async () => {
      const savedSetting = await localforage.getItem(NSFW_FILTER_KEY)
      if (typeof savedSetting === 'boolean') setNSFWFilter(savedSetting)
    })()
  }, [])

  // This component supports URL actions.
  // This means someone can be sent to curate with a bunch of data to submit
  // an item to a list.
  useEffect(() => {
    const params = qs.parse(search)
    if (!params['?action']) return

    const initialValues = []
    Object.keys(params)
      .filter(param => param !== '?action')
      .forEach(key => initialValues.push(params[key]))

    setQueryItemParams(initialValues)
    setSubmissionFormOpen(true)
  }, [requestWeb3Auth, search])

  // Fetch number of pages for the current filter
  // Previously this entailed doing a bunch of contract calls, but since
  // it now uses a subgraph, there are no async calls here anymore.
  // Maybe refactor or delete this code.
  useEffect(() => {
    if (fetchItemCount.isFetching || !fetchItemCount.fetchStarted || !regData)
      return

    setFetchItemCount({ isFetching: true })

    // Convert subgraph counters to filter names.
    const convertedCounts = {
      absent: regData.numberOfAbsent,
      removalRequested: regData.numberOfClearingRequested,
      registered: regData.numberOfRegistered,
      submitted: regData.numberOfRegistrationRequested,
      challengedRemovals: regData.numberOfChallengedClearing,
      challengedSubmissions: regData.numberOfChallengedRegistrations
    }
    const countByFilter = Object.entries(convertedCounts).reduce(
      (prev, entry) => ({ ...prev, [entry[0]]: Number(entry[1]) }),
      {}
    )
    const totalCount = Object.values(countByFilter).reduce(
      (prev, curr) => prev + curr,
      0
    )

    // For now, only OR combinations are allowed.
    // My challenges and my submissions are also not supported,
    // so we slice them off.
    const filters = Object.entries(queryOptions).filter(([_, val]) =>
      Object.entries(LIGHT_FILTER_KEYS)
        .slice(0, 6)
        .map(([, value]) => value)
        .includes(val)
    )

    const filterSelected = filters.length > 0
    const count = filterSelected ? countByFilter[filters[0][0]] : totalCount

    setFetchItemCount({
      fetchStarted: false,
      isFetching: false,
      data: count
    })
  }, [fetchItemCount, queryOptions, regData, tcrAddress])

  if (error)
    return <ErrorPage code="400" message={error || 'Decoding this item.'} />

  const { metadata } = metaEvidence || {}
  const { isConnectedTCR } = metadata || {}

  return (
    <>
      <Banner
        metaEvidence={metaEvidence}
        requestWeb3Auth={requestWeb3Auth}
        setSubmissionFormOpen={setSubmissionFormOpen}
        connectedTCRAddr={regData?.connectedTCR}
        tcrAddress={tcrAddress}
      />
      <StyledLayoutContent>
        <StyledContent>
          <Spin spinning={loading}>
            <StyledTopPadding>
              <LightSearchBar tcrAddress={tcrAddress} />
            </StyledTopPadding>
            <StyledFilters id="items-filters">
              <div>
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
                      key !== LIGHT_FILTER_KEYS.OLDEST_FIRST &&
                      key !== 'mySubmissions' &&
                      key !== 'myChallenges'
                  )
                  .map(key => (
                    <StyledTag
                      key={key}
                      checked={queryOptions[key]}
                      onChange={checked => {
                        const newQueryStr = updateLightFilter({
                          prevQuery: search,
                          filter: key,
                          checked
                        })
                        push({
                          search: newQueryStr
                        })
                        setFetchItemCount({ fetchStarted: true })
                      }}
                    >
                      {filterLabelLight[key]}
                    </StyledTag>
                  ))}
              </div>
              <StyledSelect
                defaultValue={oldestFirst ? 'oldestFirst' : 'newestFirst'}
                style={{ width: 120 }}
                onChange={val => {
                  const newQueryStr = updateLightFilter({
                    prevQuery: search,
                    filter: 'oldestFirst',
                    checked: val === 'oldestFirst'
                  })
                  push({
                    search: newQueryStr
                  })
                }}
              >
                <Select.Option value="newestFirst">Newest</Select.Option>
                <Select.Option value="oldestFirst">Oldest</Select.Option>
              </StyledSelect>
            </StyledFilters>
            <StyledGrid id="items-grid-view">
              {items &&
                items
                  .sort(({ tcrData: tcrDataA }, { tcrData: tcrDataB }) => {
                    // Display items with pending requests first.
                    if (!tcrDataA || !tcrDataB) return 0 // Handle errored TCRs.
                    if (!tcrDataA.resolved && tcrDataB.resolved) return -1
                    if (tcrDataA.resolved && !tcrDataB.resolved) return 1
                    return 0
                  })
                  .map((item, i) => (
                    <ItemCard
                      item={item}
                      key={i}
                      metaEvidence={metaEvidence}
                      chainId={chainId}
                      tcrAddress={tcrAddress}
                      challengePeriodDuration={bigNumberify(
                        regData?.challengePeriodDuration
                      )}
                      timestamp={timestamp}
                      forceReveal={!nsfwFilterOn}
                    />
                  ))}
            </StyledGrid>
            <StyledPagination
              total={fetchItemCount.data || 0}
              current={Number(queryOptions.page)}
              itemRender={pagingItem}
              pageSize={ITEMS_PER_PAGE}
              onChange={newPage => {
                push({
                  search: /page=\d+/g.test(search)
                    ? search.replace(/page=\d+/g, `page=${newPage}`)
                    : `${search}page=${newPage}`
                })
                setFetchItemCount({ fetchStarted: true })
              }}
            />
          </Spin>
        </StyledContent>
        {metaEvidence && metadata && (
          <>
            {isConnectedTCR ? (
              <SubmitConnectModal
                visible={submissionFormOpen}
                onCancel={() => setSubmissionFormOpen(false)}
                tcrAddress={tcrAddress}
              />
            ) : (
              <SubmitModal
                visible={submissionFormOpen}
                onCancel={() => setSubmissionFormOpen(false)}
                submissionDeposit={bigNumberify(regData?.submissionDeposit)}
                challengePeriodDuration={bigNumberify(
                  regData?.challengePeriodDuration
                )}
                tcrAddress={tcrAddress}
                metaEvidence={metaEvidence}
                initialValues={queryItemParams}
              />
            )}
          </>
        )}
      </StyledLayoutContent>
      <AppTour
        dismissedKey={ITEMS_TOUR_DISMISSED}
        steps={itemsTourSteps({ ...metadata, metaEvidence })}
      />
    </>
  )
}

export default Items
