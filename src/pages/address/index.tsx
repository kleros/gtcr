import React, { useCallback, useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { isAddress } from 'viem'
import useDocumentHead from 'hooks/use-document-head'
import useNow from 'hooks/use-now'
import useStoredLayout from 'hooks/use-stored-layout'
import { Page, truncateMiddle } from 'components/curate/primitives'
import { reveal } from 'components/curate/motion/reveal'
import ErrorPage from 'pages/error-page'
import {
  ZERO_ADDRESS,
  fetchDashboardData,
  normalizeAddress,
} from 'pages/dashboard/data'
import {
  ACTIVITY_LIMIT,
  SUPPORTED_CHAIN_IDS,
  buildBadges,
  chainName,
  emptyStats,
  fetchAddressProfileData,
  fetchGovernedRegistries,
  type AddressProfileData,
  type AddressStats,
  type GovernedRegistry,
} from './data'
import { GovernancePanel } from './governance'
import {
  readVerifiedSets,
  withVerified,
} from 'components/curate/registry-shared-verified'
import {
  PAGE_SIZE,
  activeChains,
  filterActivities,
  inScope,
  parseFilter,
  parseScope,
  type ActivityFilter,
} from './view'
import { ProfilePanel } from './profile'
import { ActivitySection } from './activity'

/*
 * Curator profile (/address/:address): who this address is on Curate. One
 * featured panel leads with the entries it submitted, its other counts, its
 * requests and challenges over time and its challenge record; its actions
 * follow as rows, then the lists it governs (only when it governs one).
 * Every number comes from the profile data and describes the chosen scope
 * (all chains or one, ?chain=); nothing the data layer lacks (rewards, entry
 * status) is shown. The governance scan (one governor() read per indexed
 * list) is its own query, so the figures, chart and list never wait for it.
 */

const Governed = styled.div`
  ${reveal}
`

const AddressPage = () => {
  const params = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const address = normalizeAddress(params.address)
  const validAddress = isAddress(address)
  const isZero = address === ZERO_ADDRESS
  const filter = parseFilter(searchParams.get('show'))
  const scope = parseScope(searchParams.get('chain'))
  const [page, setPage] = useState(1)
  const [layout, setLayout] = useStoredLayout('address', 'rows')
  const now = useNow(30_000)
  const { address: connectedAddress, isConnected } = useAccount()
  const isYou =
    validAddress &&
    isConnected &&
    normalizeAddress(connectedAddress) === address

  // An invalid address renders the error page, which names itself.
  useDocumentHead(
    validAddress
      ? `Curator ${truncateMiddle(address)} · Kleros Curate`
      : undefined,
    validAddress
      ? `Submissions, removals, challenges and governed lists of ${address} across Kleros Curate registries.`
      : undefined,
  )

  // The registry index comes from the dashboard's own query, so the profile,
  // the governance scan and the dashboard and browse pages share one load
  // and its cache. Kleros Verified is stamped by the shared rule (the
  // registry pages' and Browse's cached sets), never taken from the index.
  const queryClient = useQueryClient()
  const readIndex = useCallback(async () => {
    const [dashboard, sets] = await Promise.all([
      queryClient.fetchQuery({
        queryKey: ['curateDashboard'],
        queryFn: fetchDashboardData,
        staleTime: 60_000,
      }),
      readVerifiedSets(SUPPORTED_CHAIN_IDS, queryClient),
    ])
    return withVerified(dashboard.registries, sets)
  }, [queryClient])

  const query = useQuery({
    queryKey: ['addressProfile', address],
    queryFn: () => fetchAddressProfileData(address, readIndex),
    enabled: validAddress,
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
  const data: AddressProfileData | undefined = query.data
  // isPending is false once the query errors, so the error state can render.
  const loading = validAddress && query.isPending

  // Under the profile's key, so a governor update that invalidates
  // ['addressProfile'] or ['addressProfile', address] refreshes it too.
  const governedQuery = useQuery({
    queryKey: ['addressProfile', address, 'governed'],
    queryFn: () => fetchGovernedRegistries(address, readIndex),
    enabled: validAddress,
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
  const governedAll: GovernedRegistry[] | undefined = governedQuery.data
  const governedPending = validAddress && governedQuery.isPending

  const setParam = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(searchParams)
    if (value === fallback) next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
  }
  const setFilter = (value: ActivityFilter) => setParam('show', value, 'all')
  const setScope = (value: string) => setParam('chain', value, 'all')

  useEffect(() => {
    setPage(1)
  }, [filter, scope, address])

  // The profile's per-chain figures with the governed lists added once the
  // scan settles, so a chain the address only governs on gets its chip.
  const breakdown = useMemo(() => {
    if (!data) return undefined
    const merged: Record<number, AddressStats> = {}
    for (const [chainId, chainStats] of Object.entries(data.chainBreakdown))
      merged[Number(chainId)] = { ...chainStats }
    for (const registry of governedAll ?? []) {
      if (!merged[registry.chainId]) merged[registry.chainId] = emptyStats()
      merged[registry.chainId].governedLists += 1
    }
    return merged
  }, [data, governedAll])
  const chains = useMemo(() => activeChains(breakdown), [breakdown])
  const governed = useMemo(
    () =>
      (governedAll ?? []).filter((registry) =>
        inScope(scope, registry.chainId),
      ),
    [governedAll, scope],
  )
  const activities = useMemo(
    () =>
      (data?.activities ?? []).filter((activity) =>
        inScope(scope, activity.chainId),
      ),
    [data, scope],
  )
  const shown = useMemo(
    () => filterActivities(activities, filter),
    [activities, filter],
  )
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = shown.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  const stats: AddressStats | undefined = data
    ? scope === 'all'
      ? { ...data.stats, governedLists: governedAll?.length ?? 0 }
      : (breakdown?.[scope] ?? emptyStats())
    : undefined
  const badges = data
    ? scope === 'all'
      ? data.badges
      : buildBadges(stats ?? emptyStats())
    : undefined
  const listed = data?.activities.length ?? 0
  const complete = listed < ACTIVITY_LIMIT
  const capped = (data?.cappedChains ?? []).filter((chainId) =>
    inScope(scope, chainId),
  )
  // A quiet scope says so once, in the profile panel; no empty list below.
  const quiet = !loading && !query.isError && activities.length === 0
  const chainList =
    scope === 'all'
      ? SUPPORTED_CHAIN_IDS.map(chainName).join(', ')
      : chainName(scope)

  if (!validAddress)
    return (
      <ErrorPage
        code="400"
        title="Not an address"
        message="A profile is /address/ followed by a 0x address of 40 hex characters."
      />
    )

  return (
    <Page>
      <ProfilePanel
        address={address}
        isYou={isYou}
        isZero={isZero}
        loading={loading}
        error={query.isError}
        onRetry={() => query.refetch()}
        generatedAt={data?.generatedAt}
        scope={scope}
        onScope={setScope}
        chains={chains}
        stats={stats}
        governedCount={governedPending ? undefined : governed.length}
        governedError={governedQuery.isError && !governedAll}
        activities={activities}
        complete={complete}
        listed={listed}
        capped={capped}
        now={now}
      />

      {!query.isError && !quiet && (
        <ActivitySection
          address={address}
          loading={loading}
          activities={activities}
          shown={shown}
          visible={visible}
          filter={filter}
          onFilter={setFilter}
          page={currentPage}
          onPage={setPage}
          layout={layout}
          onLayout={setLayout}
          badges={badges}
          badgeScope={scope === 'all' ? 'All chains' : chainName(scope)}
          truncated={!complete}
          chainList={chainList}
          now={now}
        />
      )}

      {/* Only an address that governs a list gets the section: most govern
          none, and the hero's figure already says so. */}
      {!query.isError && !loading && governed.length > 0 && (
        <Governed style={{ ['--i' as string]: 4 }}>
          <GovernancePanel
            registries={governed}
            profileAddress={address}
            loading={governedPending}
            isZero={isZero}
          />
        </Governed>
      )}
    </Page>
  )
}

export default AddressPage
