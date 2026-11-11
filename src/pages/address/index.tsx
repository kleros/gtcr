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
  fetchTestnetDashboardData,
  normalizeAddress,
} from 'pages/dashboard/data'
import {
  DASHBOARD_QUERY_KEY,
  DASHBOARD_STALE_MS,
  TESTNET_DASHBOARD_QUERY_KEY,
} from 'pages/dashboard/query'
import { seedSavedLoads } from 'pages/dashboard/saved-load'
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
  type RegistryIndex,
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

/** How long a profile's read (and its governance scan) counts as fresh. */
const PROFILE_REFRESH_MS = 5 * 60_000

/** How long the registry index stays cached for an open profile. */
const INDEX_GC_MS = 30 * 60_000

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
      ? `Curator ${truncateMiddle(address)} | Kleros Curate`
      : undefined,
    validAddress
      ? `Submissions, removals, challenges and governed lists of ${address} across Kleros Curate registries.`
      : undefined,
  )

  // The registry index comes from the dashboard's own queries (the mainnets
  // and the testnet, every chain a profile covers), so the profile, the
  // governance scan and the dashboard and browse pages share their loads and
  // cache: a load already in the cache is reused as it is (titles, logos and
  // the lists to scan barely change), so a profile's own refresh never
  // re-runs a whole dashboard load. Kleros Verified is stamped by the shared
  // rule (the registry pages' and Browse's cached sets), never taken from the
  // index.
  const queryClient = useQueryClient()
  const readIndex = useCallback(async (): Promise<RegistryIndex> => {
    // Loads saved by an earlier page load come first (saved-load.ts).
    await seedSavedLoads(queryClient)
    const [mainnets, testnet, sets] = await Promise.all([
      // Nothing on this page observes these keys, so the default five-minute
      // gcTime would drop them just before each refresh and re-run both
      // whole loads: keep them for the life of an open profile.
      queryClient.ensureQueryData({
        queryKey: DASHBOARD_QUERY_KEY,
        queryFn: fetchDashboardData,
        staleTime: DASHBOARD_STALE_MS,
        gcTime: INDEX_GC_MS,
        // A load saved by an earlier visit may be hours old: use it now and
        // refresh it behind the page.
        revalidateIfStale: true,
      }),
      queryClient.ensureQueryData({
        queryKey: TESTNET_DASHBOARD_QUERY_KEY,
        queryFn: fetchTestnetDashboardData,
        staleTime: DASHBOARD_STALE_MS,
        gcTime: INDEX_GC_MS,
        // A load saved by an earlier visit may be hours old: use it now and
        // refresh it behind the page.
        revalidateIfStale: true,
      }),
      readVerifiedSets(SUPPORTED_CHAIN_IDS, queryClient),
    ])
    return {
      registries: withVerified(
        [...mainnets.registries, ...testnet.registries],
        sets,
      ),
      missingChains: [
        ...(mainnets.listFailedChains ?? []),
        ...(testnet.listFailedChains ?? []),
      ],
    }
  }, [queryClient])

  const query = useQuery({
    queryKey: ['addressProfile', address],
    queryFn: () => fetchAddressProfileData(address, readIndex),
    enabled: validAddress,
    // Read when the profile opens and after the reader's own transactions
    // (they invalidate this key); not on a timer: each refresh walks every
    // request of the address on a shared request limit, for a page nobody
    // watches live.
    staleTime: PROFILE_REFRESH_MS,
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
    staleTime: PROFILE_REFRESH_MS,
  })
  const governedAll: GovernedRegistry[] | undefined =
    governedQuery.data?.registries
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
  // Chains in the scope whose indexer did not answer: their actions are
  // missing, so the figures are lower bounds, and with nothing read the
  // profile is unknown rather than quiet.
  const failed = (data?.failedChains ?? []).filter((chainId) =>
    inScope(scope, chainId),
  )
  const unread = !loading && failed.length > 0 && activities.length === 0
  // Chains in the scope where some list's governor() could not be read.
  const governedPartial = (governedQuery.data?.unreadChains ?? []).some(
    (chainId) => inScope(scope, chainId),
  )
  // A refresh that fails keeps the last data (React Query keeps it on a
  // failed refetch): the sections stay, an open governance dialog included,
  // and a note says the data is older. Only no data at all is an error.
  const profileFailed = query.isError && !data
  const profileStale = query.isError && !!data
  const governedStaleSince =
    governedQuery.isError && governedAll
      ? governedQuery.dataUpdatedAt
      : undefined
  // A quiet scope says so once, in the profile panel; no empty list below.
  const quiet = !loading && !!data && activities.length === 0
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
        error={profileFailed || unread}
        failed={failed}
        onRetry={() => {
          void query.refetch()
          if (governedQuery.isError || governedPartial)
            void governedQuery.refetch()
        }}
        generatedAt={data?.generatedAt}
        refreshFailed={profileStale}
        governedStaleSince={governedStaleSince}
        scope={scope}
        onScope={setScope}
        chains={chains}
        stats={stats}
        governedCount={governedPending ? undefined : governed.length}
        governedError={governedQuery.isError && !governedAll}
        governedPartial={!governedPending && governedPartial}
        activities={activities}
        complete={complete}
        listed={listed}
        capped={capped}
        now={now}
      />

      {(loading || !!data) && !quiet && (
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
          none, and the hero's figure already says so. It stays while the
          governance scan has data, whatever a later refresh does. */}
      {!loading && governed.length > 0 && (
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
