/* eslint-disable no-unused-vars */
// Rule disabled temporarly as filters will be added back.
import { Layout, Spin, Pagination, Tag, Select, Switch } from 'antd'
import { Link } from 'react-router-dom'
import React, {
  useEffect,
  useState,
  useContext,
  useMemo,
  useCallback
} from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components/macro'
import localforage from 'localforage'
import { useWeb3Context } from 'web3-react'
import qs from 'qs'
import ErrorPage from '../error-page'
import { WalletContext } from '../../bootstrap/wallet-context'
import { TCRViewContext } from '../../bootstrap/tcr-view-context'
import { bigNumberify } from 'ethers/utils'
import SubmitModal from '../item-details/modals/submit'
import useNetworkEnvVariable from '../../hooks/network-env'
import SubmitConnectModal from '../item-details/modals/submit-connect'
import {
  filterLabel,
  FILTER_KEYS,
  searchStrToFilterObj,
  updateFilter
} from '../../utils/filters'
import ItemCard from './item-card'
import Banner from './banner'
import AppTour from '../../components/tour'
import itemsTourSteps from './tour-steps'
import takeLower from '../../utils/lower-limit'
import { DISPUTE_STATUS } from '../../utils/item-status'
import { useQuery } from '@apollo/client'
import { REGISTRY_QUERY } from '../../graphql'
import SearchBar from '../../components/search-bar'

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

const xDaiInfo = {
  name: 'xDAI Chain',
  chainId: 100,
  shortName: 'xdai',
  chain: 'XDAI',
  network: 'mainnet',
  networkId: 100,
  nativeCurrency: { name: 'xDAI', symbol: 'xDAI', decimals: 18 },
  rpc: [
    'https://rpc.xdaichain.com',
    'https://xdai.poanetwork.dev',
    'wss://rpc.xdaichain.com/wss',
    'wss://xdai.poanetwork.dev/wss',
    'http://xdai.poanetwork.dev',
    'https://dai.poa.network',
    'ws://xdai.poanetwork.dev:8546'
  ],
  faucets: [],
  explorers: [
    {
      name: 'blockscout',
      url: 'https://blockscout.com/xdai/',
      standard: 'EIP3091'
    }
  ],
  infoURL: 'https://forum.poa.network/c/xdai-chain'
}

const supportedNetworkURLs = JSON.parse(process.env.REACT_APP_RPC_URLS)
const mainnetInfo = {
  name: 'Ethereum Mainnet',
  chainId: 1,
  shortName: 'eth',
  chain: 'ETH',
  network: 'mainnet',
  networkId: 1,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpc: [supportedNetworkURLs[1]],
  faucets: [],
  explorers: [
    {
      name: 'etherscan',
      url: 'https://etherscan.io',
      standard: 'EIP3091'
    }
  ],
  infoURL: 'https://ethereum.org'
}

