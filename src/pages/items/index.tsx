/* eslint-disable no-unused-vars */
// Rule disabled temporarly as filters will be added back.
import { Card, Spin, Select } from 'components/ui'
import { useNavigate, useParams } from 'react-router-dom'
import React, {
  useEffect,
  useState,
  useContext,
  useMemo,
  useRef,
  useCallback
} from 'react'
import localforage from 'localforage'
import qs from 'qs'
import { useQuery } from '@tanstack/react-query'
import ErrorPage from '../error-page'
import { WalletContext } from 'contexts/wallet-context'
import { TCRViewContext } from 'contexts/tcr-view-context'
import { BigNumber } from 'ethers'
import { gtcrDecode } from '@kleros/gtcr-encoder'
import SubmitModal from '../item-details/modals/submit'
import SubmitConnectModal from '../item-details/modals/submit-connect'
import {
  searchStrToFilterObjLight,
  filterLabelLight,
  FILTER_KEYS,
  updateLightFilter
} from 'utils/filters'
import ItemCard from './item-card'
import Banner from './banner'
import { DISPUTE_STATUS } from 'utils/item-status'
import { CLASSIC_REGISTRY_ITEMS_QUERY } from 'utils/graphql'
import { getGraphQLClient } from 'utils/graphql-client'
import {
  NSFW_FILTER_KEY,
  StyledLayoutContent,
  StyledContent,
  StyledFilters,
  StyledSwitch,
  StyledTag,
  StyledSelect,
  StyledGrid,
  StyledPagination,
  FiltersContainer,
  ITEMS_PER_PAGE,
  pagingItem
} from 'pages/light-items'

// TODO: Ensure we don't set state for unmounted components using
// flags and AbortController.
//
// Reference:
// https://itnext.io/how-to-create-react-custom-hooks-for-data-fetching-with-useeffect-74c5dc47000a

const MAX_ENTITIES = 1000

