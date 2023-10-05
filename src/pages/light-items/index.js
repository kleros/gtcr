/* eslint-disable no-unused-vars */
// Rule disabled temporarly as filters will be added back.
import { Layout, Spin, Pagination, Tag, Select, Switch } from 'antd'
import { useHistory, useParams } from 'react-router'
import React, {
  useEffect,
  useState,
  useContext,
  useMemo,
  useCallback
} from 'react'
import styled from 'styled-components/macro'
import localforage from 'localforage'
import qs from 'qs'
import ErrorPage from '../error-page'
import { WalletContext } from 'contexts/wallet-context'
import { LightTCRViewContext } from 'contexts/light-tcr-view-context'
import { bigNumberify } from 'ethers/utils'
import SubmitModal from '../light-item-details/modals/submit'
import SubmitConnectModal from '../light-item-details/modals/submit-connect'
import {
  filterLabelLight,
  LIGHT_FILTER_KEYS,
  searchStrToFilterObjLight,
  updateLightFilter
} from 'utils/filters'
import ItemCard from './item-card'
import Banner from './banner'
import AppTour from 'components/tour'
import itemsTourSteps from './tour-steps'
import takeLower from 'utils/lower-limit'
import { DISPUTE_STATUS } from 'utils/item-status'
import { useLazyQuery, useQuery } from '@apollo/client'
import { LIGHT_ITEMS_QUERY, LIGHT_REGISTRY_QUERY } from 'utils/graphql'
import LightSearchBar from 'components/light-search-bar'
import { parseIpfs } from 'utils/ipfs-parse'

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

