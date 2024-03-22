/* eslint-disable no-unused-vars */
// Rule disabled temporarly as filters will be added back.
import { Spin, Select } from 'antd'
import { useHistory, useParams } from 'react-router'
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
import ErrorPage from '../error-page'
import { WalletContext } from 'contexts/wallet-context'
import { TCRViewContext } from 'contexts/tcr-view-context'
import { bigNumberify } from 'ethers/utils'
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
import AppTour from 'components/tour'
import itemsTourSteps from './tour-steps'
import { DISPUTE_STATUS } from 'utils/item-status'
import { useLazyQuery } from '@apollo/client'
import { CLASSIC_REGISTRY_ITEMS_QUERY } from 'utils/graphql'
import {
  NSFW_FILTER_KEY,
  ITEMS_TOUR_DISMISSED,
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
  const history = useHistory()
  const search = window.location.search || ''
  const { tcrAddress, chainId } = useParams()
  const { requestWeb3Auth, timestamp } = useContext(WalletContext)
  const {
    gtcr,
    metaEvidence,
    challengePeriodDuration,
    tcrError,
    gtcrView,
    connectedTCRAddr,
    submissionDeposit
  } = useContext(TCRViewContext)
  const [submissionFormOpen, setSubmissionFormOpen] = useState()
  const refAttr = useRef()
  const [eventListenerSet, setEventListenerSet] = useState()
  const queryOptions = searchStrToFilterObjLight(search)
  const [nsfwFilterOn, setNSFWFilter] = useState(true)
  const [queryItemParams, setQueryItemParams] = useState()
  const [getItems, itemsQuery] = useLazyQuery(CLASSIC_REGISTRY_ITEMS_QUERY)

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

  // Load NSFW user setting from localforage.
  useEffect(() => {
    ;(async () => {
      const savedSetting = await localforage.getItem(NSFW_FILTER_KEY)
      if (typeof savedSetting === 'boolean') setNSFWFilter(savedSetting)
    })()
  }, [])

  const refreshItems = useCallback(
    () =>
      getItems({
        variables: {
          skip: (Number(page) - 1) * ITEMS_PER_PAGE,
          first: MAX_ENTITIES,
          orderDirection: orderDirection,
          where: itemsWhere
        }
      }),
    [getItems, itemsWhere, orderDirection, page]
  )

  useEffect(() => {
    if (!gtcr) return
    refreshItems()
  }, [gtcr, refreshItems])

  // big useEffect for fetching + encoding the data was transformed into
  // a basic useQuery hook to fetch data, and a memo to encode items
  // due to rerendering loop problems with useEffects
  const encodedItems = useMemo(() => {
    const { data, loading, called } = itemsQuery
    if (!data || loading || !called) return null
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
    })

    return items
  }, [itemsQuery])

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
    gtcr.on(gtcr.filters.ItemStatusChange(), () => refreshItems())
    refAttr.current = gtcr
  }, [eventListenerSet, gtcr, refreshItems])

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
  }, [requestWeb3Auth, search])

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
        requestWeb3Auth={requestWeb3Auth}
        setSubmissionFormOpen={setSubmissionFormOpen}
        connectedTCRAddr={connectedTCRAddr}
        tcrAddress={tcrAddress}
      />
      <StyledLayoutContent>
        <StyledContent>
          <Spin spinning={itemsQuery.loading || !metadata}>
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
                            history.push({
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
        steps={itemsTourSteps(metadata)}
      />
    </>
  )
}

export default Items