const Items = () => {
  const navigate = useNavigate()
  const search = window.location.search || ''
  const { tcrAddress, chainId } = useParams()
  const { timestamp } = useContext(WalletContext)
  const {
    gtcr,
    metaEvidence,
    challengePeriodDuration,
    tcrError,
    gtcrView,
    connectedTCRAddr,
    submissionDeposit
  } = useContext(TCRViewContext)
  const [submissionFormOpen, setSubmissionFormOpen] = useState<boolean | undefined>()
  const refAttr = useRef<HTMLDivElement>()
  const [eventListenerSet, setEventListenerSet] = useState<boolean | undefined>()
  const queryOptions = searchStrToFilterObjLight(search)
  const [nsfwFilterOn, setNSFWFilter] = useState(true)
  const [queryItemParams, setQueryItemParams] = useState<Record<string, unknown> | undefined>()
  const client = useMemo(() => getGraphQLClient(chainId), [chainId])

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
  const orderDirection = oldestFirst ? 'asc' : 'desc'

  const itemsWhere = useMemo(() => {
    // Build conditions array for multi-select support
    const conditions = []

    if (absent) conditions.push({ status: { _eq: 'Absent' } })
    if (registered) conditions.push({ status: { _eq: 'Registered' } })
    if (submitted)
      conditions.push({
        status: { _eq: 'RegistrationRequested' },
        disputed: { _eq: false }
      })
    if (removalRequested)
      conditions.push({
        status: { _eq: 'ClearingRequested' },
        disputed: { _eq: false }
      })
    if (challengedSubmissions)
      conditions.push({
        status: { _eq: 'RegistrationRequested' },
        disputed: { _eq: true }
      })
    if (challengedRemovals)
      conditions.push({
        status: { _eq: 'ClearingRequested' },
        disputed: { _eq: true }
      })

    // No filters selected - return all items
    if (conditions.length === 0)
      return { registry_id: { _eq: tcrAddress.toLowerCase() } }

    // Single filter - no need for _or
    if (conditions.length === 1)
      return {
        registry_id: { _eq: tcrAddress.toLowerCase() },
        ...conditions[0]
      }

    // Multiple filters - use _or clause
    return {
      registry_id: { _eq: tcrAddress.toLowerCase() },
      _or: conditions
    }
  }, [
    absent,
    challengedRemovals,
    challengedSubmissions,
    registered,
    removalRequested,
    submitted,
    tcrAddress
  ])

  // Load NSFW user setting from localforage.
  useEffect(() => {
    ;(async () => {
      const savedSetting = await localforage.getItem(NSFW_FILTER_KEY)
      if (typeof savedSetting === 'boolean') setNSFWFilter(savedSetting)
    })()
  }, [])

  const queryVariables = useMemo(
    () => ({
      offset: (Number(page) - 1) * ITEMS_PER_PAGE,
      limit: MAX_ENTITIES,
      order_by: [{ latestRequestSubmissionTime: orderDirection }],
      where: itemsWhere
    }),
    [page, orderDirection, itemsWhere]
  )

  const itemsQuery = useQuery({
    queryKey: ['classicItems', queryVariables],
    queryFn: () => client.request(CLASSIC_REGISTRY_ITEMS_QUERY, queryVariables),
    enabled: !!client
  })

  // big useEffect for fetching + encoding the data was transformed into
  // a basic useQuery hook to fetch data, and a memo to encode items
  // due to rerendering loop problems with useEffects
  const encodedItems = useMemo(() => {
    if (!itemsQuery.data || itemsQuery.isLoading) return null
    let items = itemsQuery.data.items

    items = items.map(item => {
      const { disputed, disputeID, submissionTime, rounds, resolved, deposit } =
        item.requests[0] ?? {}

      const {
        appealPeriodStart,
        appealPeriodEnd,
        ruling,
        hasPaidRequester,
        hasPaidChallenger,
        amountPaidRequester,
        amountPaidChallenger
      } = rounds[0] ?? {}

      const currentRuling = ruling === 'None' ? 0 : ruling === 'Accept' ? 1 : 2
      const disputeStatus = !disputed
        ? DISPUTE_STATUS.WAITING
        : resolved
        ? DISPUTE_STATUS.SOLVED
        : Number(appealPeriodEnd) > Date.now() / 1000
        ? DISPUTE_STATUS.APPEALABLE
        : DISPUTE_STATUS.WAITING

      return {
        ...item,
        ID: item.itemID,
        itemID: item.itemID,
        disputeStatus,
        disputed,
        disputeID,
        deposit,
        submissionTime: BigNumber.from(submissionTime),
        hasPaid: [false, hasPaidRequester, hasPaidChallenger],
        currentRuling,
        appealStart: BigNumber.from(appealPeriodStart),
        appealEnd: BigNumber.from(appealPeriodEnd),
        amountPaid: [
          BigNumber.from(0),
          BigNumber.from(amountPaidRequester),
          BigNumber.from(amountPaidChallenger)
        ]
      }
    })

    return items
  }, [itemsQuery.data, itemsQuery.isLoading])

  // Decode items once meta evidence and items were fetched.
  const items = useMemo(() => {
    if (!metaEvidence || metaEvidence.address !== tcrAddress || !encodedItems)
      return

    return encodedItems.map((item, i) => {
      let decodedItem
      const errors = []
      const { columns } = metaEvidence.metadata
      try {
        decodedItem = gtcrDecode({ values: item.data, columns })
        // eslint-disable-next-line no-unused-vars
      } catch (err) {
        errors.push(
          `Error decoding item ${item.itemID} of list at ${tcrAddress}`
        )
        console.warn(
          `Error decoding item ${item.itemID} of list at ${tcrAddress}`
        )
      }

      // Return the item columns along with its TCR status data.
      return {
        tcrData: {
          ...item // Spread to convert from array to object.
        },
        columns: columns.map(
          (col, i) => ({
            value: decodedItem && decodedItem[i],
            ...col
          }),
          { key: i }
        ),
        errors
      }
    })
  }, [metaEvidence, tcrAddress, encodedItems])

  // Watch for submissions and status change events to refetch items.
  useEffect(() => {
    if (!gtcr || eventListenerSet) return
    setEventListenerSet(true)
    gtcr.on(gtcr.filters.ItemStatusChange(), () => itemsQuery.refetch())
    refAttr.current = gtcr
  }, [eventListenerSet, gtcr, itemsQuery])

  // Teardown listeners.
  useEffect(
    () => () => {
      if (!refAttr || !refAttr.current || !eventListenerSet) return
      refAttr.current.removeAllListeners(
        refAttr.current.filters.ItemStatusChange()
      )
    },
    [eventListenerSet]
  )

  // Check if there an action in the URL.
  useEffect(() => {
    const params = qs.parse(search)
    if (!params['?action']) return

    const initialValues = []
    Object.keys(params)
      .filter(param => param !== '?action')
      .forEach(key => initialValues.push(params[key]))

    setQueryItemParams(initialValues)
    setSubmissionFormOpen(true)
  }, [search])

  if (!tcrAddress)
    return (
      <ErrorPage
        code="404"
        message="The gods are having trouble finding this list."
        tip="Make sure your wallet is set to the correct network (is this on Gnosis Chain?)."
      />
    )

  if (tcrError)
    return <ErrorPage code="400" message={tcrError || 'Decoding this item.'} />

  const { metadata } = metaEvidence || {}
  const { isConnectedTCR } = metadata || {}

  // todo: the number of elements is currently wrong. it will never go beyond 20 pages.
  const itemCount = Math.floor(itemsQuery.data?.items?.length) ?? 0

  return (
    <>
      <Banner
        metaEvidence={metaEvidence}
        setSubmissionFormOpen={setSubmissionFormOpen}
        connectedTCRAddr={connectedTCRAddr}
        tcrAddress={tcrAddress}
      />
      <StyledLayoutContent>
        <StyledContent>
          <Spin spinning={itemsQuery.isLoading || !metadata}>
            <>
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
                        key !== FILTER_KEYS.PAGE &&
                        key !== FILTER_KEYS.OLDEST_FIRST &&
                        key !== 'mySubmissions' &&
                        key !== 'myChallenges'
                    )
                    .map(key =>
                      filterLabelLight[key] ? (
                        <StyledTag
                          key={key}
                          checked={queryOptions[key]}
                          onChange={checked => {
                            const newQueryStr = updateLightFilter({
                              prevQuery: search,
                              filter: key,
                              checked
                            })
                            navigate({
                              search: newQueryStr
                            })
                          }}
                        >
                          {filterLabelLight[key]}
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
                    navigate({
                      search: newQueryStr
                    })
                  }}
                >
                  <Select.Option value="newestFirst">Newest</Select.Option>
                  <Select.Option value="oldestFirst">Oldest</Select.Option>
                </StyledSelect>
              </FiltersContainer>
              <StyledGrid id="items-grid-view">
                {items
                  ? items
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
                      ))
                  : Array.from({ length: 8 }).map((_, i) => (
                      <Card key={i} style={{ height: '100%' }} loading />
                    ))}
              </StyledGrid>
              <StyledPagination
                total={itemCount || 0}
                current={Number(queryOptions.page)}
                itemRender={pagingItem}
                pageSize={ITEMS_PER_PAGE}
                onChange={newPage => {
                  navigate({
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
    </>
  )
}

export default Items
