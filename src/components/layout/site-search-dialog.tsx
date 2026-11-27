import React, { useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Modal from 'components/ui/Modal'
import { CurateIcon } from 'components/curate/icons'
import {
  ChainChip,
  Label,
  SearchField,
  SkeletonBlock,
  StatusDot,
  truncateMiddle,
  VisuallyHidden,
} from 'components/curate/primitives'
import { KindTag } from 'components/curate/stake-tag'
import { Avatar as ListLogo } from 'pages/browse/avatar'
import { useGraphqlBatcher } from 'contexts/graphql-batcher'
import { subgraphUrlPermanent } from 'config/tcr-addresses'
import {
  fetchDashboardData,
  fetchTestnetDashboardData,
} from 'pages/dashboard/data'
import {
  DASHBOARD_QUERY_KEY,
  DASHBOARD_STALE_MS,
  TESTNET_DASHBOARD_QUERY_KEY,
} from 'pages/dashboard/query'
import { useSavedLoadsReady } from 'pages/dashboard/saved-load'
import {
  ENTRY_LIMIT,
  MIN_ENTRY_TERM,
  SITE_SEARCH_QUERY,
  SITE_SEARCH_STAKE_QUERY,
  STAKE_ENTRY_LIMIT,
  groupHits,
  matchLists,
  registryKey,
  repeatedTitles,
  stakeHits,
  stakeSearchWhere,
  standardHit,
  standardSearchWhere,
  termAddress,
  type ListInfo,
  type RawStakeHit,
  type RawStandardHit,
  type HitGroup,
  type SearchHit,
} from './site-search-data'

/*
 * The site search dialog (site-search-data.ts says what it finds and what
 * it costs). Loaded only when first opened. One field; under it the lists
 * whose name matches, the entries grouped by list with each list's network,
 * and the profile of an address. Arrow keys move through the results and
 * Enter opens one; Enter in the field opens the first.
 */

/** Typing pauses this long before entries are asked for. */
const SETTLE_MS = 500

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
`

const Field = styled(SearchField)`
  height: 48px;
`

const Results = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-height: min(60vh, 520px);
  margin: 0 -8px;
  padding: 0 8px 4px;
  overflow-y: auto;
  overscroll-behavior: contain;
`

/* A labelled group of results (role group, not a landmark per group). */
const Group = styled.div.attrs({ role: 'group' })`
  display: flex;
  flex-direction: column;
  gap: 2px;

  > ${Label} {
    padding: 0 10px 6px;
  }
`

const Row = styled(Link)`
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 8px 10px;
  border-radius: 10px;
  color: var(--color-text);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  text-decoration: none;
  outline: none;
  transition: background-color var(--motion);

  &:hover,
  &:focus-visible {
    background: var(--hover-fill);
    color: var(--color-text);
  }

  &:focus-visible {
    box-shadow: inset 0 0 0 2px var(--color-primary-soft);
  }
`

const ListRow = styled(Row)`
  font-weight: 500;
`

const RowText = styled.span<{ $mono?: boolean }>`
  min-width: 0;
  flex: 0 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ${({ $mono }) =>
    $mono ? 'var(--font-mono)' : 'var(--font-sans)'};
`

const Muted = styled.span`
  flex: 0 0 auto;
  color: var(--color-muted);
  font-size: var(--fs-meta);
  line-height: var(--lh-meta);
  white-space: nowrap;
`

/* A list's short address, beside a name another shown list shares. */
const ListAddress = styled(Muted)`
  font-family: var(--font-mono);
  font-weight: 400;
`

const End = styled(Muted)`
  margin-left: auto;
`

/*
 * A list is drawn with its logo, as the board's list chips draw it (24px,
 * round); the entries under it start where its name does.
 */
const LOGO = 24
const UNDER_NAME = `${10 + LOGO + 10}px`

const EntryRow = styled(Row)`
  padding-left: ${UNDER_NAME};
`

const MoreRow = styled(Row)`
  padding-left: ${UNDER_NAME};
  color: var(--color-primary);
  font-weight: 500;

  &:hover,
  &:focus-visible {
    color: var(--color-primary-hover);
  }
`

const Note = styled.p`
  margin: 0;
  padding: 0 10px;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

const Retry = styled.button`
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-primary);
  font: inherit;
  font-weight: 500;
  cursor: pointer;