// TODO: Ensure we don't set state for unmounted components using
// flags and AbortController.
//
// Reference:
// https://itnext.io/how-to-create-react-custom-hooks-for-data-fetching-with-useeffect-74c5dc47000a
const ITEMS_PER_PAGE = 40
const Items = ({ search, history }) => {
  const { requestWeb3Auth, timestamp } = useContext(WalletContext)
  const { library, active, account, networkId } = useWeb3Context()
  const [network, setNetwork] = useState()
  const {
    gtcr,
    metaEvidence,
    challengePeriodDuration,
    tcrError,
    gtcrView,
    tcrAddress,
    connectedTCRAddr,
    submissionDeposit,
    metadataByTime
  } = useContext(TCRViewContext)
  const [submissionFormOpen, setSubmissionFormOpen] = useState()
  const [error, setError] = useState()
  const [fetchItems, setFetchItems] = useState({
    fetchStarted: false,
    isFetching: false,
    data: null
  })
  const [fetchItemCount, setFetchItemCount] = useState({
    fetchStarted: false,
    isFetching: false,
    data: null
  })
  const GTCR_SUBGRAPH_URL = useNetworkEnvVariable(
    'REACT_APP_SUBGRAPH_URL',
    networkId
  )

  const queryOptions = searchStrToFilterObj(search)
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
  const orderDirection = oldestFirst ? 'asc' : 'desc'

  // God of code forgive me for I have sinned (in many codebases)
  // GQL queries did not allow me to pass a dynamic where (or I did
  // not know how to do it) parameter the subgraph so I came up with
  // this monstruocity. If you know how to improve this, give it a
  // go. Perhaps add apollo back.
  const itemsWhere = useMemo(() => {
    if (absent)
      return `{ registry: "${tcrAddress.toLowerCase()}", status: Absent }`
    if (registered)
      return `{ registry: "${tcrAddress.toLowerCase()}", status: Registered }`
    if (submitted)
      return `{ registry: "${tcrAddress.toLowerCase()}", status: RegistrationRequested }`
    if (removalRequested)
      return `{ registry: "${tcrAddress.toLowerCase()}", status: ClearingRequested }`
    if (challengedSubmissions)
      return `{ registry: "${tcrAddress.toLowerCase()}", status: RegistrationRequested, disputed: true }`
    if (challengedRemovals)
      return `{ registry: "${tcrAddress.toLowerCase()}", status: ClearingRequested, disputed: true }`

    return `{ registry: "${tcrAddress.toLowerCase()}" }`
  }, [
    absent,
    challengedRemovals,
    challengedSubmissions,
    registered,
    removalRequested,
    submitted,
    tcrAddress
  ])

  useEffect(() => {
    ;(async () => {
      if (!gtcr) return
      const query = {
        query: `
          {
            items(
              skip: ${(Number(page) - 1) * ITEMS_PER_PAGE}
              first: ${ITEMS_PER_PAGE}
              orderDirection: ${orderDirection}
              orderBy: latestRequestSubmissionTime
              where: ${itemsWhere}
            ) {
              itemID
              status
              data
              props {
                value
                type
                label
                description
                isIdentifier
              }
              requests(first: 1, orderBy: submissionTime, orderDirection: desc) {
                disputed
                disputeID
                submissionTime
                resolved
                requester
                challenger
                resolutionTime
                rounds(first: 1, orderBy: creationTime, orderDirection: desc) {
                  appealPeriodStart
                  appealPeriodEnd
                  ruling
                  hasPaidRequester
                  hasPaidChallenger
                  amountPaidRequester
                  amountPaidChallenger
                }
              }
            }
          }
        `
      }
      setFetchItems({ isFetching: true })
      const { data, errors } = await (
        await fetch(GTCR_SUBGRAPH_URL, {
          method: 'POST',
          body: JSON.stringify(query)
        })
      ).json()
      if (errors) throw new Error(errors)
      let { items } = data ?? {}
      items = items.map(item => ({
        ...item,
        decodedData: item.props.map(({ value }) => value),
        mergedData: item.props
      }))
      items = items.map(
        ({
          itemID,
          status: statusName,
          requests,
          data,
          decodedData,
          mergedData
        }) => {
          const { disputed, disputeID, submissionTime, rounds, resolved } =
            requests[0] ?? {}

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
      setFetchItems({
        isFetching: false,
        fetchStarted: false,
        data: items,
        address: gtcr.address
      })
    })()
  }, [GTCR_SUBGRAPH_URL, gtcr, itemsWhere, orderDirection, page])

  const { data: registryData } = useQuery(REGISTRY_QUERY, {
    variables: {
      lowerCaseTCRAddress: tcrAddress.toLowerCase()
    }
  })

  const switchToSuggested = useCallback(async () => {
    if (!library || !active || !network) return
    if (network.chainId === 100)
      library.send('wallet_switchEthereumChain', [
        {
          chainId: `0x${mainnetInfo.chainId.toString(16)}`
        }
      ])
    else
      library.send('wallet_addEthereumChain', [
        {
          chainId: `0x${xDaiInfo.chainId.toString(16)}`,
          nativeCurrency: xDaiInfo.nativeCurrency,
          chainName: xDaiInfo.name,
          rpcUrls: xDaiInfo.rpc,
          blockExplorerUrls: xDaiInfo.explorers.url
        }
      ])
  }, [active, library, network])

  useEffect(() => {
    ;(async () => {
      if (!library || !active) return
      setNetwork(await library.getNetwork())
    })()
  }, [active, library])

  // Load NSFW user setting from localforage.
  useEffect(() => {
    ;(async () => {
      const savedSetting = await localforage.getItem(NSFW_FILTER_KEY)
      if (typeof savedSetting === 'boolean') setNSFWFilter(savedSetting)
    })()
  }, [])

  // Trigger fetch when gtcr instance is set.
  useEffect(() => {
    if (!gtcr) return
    setFetchItems({ fetchStarted: true })
    setFetchItemCount({ fetchStarted: true })
  }, [gtcr])

  const items = fetchItems

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
    if (
      !gtcrView ||
      fetchItemCount.isFetching ||
      !fetchItemCount.fetchStarted ||
      !gtcr ||
      !registryData
    )
      return

    if (gtcr.address !== tcrAddress) return
    setFetchItemCount({ isFetching: true })

    const { registry } = registryData || {}

    // Convert subgraph counters to filter names.
    const {
      numberOfAbsent: absent,
      numberOfClearingRequested: removalRequested,
      numberOfRegistered: registered,
      numberOfRegistrationRequested: submitted,
      numberOfChallengedClearing: challengedRemovals,
      numberOfChallengedRegistrations: challengedSubmissions
    } = registry || {}
    const convertedCounts = {
      absent,
      removalRequested,
      registered,
      submitted,
      challengedRemovals,
      challengedSubmissions
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
    const filters = Object.entries(queryOptions).filter(([key, val]) =>
      Object.entries(FILTER_KEYS)
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
  }, [fetchItemCount, gtcr, gtcrView, queryOptions, registryData, tcrAddress])

  if (!tcrAddress)
    return (
      <ErrorPage
        code="404"
        message="The gods are having trouble finding this list."
        tip="Make sure your wallet is set to the correct network (is this on xDai?)."
      />
    )

  const SuggestionsLink = () => (
    <span>
      Is your wallet in the correct network? Perhaps this list is on{' '}
      <Link onClick={switchToSuggested}>
        {network && network.chainId === 100 ? 'Mainnet' : 'xDai'}
      </Link>{' '}
    </span>
  )

  if (tcrError || error)
    return (
      <ErrorPage
        code="400"
        message={tcrError || error || 'Decoding this item.'}
        tip={<SuggestionsLink />}
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
          <Spin
            spinning={
              fetchItems.isFetching || fetchItemCount.isFetching || !metadata
            }
          >
            <>
              <StyledTopPadding>
                <SearchBar />
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
                        key !== FILTER_KEYS.PAGE &&
                        key !== FILTER_KEYS.OLDEST_FIRST &&
                        key !== 'mySubmissions' &&
                        key !== 'myChallenges'
                    )
                    .map(key => (
                      <StyledTag
                        key={key}
                        checked={queryOptions[key]}
                        onChange={checked => {
                          const newQueryStr = updateFilter({
                            prevQuery: search,
                            filter: key,
                            checked
                          })
                          history.push({
                            search: newQueryStr
                          })
                          setFetchItems({ fetchStarted: true })
                          setFetchItemCount({ fetchStarted: true })
                        }}
                      >
                        {filterLabel[key]}
                      </StyledTag>
                    ))}
                </div>
                <StyledSelect
                  defaultValue={oldestFirst ? 'oldestFirst' : 'newestFirst'}
                  style={{ width: 120 }}
                  onChange={val => {
                    const newQueryStr = updateFilter({
                      prevQuery: search,
                      filter: 'oldestFirst',
                      checked: val === 'oldestFirst'
                    })
                    history.push({
                      search: newQueryStr
                    })
                    setFetchItems({ fetchStarted: true })
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
                        tcrAddress={tcrAddress}
                        challengePeriodDuration={challengePeriodDuration}
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
                  history.push({
                    search: /page=\d+/g.test(search)
                      ? search.replace(/page=\d+/g, `page=${newPage}`)
                      : `${search}page=${newPage}`
                  })
                  setFetchItems({ fetchStarted: true })
                  setFetchItemCount({ fetchStarted: true })
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

Items.propTypes = {
  search: PropTypes.string.isRequired,
  history: PropTypes.shape({
    push: PropTypes.func.isRequired
  }).isRequired
}

export default Items
