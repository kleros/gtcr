import { Layout, Pagination, Tag, Select, Switch, Spin } from 'antd'
import { useHistory } from 'react-router'
import React, {
  useEffect,
  useState,
  useContext,
  useCallback,
  useMemo
} from 'react'
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
import { FILTER_STATUS, ITEMS_PER_PAGE } from 'utils/constants'
import { OrderDir } from 'types/schema'
import { ItemsWhere } from 'hooks/use-light-tcr-context'
import { CheckableTagProps } from 'antd/lib/tag'
import { SelectProps } from 'antd/lib/select'
import { IsEmpty } from 'utils/helpers'

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

const StyledSelect = styled(Select)<SelectProps>`
  height: 32px;
` as any

const StyledTag: React.FC<CheckableTagProps> = styled(Tag.CheckableTag)`
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

const PaginationItemRenderer = (
  _: any,
  type: string,
  originalElement: React.ReactNode
) => {
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

  const [submissionFormOpen, setSubmissionFormOpen] = useState<boolean>(false)
  const queryOptions = searchStrToFilterObjLight(search)
  const [nsfwFilterOn, setNSFWFilter] = useState(true)
  const [queryItemParams, setQueryItemParams] = useState<string[]>()
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

  const itemCount = useMemo(() => {
    if (IsEmpty(regData)) return 0

    const countByFilter: { [key: string]: number } = {
      absent: Number(regData?.numberOfAbsent),
      removalRequested: Number(regData?.numberOfClearingRequested),
      registered: Number(regData?.numberOfRegistered),
      submitted: Number(regData?.numberOfRegistrationRequested),
      challengedRemovals: Number(regData?.numberOfChallengedClearing),
      challengedSubmissions: Number(regData?.numberOfChallengedRegistrations)
    }

    const totalCount = Object.values(countByFilter).reduce(
      (sum, val) => sum + val,
      0
    )
    const filter = Object.keys(queryOptions).find(
      key =>
        Object.prototype.hasOwnProperty.call(countByFilter, key) &&
        queryOptions[key]
    )
    const count = filter ? countByFilter[filter] : totalCount
    const totalPages = Math.ceil(count / ITEMS_PER_PAGE)
    const currentPage = Number(queryOptions.page)

    if (totalPages && currentPage > totalPages)
      push({ search: search.replace(/page=\d+/g, `page=${totalPages}`) })

    return count
  }, [queryOptions, regData, push, search])

  useEffect(() => {
    setOrderDir(oldestFirst ? OrderDir.asc : OrderDir.desc)
  }, [oldestFirst, setOrderDir])

  useEffect(() => setPage(Number(page)), [page, setPage])

  useEffect(() => {
    const itemsWhere = { registry: tcrAddress } as ItemsWhere
    if (absent) itemsWhere.status = FILTER_STATUS.absent
    if (registered) itemsWhere.status = FILTER_STATUS.registered
    if (submitted) itemsWhere.status = FILTER_STATUS.submitted
    if (removalRequested) itemsWhere.status = FILTER_STATUS.removalRequested
    if (challengedSubmissions) {
      itemsWhere.status = FILTER_STATUS.challengedSubmissions
      itemsWhere.disputed = true
    }
    if (challengedRemovals) {
      itemsWhere.status = FILTER_STATUS.challengedRemovals
      itemsWhere.disputed = true
    }
    setItemsWhere(itemsWhere)
  }, [
    absent,
    registered,
    submitted,
    removalRequested,
    challengedSubmissions,
    challengedRemovals,
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

    const initialValues = [] as Array<string>
    Object.keys(params)
      .filter(param => param !== '?action')
      .forEach(key => initialValues.push(params[key] as string))

    setQueryItemParams(initialValues)
    setSubmissionFormOpen(true)
  }, [requestWeb3Auth, search])

  if (error)
    return (
      <ErrorPage code="400" message={error.message || 'Decoding this item.'} />
    )

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
                      checked={Boolean(queryOptions[key])}
                      onChange={checked => {
                        const newQueryStr = updateLightFilter({
                          prevQuery: search,
                          filter: key,
                          checked
                        })
                        push({
                          search: newQueryStr
                        })
                      }}
                    >
                      {filterLabelLight[key]}
                    </StyledTag>
                  ))}
              </div>
              <StyledSelect
                defaultValue={oldestFirst ? 'oldestFirst' : 'newestFirst'}
                style={{ width: 120 }}
                onChange={(val: string) => {
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
                  .sort((item1, item2) => {
                    // Display items with pending requests first.
                    if (!item1 || !item2) return 0 // Handle errored TCRs.
                    if (!item1.resolved && item2.resolved) return -1
                    if (item1.resolved && !item2.resolved) return 1
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
                        regData?.challengePeriodDuration as string
                      )}
                      timestamp={timestamp}
                      forceReveal={!nsfwFilterOn}
                    />
                  ))}
            </StyledGrid>
            <StyledPagination
              total={itemCount}
              current={Number(queryOptions.page)}
              itemRender={PaginationItemRenderer}
              pageSize={ITEMS_PER_PAGE}
              onChange={newPage => {
                push({
                  search: /page=\d+/g.test(search)
                    ? search.replace(/page=\d+/g, `page=${newPage}`)
                    : `${search}&page=${newPage}`
                })
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
                submissionDeposit={bigNumberify(
                  regData?.submissionDeposit as string
                )}
                challengePeriodDuration={bigNumberify(
                  regData?.challengePeriodDuration as string
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