`

const Skeletons = () => (
  <>
    {[0, 1, 2].map((index) => (
      <SkeletonBlock
        key={index}
        $height="20px"
        $width={`${70 - index * 12}%`}
        style={{ margin: '10px 10px' }}
      />
    ))}
  </>
)

const SEPOLIA = 11155111

/** The networks searched: the mainnets, and Sepolia from a Sepolia page. */
const searchChains = (pageChainId: number | null | undefined): number[] =>
  pageChainId === SEPOLIA ? [1, 100, SEPOLIA] : [1, 100]

const plural = (count: number, one: string, many: string) =>
  `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`

const EntryLine = ({ hit }: { hit: SearchHit }) => (
  <>
    <StatusDot $tone={hit.status.tone} aria-hidden />
    <RowText $mono={hit.name.address} title={hit.name.value ?? hit.name.text}>
      {hit.name.text}
    </RowText>
    {hit.name.network && <Muted>{hit.name.network}</Muted>}
    <End>{hit.status.label}</End>
  </>
)

const SiteSearchDialog = ({
  open,
  onClose,
  pageChainId,
}: {
  open: boolean
  onClose: () => void
  pageChainId?: number | null
}) => {
  const [term, setTerm] = useState('')
  const [settled, setSettled] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const { graphqlBatcher } = useGraphqlBatcher()

  useEffect(() => {
    const id = window.setTimeout(() => setSettled(term.trim()), SETTLE_MS)
    return () => window.clearTimeout(id)
  }, [term])

  // The field takes focus each time the dialog opens (after the dialog's
  // own focus on its panel), with the last term selected so typing replaces
  // it.
  useEffect(() => {
    if (!open) return undefined
    const id = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true })
      inputRef.current?.select()
    }, 30)
    return () => window.clearTimeout(id)
  }, [open])

  // Lists: the dashboard load the app keeps (saved between visits), and the
  // Sepolia load as well from a Sepolia page, whose entries are searched.
  const savedReady = useSavedLoadsReady()
  const testnet = pageChainId === SEPOLIA
  const dashboard = useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: fetchDashboardData,
    enabled: open && savedReady,
    staleTime: DASHBOARD_STALE_MS,
  })
  const testnetDashboard = useQuery({
    queryKey: TESTNET_DASHBOARD_QUERY_KEY,
    queryFn: fetchTestnetDashboardData,
    enabled: open && savedReady && testnet,
    staleTime: DASHBOARD_STALE_MS,
  })
  const registries = useMemo(
    () => [
      ...(dashboard.data?.registries ?? []),
      ...(testnet ? (testnetDashboard.data?.registries ?? []) : []),
    ],
    [dashboard.data, testnetDashboard.data, testnet],
  )
  const listInfo = useMemo(
    () =>
      new Map<string, ListInfo>(
        registries.map((registry) => [
          registryKey(registry.chainId, registry.address),
          {
            title: registry.title,
            kind: registry.kind,
            itemCount: registry.itemCount,
            logo: registry.logoURI,
          },
        ]),
      ),
    [registries],
  )

  const chainIds = useMemo(() => searchChains(pageChainId), [pageChainId])
  const entryTerm = settled.length >= MIN_ENTRY_TERM ? settled : ''
  const entries = useQuery({
    queryKey: ['siteSearch', entryTerm, chainIds.join(',')],
    queryFn: async (): Promise<{
      hits: SearchHit[]
      capped: boolean
      stakeFailed: boolean
    }> => {
      const standard = graphqlBatcher
        .fetch({
          document: SITE_SEARCH_QUERY,
          variables: {
            where: standardSearchWhere(entryTerm, chainIds),
            limit: ENTRY_LIMIT,
          },
          chainId: chainIds[0],
        })
        .then((data: { LItem?: RawStandardHit[] }) => data?.LItem ?? [])
      const stake = chainIds
        .filter((chainId) => subgraphUrlPermanent[chainId])
        .map((chainId) =>
          graphqlBatcher
            .fetch({
              document: SITE_SEARCH_STAKE_QUERY,
              variables: {
                where: stakeSearchWhere(entryTerm),
                first: STAKE_ENTRY_LIMIT,
              },
              chainId,
              isPermanent: true,
            })
            .then((data: { items?: RawStakeHit[] }) =>
              stakeHits(data?.items ?? [], chainId),
            ),
        )
      const [standardResult, ...stakeResults] = await Promise.allSettled([
        standard,
        ...stake,
      ])
      // Standard lists hold nearly every entry: without them the answer
      // would read as "no match", so it is an error, to be tried again. A
      // Stake read that fails leaves a note instead.
      if (standardResult.status === 'rejected') throw standardResult.reason
      const standardRows = standardResult.value as RawStandardHit[]
      const stakeFound = stakeResults.flatMap((result) =>
        result.status === 'fulfilled' ? (result.value as SearchHit[]) : [],
      )
      return {
        hits: [...standardRows.map(standardHit), ...stakeFound],
        capped: standardRows.length >= ENTRY_LIMIT,
        stakeFailed: stakeResults.some(
          (result) => result.status === 'rejected',
        ),
      }
    },
    enabled: open && !!entryTerm,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const trimmed = term.trim()
  const lists = useMemo(
    () => matchLists(registries, trimmed),
    [registries, trimmed],
  )
  const groups = useMemo(
    () =>
      entries.data && entryTerm
        ? groupHits(entries.data.hits, listInfo, entryTerm)
        : [],
    [entries.data, entryTerm, listInfo],
  )
  const address = termAddress(trimmed)
  // Lists that share a name (an old copy and its successor) show their
  // short addresses, in either group.
  const repeated = useMemo(
    () =>
      repeatedTitles([
        ...lists,
        ...groups.map((group) => ({ ...group, address: group.registry })),
      ]),
    [lists, groups],
  )

  // Arrow keys move through the results; from the field, down enters them.
  const results = () => [
    ...(resultsRef.current?.querySelectorAll<HTMLElement>('[data-result]') ??
      []),
  ]
  const onKeyDown = (event: React.KeyboardEvent) => {
    const items = results()
    if (items.length === 0) return
    const index = items.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      items[Math.min(index + 1, items.length - 1)]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (index <= 0) inputRef.current?.focus()
      else items[index - 1]?.focus()
    } else if (
      event.key === 'Enter' &&
      document.activeElement === inputRef.current
    ) {
      event.preventDefault()
      items[0]?.click()
    }
  }

  // Lists are matched from the loads above: until they are in, "nothing
  // matches" would not be known; a load that failed is said.
  const loads = testnet ? [dashboard, testnetDashboard] : [dashboard]
  const listsPending = loads.some((load) => !load.data && !load.isError)
  const listsFailed = loads.some((load) => !load.data && load.isError)
  const waiting =
    trimmed !== settled ||
    (!!entryTerm && entries.isLoading) ||
    (!!trimmed && listsPending)
  const entriesShown = groups.length > 0
  const capped = !!entries.data?.capped

  // What a screen reader hears as results settle: a count, not every row.
  const shownEntries = groups.reduce((sum, group) => sum + group.hits.length, 0)
  const announcement = (() => {
    if (!trimmed) return ''
    if (waiting) return 'Searching'
    const found = [
      address ? 'a profile' : '',
      lists.length > 0 ? plural(lists.length, 'list', 'lists') : '',
      shownEntries > 0 ? plural(shownEntries, 'entry', 'entries') : '',
    ].filter(Boolean)
    return found.length > 0 ? `Found ${found.join(', ')}` : 'No results'
  })()

  /*
   * "N more on this list" opens the list's own search, which reads the
   * whole of a Standard list. Past the read's cap any Standard list may
   * hold more. A Stake group already shows every entry read (its search
   * filters only the page on screen), so it never offers more.
   */
  const moreRow = (group: HitGroup) => {
    if (group.kind !== 'standard' || (group.more === 0 && !capped)) return null
    return (
      <MoreRow to={group.href} onClick={onClose} data-result="">
        {group.more > 0
          ? `${group.more}${capped ? '+' : ''} more on this list`
          : 'See all on this list'}
      </MoreRow>
    )
  }

  const entriesBody = () => {
    if (waiting) return <Skeletons />
    if (entries.isError)
      return (
        <Note>
          Entries could not be searched right now.{' '}
          <Retry type="button" onClick={() => void entries.refetch()}>
            Try again
          </Retry>
        </Note>
      )
    const stakeNote = entries.data?.stakeFailed && (
      <Note>Stake lists could not be searched right now.</Note>
    )
    if (!entriesShown)
      return (
        <>
          <Note>
            {lists.length === 0 && !address && !listsFailed
              ? `Nothing matches “${settled}”.`
              : `No entry on any list matches “${settled}”.`}
          </Note>
          {stakeNote}
        </>
      )
    const rows = groups.map((group) => (
      <React.Fragment key={group.key}>
        <ListRow to={group.href} onClick={onClose} data-result="">
          <ListLogo
            uri={group.logo}
            seed={group.registry}
            size={LOGO}
            radius={LOGO / 2}
          />
          <RowText>{group.title}</RowText>
          {repeated.has(group.title) && (
            <ListAddress>{truncateMiddle(group.registry)}</ListAddress>
          )}
          <KindTag kind={group.kind} size="sm" />
          <ChainChip chainId={group.chainId} size="sm" />
        </ListRow>
        {group.hits.map((hit) => (
          <EntryRow
            key={hit.key}
            to={hit.href}
            onClick={onClose}
            data-result=""
          >
            <EntryLine hit={hit} />
          </EntryRow>
        ))}
        {moreRow(group)}
      </React.Fragment>
    ))
    return (
      <>
        {rows}
        {stakeNote}
      </>
    )
  }

  return (
    <Modal
      visible={open}
      onCancel={onClose}
      title="Search"
      footer={null}
      width="640px"
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <Body onKeyDown={onKeyDown}>
        <Field>
          <CurateIcon name="search" size={18} />
          <input
            ref={inputRef}
            aria-label="Search lists, entries and addresses"
            placeholder="Search lists, entries and addresses"
            value={term}
            onChange={(event) => setTerm(event.currentTarget.value)}
            spellCheck={false}
            autoComplete="off"
          />
        </Field>

        <VisuallyHidden role="status">{announcement}</VisuallyHidden>
        <Results ref={resultsRef}>
          {!trimmed && (
            <Note>
              Find a list by its name, or an entry on any list by a word or an
              address.
            </Note>
          )}

          {address && (
            <Group aria-label="Profile">
              <Label $tone="faint">Profile</Label>
              <Row to={`/address/${address}`} onClick={onClose} data-result="">
                <CurateIcon name="user" size={16} />
                <RowText $mono>{truncateMiddle(address)}</RowText>
                <End>Its submissions, challenges and badges</End>
              </Row>
            </Group>
          )}

          {!!trimmed && lists.length === 0 && listsFailed && (
            <Note>List names could not be read right now.</Note>
          )}

          {lists.length > 0 && (
            <Group aria-label="Lists">
              <Label $tone="faint">Lists</Label>
              {lists.map((list) => (
                <ListRow
                  key={list.id}
                  to={`/tcr/${list.chainId}/${list.address}`}
                  onClick={onClose}
                  data-result=""
                >
                  <ListLogo
                    uri={list.logoURI}
                    seed={list.address}
                    size={LOGO}
                    radius={LOGO / 2}
                  />
                  <RowText>{list.title}</RowText>
                  {repeated.has(list.title) && (
                    <ListAddress>{truncateMiddle(list.address)}</ListAddress>
                  )}
                  <KindTag kind={list.kind} size="sm" />
                  <ChainChip chainId={list.chainId} size="sm" />
                  <End>
                    {list.itemCount.toLocaleString('en-US')}{' '}
                    {list.itemCount === 1 ? 'entry' : 'entries'}
                  </End>
                </ListRow>
              ))}
            </Group>
          )}

          {trimmed.length >= MIN_ENTRY_TERM && (
            <Group aria-label="Entries" aria-busy={waiting}>
              <Label $tone="faint">Entries</Label>
              {entriesBody()}
            </Group>
          )}

          {!!trimmed && trimmed.length < MIN_ENTRY_TERM && (
            <Note>
              {lists.length === 0 && dashboard.isSuccess
                ? `No list name matches “${trimmed}”. `
                : ''}
              Type {MIN_ENTRY_TERM} characters or more to search entries.
            </Note>
          )}
        </Results>
      </Body>
    </Modal>
  )
}

export default SiteSearchDialog
