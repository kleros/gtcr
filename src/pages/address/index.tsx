import React, { useCallback, useEffect, useMemo } from 'react'
import styled from 'styled-components'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { isAddress } from 'viem'
import useDocumentHead from 'hooks/use-document-head'
import useNow from 'hooks/use-now'
import useStoredLayout from 'hooks/use-stored-layout'
import { useMediaQuery } from 'pages/guide/hooks'
import {
  Page,
  VisuallyHidden,
  truncateMiddle,
} from 'components/curate/primitives'
import {
  SectionTabs,
  sectionPanelId,
  sectionTabId,
} from 'components/curate/section-tabs'
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
import { fetchCurateJury } from './jury'
import {
  readVerifiedSets,
  withVerified,
} from 'components/curate/registry-shared-verified'
import {
  PAGE_SIZE,
  PHONE_PAGE_SIZE,
  activeChains,
  activityLayout,
  filterActivities,
  inScope,
  jurorBadge,
  parseFilter,
  parsePage,
  parseScope,
  parseTab,
  profileRoles,
  type ActivityFilter,
  type ProfileTab,
} from './view'
import { ProfilePanel } from './profile'
import { ActivitySection } from './activity'
import { SectionHead } from './parts'

/*
 * Curator profile (/address/:address): who this address is on Curate. One
 * featured panel leads with the entries it submitted, its other counts, its
 * requests and challenges over time and its challenge record; an address
 * with no action there leads with what it does have (its juror record, the
 * lists it governs) over one muted line. Under it, section tabs pick its
 * actions (rows, with its badges beside them) or the lists it governs
 * (?tab=governed); the tabs show only when the address has both, and
 * otherwise the one it has keeps its own heading. Every number comes from
 * the profile data and describes the chosen scope (all chains or one,
 * ?chain=); nothing the data layer lacks (rewards, entry status) is shown.
 * The governance scan (one governor() read per indexed list) and the juror
 * record (court index and chain) are queries of their own, so the figures,
 * chart and list never wait for them.
 */

const Governed = styled.div`
  ${reveal}
`

/* The tabs sit where the section's title sat, in its 38px, so the swap
   from the title to the tabs when the governance scan settles does not move
   the page. */
const TabsHead = styled(SectionHead)`
  min-height: 38px;
`