// TODO: Ensure we don't set state for unmounted components using
// flags and AbortController.
//
// Reference:
// https://itnext.io/how-to-create-react-custom-hooks-for-data-fetching-with-useeffect-74c5dc47000a
const ITEMS_PER_PAGE = 40
const Items = () => {
  const history = useHistory()
  const { tcrAddress, chainId } = useParams()
  const search = window.location.search
  const { requestWeb3Auth, timestamp } = useContext(WalletContext)
  const {
    gtcr,
    metaEvidence,
    challengePeriodDuration,
    tcrError,
    gtcrView,
    connectedTCRAddr,
    submissionDeposit
  } = useContext(LightTCRViewContext)
  const [submissionFormOpen, setSubmissionFormOpen] = useState()
  const [error, setError] = useState()
  const queryOptions = searchStrToFilterObjLight(search)
  const [nsfwFilterOn, setNSFWFilter] = useState(true)
  const [queryItemParams, setQueryItemParams] = useState()
  const toggleNSFWFilter = useCallback(checked => {
    setNSFWFilter(checked)
    localforage.setItem(NSFW_FILTER_KEY, checked)
  }, [])
  const [decodedItems, setDecodedItems] = useState(undefined)

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
  const orderDirection = oldestFirst ? 'asc' : 'desc'

  const itemsWhere = useMemo(() => {
    if (absent) return { registry: tcrAddress.toLowerCase(), status: 'Absent' }
    if (registered)
      return { registry: tcrAddress.toLowerCase(), status: 'Registered' }
    if (submitted)
      return {
        registry: tcrAddress.toLowerCase(),
        status: 'RegistrationRequested'
      }
    if (removalRequested)
      return { registry: tcrAddress.toLowerCase(), status: 'ClearingRequested' }
    if (challengedSubmissions)
      return {
        registry: tcrAddress.toLowerCase(),
        status: 'RegistrationRequested',
        disputed: true
      }
    if (challengedRemovals)
      return {
        registry: tcrAddress.toLowerCase(),
        status: 'ClearingRequested',
        disputed: true
      }

    return { registry: tcrAddress.toLowerCase() }
  }, [
    absent,
    challengedRemovals,
    challengedSubmissions,
    registered,
    removalRequested,
    submitted,
    tcrAddress
  ])

  const [getItems, itemsQuery] = useLazyQuery(LIGHT_ITEMS_QUERY)

  const itemCount = useMemo(() => {
    if (!itemsQuery.data) return 0
    const r = itemsQuery.data.lregistry
    const field = queryOptions.countField
    if (queryOptions.countField === 'all') {
      const sum =
        Number(r.numberOfAbsent) +
        Number(r.numberOfRegistered) +
        Number(r.numberOfRegistrationRequested) +
        Number(r.numberOfClearingRequested) +
        Number(r.numberOfChallengedRegistrations) +
        Number(r.numberOfChallengedClearing)

      return sum
    } else return Number(r[field])
  }, [queryOptions.countField, itemsQuery.data])

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
    if (!gtcr) return
    refreshItems()
  }, [gtcr, refreshItems])

  useEffect(() => {
    ;(async () => {
      const { data, error, loading } = itemsQuery
      if (!gtcr || !data || error || loading) return

      if (error) {
        console.error(error)
        setError(error.message)
        return
      }
      let { litems: items } = data
      items = items.map(item => ({
        ...item,
        decodedData: item.props.map(({ value }) => value),
        mergedData: item.props
      }))
      // HACK:
      // the graph could have failed to include the props.
      // this may be because at indexing time, ipfs file was not available.
      // in that case, we can still manually fetch the props.
      const itemAssurancePromises = items.map(async i => {
        if (i.decodedData.length === 0) {
          const response = await fetch(parseIpfs(i.data))
          const item = await response.json()
          const mergedData = item.columns.map(column => ({
            label: column.label,
            description: column.description,
            type: column.type,
            isIdentifier: column.isIdentifier,
            value: item.values[column.label]
          }))
          const decodedData = mergedData.map(d => d.value)
          const newItem = { ...i, mergedData, decodedData, props: mergedData }
          return newItem
        } else return i
      })
      items = await Promise.all(itemAssurancePromises)
      items = items.map(
        ({
          itemID,
          status: statusName,
          requests,
          data,
          decodedData,
          mergedData
        }) => {
          const {
            disputed,
            disputeID,
            submissionTime,
            rounds,
            resolved,
            deposit
          } = requests[0] ?? {}

          const {
            appealPeriodStart,
            appealPeriodEnd,
            ruling,
            hasPaidRequester,
            hasPaidChallenger,
            amountPaidRequester,
            amountPaidChallenger
          } = rounds[0] ?? {}

          const currentRuling =
            ruling === 'None' ? 0 : ruling === 'Accept' ? 1 : 2
          const disputeStatus = !disputed
            ? DISPUTE_STATUS.WAITING
            : resolved
            ? DISPUTE_STATUS.SOLVED
            : Number(appealPeriodEnd) > Date.now() / 1000
            ? DISPUTE_STATUS.APPEALABLE
            : DISPUTE_STATUS.WAITING

          const graphStatusNameToCode = {
            Absent: 0,
            Registered: 1,
            RegistrationRequested: 2,
            ClearingRequested: 3
          }

          return {
            ID: itemID,
            itemID,
            status: graphStatusNameToCode[statusName],
            disputeStatus,
            disputed,
            data,
            decodedData,
            mergedData,
            disputeID,
            deposit,
            submissionTime: bigNumberify(submissionTime),
            hasPaid: [false, hasPaidRequester, hasPaidChallenger],
            currentRuling,
            appealStart: bigNumberify(appealPeriodStart),
            appealEnd: bigNumberify(appealPeriodEnd),
            amountPaid: [
              bigNumberify(0),
              bigNumberify(amountPaidRequester),
              bigNumberify(amountPaidChallenger)
            ]
          }
        }
      )
      setDecodedItems(items)
    })()
  }, [gtcr, itemsQuery])

  // Load NSFW user setting from localforage.
  useEffect(() => {
    ;(async () => {
      const savedSetting = await localforage.getItem(NSFW_FILTER_KEY)
      if (typeof savedSetting === 'boolean') setNSFWFilter(savedSetting)
    })()
  }, [])

  // More data wrangling/bandaid to deal with legacy code.
  // Most of this should be refactored or even better, deleted.
  const items = useMemo(() => {
    if (!metaEvidence || metaEvidence.address !== tcrAddress || !decodedItems)
      return

    return decodedItems.map((item, i) => {
      let decodedData
      const errors = []
      const { columns } = metaEvidence.metadata
      try {
        decodedData = item.decodedData
        // eslint-disable-next-line no-unused-vars
      } catch (err) {
        errors.push(`Error decoding item ${item.ID} of list at ${tcrAddress}`)
        console.warn(`Error decoding item ${item.ID} of list at ${tcrAddress}`)
        console.warn(err)
      }

      // Return the item columns along with its TCR status data.
      return {
        tcrData: {
          ...item, // Spread to convert from array to object.
          decodedData
        },
        columns: columns.map(
          (col, i) => ({
            value: decodedData && decodedData[i],
            ...col
          }),
          { key: i }
        ),
        errors
      }
    })
  }, [metaEvidence, tcrAddress, decodedItems])

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

  if (!tcrAddress)
    return (
      <ErrorPage
        code="404"
        message="The gods are having trouble finding this list."
        tip="Make sure your wallet is set to the correct network (is this on xDai?)."
      />
    )

  if (tcrError || error)
    return (
      <ErrorPage
        code="400"
        message={tcrError || error || 'Decoding this item.'}
      />
    )

  const { metadata } = metaEvidence || {}
  const { isConnectedTCR } = metadata || {}

  return (
    <>
      <Banner
        metaEvidence={metaEvidence}
        requestWeb3Auth={requestWeb3Auth}
        setSubmissionFormOpen={setSubmissionFormOpen}
        connectedTCRAddr={connectedTCRAddr}
        tcrAddress={tcrAddress}
      />
      <StyledLayoutContent>
        <StyledContent>
          <Spin spinning={itemsQuery.loading || !metadata}>
            <>
              <StyledTopPadding>
                <LightSearchBar />
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
                          history.push({
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
                        challengePeriodDuration={challengePeriodDuration}
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
        {metaEvidence && metadata && (
          <>
            {isConnectedTCR ? (
              <SubmitConnectModal
                visible={submissionFormOpen}
                onCancel={() => setSubmissionFormOpen(false)}
                tcrAddress={tcrAddress}
                gtcrView={gtcrView}
              />
            ) : (
              <SubmitModal
                visible={submissionFormOpen}
                onCancel={() => setSubmissionFormOpen(false)}
                submissionDeposit={submissionDeposit}
                challengePeriodDuration={challengePeriodDuration}
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