/** Prefix of the profile's tab and panel ids. */
const TABS_ID = 'profile-section'

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
  // In the URL with the filter and the scope, so Back from an entry, a
  // reload or a shared link opens the same page of the activity.
  const page = parsePage(searchParams.get('page'))
  const tab = parseTab(searchParams.get('tab'))
  const [storedLayout, setLayout] = useStoredLayout('address', 'rows')
  const layout = activityLayout(storedLayout)
  // A remembered choice of the dropped table reads as rows and is rewritten
  // once: the 'address' key is this page's own, so nothing else reads it.
  useEffect(() => {
    if (storedLayout === 'table') setLayout('rows')
  }, [storedLayout, setLayout])
  const now = useNow(30_000)
  const { address: connectedAddress, isConnected } = useAccount()
  const isYou =
    validAddress &&
    isConnected &&
    normalizeAddress(connectedAddress) === address

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

  // Under the profile's key too. Draws trail the chain by minutes and a
  // juror's record changes slowly, so it is read when the profile opens.
  const juryQuery = useQuery({
    queryKey: ['addressProfile', address, 'jury'],
    queryFn: () => fetchCurateJury(address),
    enabled: validAddress && !isZero,
    staleTime: 10 * 60_000,
  })

  const setParam = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(searchParams)
    if (value === fallback) next.delete(key)
    else next.set(key, value)
    // Another filter or scope starts again from the first page; a tab keeps
    // the page and the filter, so switching back finds the list as it was.
    if (key !== 'page' && key !== 'tab') next.delete('page')
    setSearchParams(next, { replace: true })
  }
  const setFilter = (value: ActivityFilter) => setParam('show', value, 'all')
  const setScope = (value: string) => setParam('chain', value, 'all')
  const setPage = (value: number) => setParam('page', String(value), '1')
  const setTab = (value: ProfileTab) => setParam('tab', value, 'activity')

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
  // Shorter pages on a phone (round 10: the default list was too long to
  // scroll past to the badges and the rest).
  const phone = useMediaQuery('(max-width: 720px)')
  const pageSize = phone ? PHONE_PAGE_SIZE : PAGE_SIZE
  const pageCount = Math.max(1, Math.ceil(shown.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visible = shown.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
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
  // The zero address has no jury read (the query is disabled).
  const juryPending = validAddress && !isZero && juryQuery.isPending
  const juror = jurorBadge(juryQuery.data, scope, juryPending)
  // What the address is on Curate across every chain, whatever the scope:
  // the panel's eyebrow names it once all three reads have settled (the
  // profile, the governance scan and the jury read), so a juror or a
  // governor is never first called "Address" and then renamed.
  const roles =
    loading || governedPending || juryPending
      ? undefined
      : profileRoles({
          acted: (data?.stats.activity ?? 0) > 0,
          governs: (governedAll?.length ?? 0) > 0,
          judges: jurorBadge(juryQuery.data, 'all', false).seats > 0,
        })
  // An invalid address renders the error page, which names itself. The
  // title names the roles once they are known, like the eyebrow.
  useDocumentHead(
    validAddress
      ? `${roles && roles.length > 0 ? `${roles.join(' · ')} ` : ''}${truncateMiddle(address)} | Kleros Curate`
      : undefined,
    validAddress
      ? `Submissions, removals, challenges and governed lists of ${address} across Kleros Curate registries.`
      : undefined,
  )
  // The activity renders while it loads and once it has data; a profile that
  // could not be read at all, or a quiet scope, has no activity to show.
  const activityShown = (loading || !!data) && !quiet
  // Both halves have content (or the governed one is asked for and still
  // being read): one tab control picks between them. Otherwise the half the
  // address has keeps its own heading, and a ?tab=governed without lists
  // falls back to the activity. A failed profile read keeps the governed
  // lists as the lone section, rather than behind a tab over nothing.
  const showTabs =
    activityShown &&
    (governed.length > 0 || (governedPending && tab === 'governed'))
  const openTab: ProfileTab = showTabs ? tab : 'activity'
  // Under the tabs each half is a tab panel; alone it is a plain section.
  const panelProps = (value: ProfileTab) =>
    showTabs
      ? {
          role: 'tabpanel',
          id: sectionPanelId(TABS_ID, value),
          'aria-labelledby': sectionTabId(TABS_ID, value),
        }
      : {}

  const badgeScope = scope === 'all' ? 'All chains' : chainName(scope)
  const activityProps = {
    address,
    loading,
    activities,
    shown,
    visible,
    filter,
    onFilter: setFilter,
    page: currentPage,
    pageSize,
    onPage: setPage,
    layout,
    onLayout: setLayout,
    badges,
    juror,
    badgeScope,
    truncated: !complete,
    chainList,
    now,
  }

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
        roles={roles}
        juror={juror}
        badges={badges}
        now={now}
      />

      {/* One stable tree whether the tabs show or not: when the governance
          scan settles and the tabs appear, the activity below stays mounted
          (no second entrance under the reader), and a tab is shown or
          hidden, never unmounted, so a governance save written into the
          rows survives a look at the activity. A panel coming back from
          hidden replays its entrance. */}
      {showTabs && (
        <TabsHead>
          <SectionTabs<ProfileTab>
            ariaLabel="Profile section"
            idBase={TABS_ID}
            value={openTab}
            onChange={setTab}
            tabs={[
              {
                value: 'activity',
                label: 'Activity',
                // A list cut at its limit gets no count: it would read as
                // a total. Its footer says "of the 120 most recent".
                count:
                  !loading && !!data && complete
                    ? activities.length
                    : undefined,
              },
              {
                value: 'governed',
                label: 'Governed lists',
                count: governedPending ? undefined : governed.length,
              },
            ]}
          />
        </TabsHead>
      )}
      {showTabs && (
        <VisuallyHidden as="h2">
          {openTab === 'governed' ? 'Governed lists' : 'Activity'}
        </VisuallyHidden>
      )}

      {activityShown && (
        // No entrance of its own: the activity's toolbar, rows and rail
        // carry theirs, and replay them when the tab comes back.
        <div hidden={openTab !== 'activity'} {...panelProps('activity')}>
          <ActivitySection embedded={showTabs} {...activityProps} />
        </div>
      )}

      {/* Only an address that governs a list gets its lists: most govern
          none, and the hero's figure already says so. Next to actions they
          are a tab; alone, they are the section, with its own heading. They
          stay while the governance scan has data, whatever a later refresh
          does. Alone, they wait for the jury read too: until it lands a
          quiet hero keeps its skeleton height, and lists shown under it
          would move up when it settles. */}
      {(showTabs || (!loading && !juryPending && governed.length > 0)) && (
        <Governed
          hidden={openTab !== 'governed' && showTabs}
          style={{ ['--i' as string]: showTabs ? 1 : 4 }}
          {...panelProps('governed')}
        >
          <GovernancePanel
            embedded={showTabs}
            registries={governed}
            profileAddress={address}
            loading={governedPending}
            isZero={isZero}
            layout={layout}
            onLayout={setLayout}
          />
        </Governed>
      )}
    </Page>
  )
}

export default AddressPage
