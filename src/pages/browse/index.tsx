import React, { useEffect, useMemo, useRef, useState } from 'react'
import styled, { css, keyframes } from 'styled-components'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import useDocumentHead from 'hooks/use-document-head'
import useNow from 'hooks/use-now'
import useStoredLayout, {
  LAYOUT_OPTIONS,
  type ListLayout,
} from 'hooks/use-stored-layout'
import { formatAbsolute, formatAgo } from 'utils/time'
import { parseRichAddress } from 'utils/rich-address'
import ChainLogo from 'components/chain-logo'
import { NETWORKS } from 'config/networks'
import { CurateIcon } from 'components/curate/icons'
import {
  Button,
  ChainChip,
  Chip,
  EmptyState,
  Label,
  Page,
  SearchField,
  SegmentedControl,
  SelectMenu,
  SkeletonBlock,
  Small,
  StatusDot,
  Surface,
  Table,
  TableScroller,
  ToggleGroup,
  truncateMiddle,
  type SegmentOption,
  type StatusTone,
} from 'components/curate/primitives'
import { AnimatedNumber } from 'components/curate/motion/animated-number'
import { reveal } from 'components/curate/motion/reveal'
import { Pagination } from 'components/ui'
import Tooltip from 'components/ui/Tooltip'
import { fetchDashboardData } from 'pages/dashboard/data'
import {
  applyCreationTimes,
  fetchRegistryCreationTimes,
} from 'utils/registry-creation'
import type { DashboardRegistry, RegistryKind } from 'pages/dashboard/types'
import { TESTNET_CHAIN_IDS } from 'pages/dashboard/view'
import {
  COMMUNITY_EXPLANATION,
  COMMUNITY_LABEL,
  COMMUNITY_LISTS_LABEL,
  VERIFIED_EXPLANATION,
  VERIFIED_LABEL,
  VERIFIED_LISTS_LABEL,
  VerifiedBadge,
} from 'components/curate/verified-badge'
import {
  useVerifiedSets,
  withVerified,
} from 'components/curate/registry-shared-verified'
import { Avatar } from './avatar'
import { entryKey, fetchEntryImages, type EntryRef } from './entry-images'
import { useCompletedRegistries, useNamedRegistries } from './metadata'
import {
  KIND_OPTIONS,
  PAGE_SIZE,
  SORT_OPTIONS,
  SUPPORTED_CHAIN_IDS,
  VERIFICATION_CHAIN_IDS,
  activityTone,
  chainName,
  entryCount,
  filterRegistries,
  hasAddressTitle,
  inScope,
  kindLabel,
  openRequests,
  parseChains,
  parseKinds,
  parsePage,
  parseSort,
  parseTrust,
  pendingLabel,
  registryBlurb,
  registryHref,
  scopeChainIds,
  scopeText,
  shownCreation,
  sortRegistries,
  summarize,
  trustParam,
  verificationHref,
  verifiedShowcase,
  type BrowseSort,
  type TrustMode,
} from './view'

/*
 * Browse (/browse): every registry the indexers know, across chains. A
 * compact title, one panel of figures for the chosen chain scope, then the
 * explorer: which lists (Kleros Verified, Community or all) with what that
 * means, one toolbar row (search, type, sort, layout), the registries as
 * rows, cards or a table, and pagination. Kleros Verified lists carry the
 * seal wherever they appear; Community lists carry no mark. The rail holds
 * the way to earn the badge and the latest requests. The chain is chosen in
 * the app bar through ?chain. Every figure is read from the data.
 */

const integer = new Intl.NumberFormat('en-US')
const formatInt = (value: number) => integer.format(Math.round(value))

const dateParts = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

/**
 * "7 Sep 2026" (UTC), day first with the three-letter month. Not
 * utils/time formatDate: its en-GB format writes September as "Sept", which
 * breaks the three-letter rhythm of the Created column.
 */
const formatDay = (timestamp: number): string => {
  const parts = Object.fromEntries(
    dateParts
      .formatToParts(new Date(timestamp * 1000))
      .map((part) => [part.type, part.value]),
  )
  return `${parts.day} ${parts.month} ${parts.year}`
}

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--status-registered) 55%, transparent); }
  70% { box-shadow: 0 0 0 8px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
`

const displayFigure = css`
  color: var(--color-text);
  font-family: var(--font-figure);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
`

const ellipsis = css`
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

/* ---------- Header ---------- */

const Header = styled.header`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px 32px;

  > * {
    ${reveal}
  }
`

const Title = styled.h1`
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: clamp(36px, 1.6vw + 24px, 48px);
  line-height: 1;
  font-weight: 500;
  letter-spacing: -0.035em;
`

const Lede = styled.p`
  margin: 12px 0 0;
  color: var(--color-muted);
  font-size: var(--fs-subheading);
  line-height: 24px;
`

const LivePill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 32px;
  padding: 0 14px 0 12px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  background: var(--color-raised);
  color: var(--color-muted);
  font-size: var(--fs-small);
  font-weight: 500;
  white-space: nowrap;

  /* The hover tone: --color-primary sits just under 4.5:1 on this raised
     fill in dark; the hover tone clears it in every theme. */
  b {
    color: var(--color-primary-hover);
    font-weight: 500;
  }

  /* Some indexer did not answer: the figures are partial, not live. The
     longer line may wrap on a phone. */
  &[data-partial] {
    height: auto;
    min-height: 32px;
    padding-block: 5px;
    white-space: normal;

    b {
      color: var(--color-warning);
    }
  }
`

/** The pulsing dot: only while the data is present and the last fetch worked. */
const Pulse = styled.i`
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border-radius: var(--radius-pill);
  background: var(--status-registered);
  animation: ${pulse} 2.4s infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

/* ---------- Figures ---------- */

/*
 * One panel of figures for the chain scope. Kleros Verified leads, as a
 * count with the logos of its largest lists: most lists are Community lists
 * and always will be, so the verified ones are shown as the set that earned
 * the badge, never as a share of every list. The other counts follow as a
 * strip split by hairlines. Every figure appears once.
 */
const FiguresPanel = styled(Surface)`
  display: grid;
  grid-template-columns: minmax(300px, auto) minmax(0, 1fr);
  align-items: stretch;
  gap: 24px 40px;
  margin-top: 28px;
  padding: 24px 28px;
  ${reveal}

  @media (max-width: 1100px) {
    grid-template-columns: minmax(0, 1fr);
  }

  @media (max-width: 720px) {
    gap: 18px;
    padding: 18px 16px;
  }
`

/* Label on top, figure at the bottom, level with the strip beside it. */
const VerifiedFigure = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
`

const FigureHead = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`

/* The figure and the logos' caption share the panel's bottom line, level
   with the other figures. */
const FigureLine = styled.div`
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 12px 24px;
`

const BigFigure = styled.b`
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  ${displayFigure}
  font-size: 44px;
  line-height: 46px;

  small {
    color: var(--color-muted);
    font-family: var(--font-sans);
    font-size: var(--fs-body);
    line-height: var(--lh-body);
    font-weight: 400;
    letter-spacing: 0;
  }

  @media (max-width: 720px) {
    font-size: 36px;
    line-height: 40px;
  }
`

/**
 * The Kleros Verified lists in scope, in the dashboard's order: each logo
 * leads to its list (its name and figure on hover and focus), then how many
 * more, with the order said underneath.
 */
const Showcase = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
`

const LogoRow = styled.ul`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;

  > li {
    display: inline-flex;
  }
`

const LogoLink = styled(Link)`
  display: inline-flex;
  border-radius: 10px;
  transition:
    transform var(--motion),
    filter var(--motion);

  &:hover {
    transform: translateY(-2px);
    filter: drop-shadow(0 6px 10px rgb(0 0 0 / 0.22));
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    &:hover {
      transform: none;
    }
  }
`

const MoreLists = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  color: var(--color-muted);
  font-family: var(--font-figure);
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

const ShowcaseNote = styled.span`
  color: var(--color-faint);
  font-size: 12px;
  line-height: 16px;
`

/* The tip on a logo: the list's name, then its figure. */
const TipName = styled.span`
  display: block;
  font-weight: 500;
`

const TipFigure = styled.span`
  display: block;
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
`

/** The other counts as a strip, split by hairlines; it takes the free width. */
const InlineStats = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));

  @media (max-width: 1100px) {
    padding-top: 18px;
    border-top: 1px solid var(--glass-border);
  }
`

/* Label on top, figure at the bottom: the figures share a baseline even when
   a label wraps at phone width. */
const InlineStat = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  min-height: 64px;
  padding: 0 24px;
  border-left: 1px solid var(--glass-border);

  b {
    ${displayFigure}
    font-size: 28px;
    line-height: 30px;
  }

  @media (max-width: 1100px) {
    min-height: 0;

    &:first-child {
      padding-left: 0;
      border-left: 0;
    }
  }

  @media (max-width: 720px) {
    padding: 0 12px;

    b {
      font-size: 20px;
      line-height: 24px;
    }
  }
`

/* ---------- Layout ---------- */

const Split = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 24px;
  align-items: start;
  margin-top: 40px;

  @media (max-width: 1240px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

const Explorer = styled.section`
  min-width: 0;
  ${reveal}
`

/* ---------- Toolbar ---------- */

const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;

  /* The search takes its own line when the column is too narrow for one row. */
  @media (max-width: 780px) {
    > label:first-child {
      flex-basis: 100%;
    }
  }

  .browse-layout {
    margin-left: auto;
  }

  /* On a phone the type filter and the layout share a line; sort goes under. */
  @media (max-width: 600px) {
    .browse-kind {
      order: 1;
    }

    .browse-layout {
      order: 2;
    }

    .browse-sort {
      order: 3;
    }
  }
`

/* ---------- Which lists ---------- */

/* Its own line above the toolbar, with a line saying what the choice means. */
const StandingBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 18px;
  margin-bottom: 12px;
`

const StandingNote = styled.p`
  flex: 1 1 280px;
  min-width: 0;
  margin: 0;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  text-wrap: pretty;

  > span[role='img'],
  > span[aria-hidden] {
    margin: 0 2px;
    vertical-align: -3px;
  }
`

const Search = styled(SearchField)`
  flex: 1 1 170px;
  height: 38px;
  padding: 0 6px 0 14px;
  border-radius: var(--radius-pill);

  input {
    width: 0;
    font-size: var(--fs-small);
  }

  /* The field itself shows focus (primary border and ring). */
  input:focus-visible {
    outline: none;
  }
`

const ClearButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-faint);
  cursor: pointer;
  transition:
    background var(--motion),
    color var(--motion);

  &:hover {
    background: var(--color-surface);
    color: var(--color-text);
  }
`

/* ---------- Registry identity ---------- */

const Name = styled.span`
  ${ellipsis}
  color: var(--color-text);
  font-size: var(--fs-body-lg);
  line-height: 20px;
  font-weight: 500;
  letter-spacing: -0.005em;
  transition: color var(--motion);
`

/** A list's name, then its Kleros Verified seal; the name gives way first. */
const NameLine = styled.span`
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;

  > :first-child {
    flex: 0 1 auto;
    min-width: 0;
  }
`

const Meta = styled.span`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
  margin-top: 6px;
`

/** Why a search matched: the description, else the address. */
const Blurb = styled.span`
  ${ellipsis}
  flex: 1 1 auto;
  min-width: 0;
  margin-left: 4px;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);

  code {
    font-family: var(--font-mono);
    font-size: 12px;
  }
`

const Created = styled.span`
  color: var(--color-faint);
  font-size: 12px;
  line-height: 16px;
  white-space: nowrap;
`

/**
 * Rows: the chips, then the description (or the address) on the same line.
 * At phone width the chips alone fill the line, so the description leaves
 * (cards still show it) and a long chip line wraps instead of overflowing.
 */
const RowMeta = styled(Meta)`
  flex-wrap: nowrap;

  > :not(${Blurb}) {
    flex: 0 0 auto;
  }

  @media (max-width: 760px) {
    flex-wrap: wrap;

    ${Blurb} {
      display: none;
    }
  }
`

/* ---------- Rows ---------- */

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const RowLink = styled(Link)`
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 112px 112px 92px 16px;
  grid-template-areas: 'logo id entries open court go';
  align-items: center;
  column-gap: 16px;
  min-height: 78px;
  padding: 14px 18px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  box-shadow: inset 0 1px 0 var(--glass-highlight);
  color: inherit;
  text-decoration: none;
  /* The lift uses translate, not transform: the entrance animation keeps its
     final transform applied (fill-mode both), which would cancel it. */
  transition:
    border-color var(--motion),
    background var(--motion),
    translate var(--motion);
  ${reveal}

  &:hover {
    border-color: var(--color-border-strong);
    background: var(--color-raised);
    translate: 0 -1px;
  }

  &:hover ${Name} {
    color: var(--color-primary);
  }

  &:hover [data-go] {
    color: var(--color-primary);
    transform: translateX(2px);
  }

  @media (max-width: 760px) {
    grid-template-columns: 40px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas:
      'logo id id id'
      'entries entries open court';
    row-gap: 14px;
    column-gap: 12px;
    padding: 14px;
  }
`

const RowId = styled.span`
  grid-area: id;
  min-width: 0;
`

const RowStat = styled.span<{ $area: string }>`
  grid-area: ${({ $area }) => $area};
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  min-width: 0;
  text-align: right;

  @media (max-width: 760px) {
    align-items: flex-start;
    text-align: left;
  }
`

const StatValue = styled.span<{ $large?: boolean; $zero?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  ${displayFigure}
  font-size: ${({ $large }) => ($large ? '24px' : '18px')};
  line-height: ${({ $large }) => ($large ? '26px' : '22px')};
  /* Zeros recede so the lists with something going on stand out. */
  color: ${({ $zero }) => ($zero ? 'var(--color-faint)' : 'var(--color-text)')};
`

const StatLabel = styled.span`
  color: var(--color-faint);
  font-size: 12px;
  line-height: 16px;
  white-space: nowrap;
`

const Go = styled.span`
  grid-area: go;
  display: inline-flex;
  color: var(--color-faint);
  transition:
    color var(--motion),
    transform var(--motion);

  @media (max-width: 760px) {
    display: none;
  }
`

/* ---------- Cards ---------- */

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
`

const CardLink = styled(Link)`
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 220px;
  padding: 18px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: inset 0 1px 0 var(--glass-highlight);
  color: inherit;
  text-decoration: none;
  transition:
    border-color var(--motion),
    background var(--motion),
    translate var(--motion);
  ${reveal}

  &:hover {
    border-color: var(--color-border-strong);
    background: var(--color-raised);
    translate: 0 -2px;
  }

  &:hover ${Name} {
    color: var(--color-primary);
  }
`

const CardTop = styled.span`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
`

const CardDescription = styled.span`
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);

  code {
    font-family: var(--font-mono);
    font-size: 12px;
  }
`

const CardStats = styled.span`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid var(--glass-border);

  > span {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
`

/** "71 Open requests" over "0 In court", right-aligned. */
const CardSide = styled.span`
  align-items: flex-end;

  > span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-faint);
    font-size: 12px;
    line-height: 18px;
    white-space: nowrap;
  }

  b {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    ${displayFigure}
    font-size: var(--fs-body);
  }

  b[data-zero='true'] {
    color: var(--color-faint);
  }
`

/* ---------- Table ---------- */

const TableName = styled(Link)`
  ${ellipsis}
  color: var(--color-text);
  font-weight: 500;
  text-decoration: none;

  &:hover {
    color: var(--color-primary);
  }
`

/** The registry column takes the free width and lets its text ellipsize. */
const RegistryCell = styled.td`
  width: 100%;
  max-width: 0;
`

const IdentityCell = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
`

const SubLine = styled.span`
  ${ellipsis}
  min-width: 0;
  color: var(--color-faint);
  font-size: 12px;
  line-height: 16px;

  code {
    font-family: var(--font-mono);
    font-size: 12px;
  }
`

const CourtCell = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
`

/* ---------- Footer ---------- */

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 18px;
`

/* ---------- Rail ---------- */

const Rail = styled.aside`
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;

  /* Under the list, the two panels sit side by side until phone width. */
  @media (min-width: 761px) and (max-width: 1240px) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }

  > * {
    ${reveal}
  }
`

const RailTitle = styled.h2`
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: 20px;
  line-height: 24px;
  font-weight: 500;
  letter-spacing: -0.02em;
`

const RailHead = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
`

const VerifyLinks = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: 14px;
  border-top: 1px solid var(--glass-border);
`

const VerifyLink = styled(Link)`
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  height: 46px;
  border-bottom: 1px solid var(--glass-border);
  color: var(--color-text);
  font-size: var(--fs-body);
  font-weight: 500;
  text-decoration: none;

  &:last-child {
    border-bottom: 0;
  }

  > span:last-child {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-primary);
    font-size: var(--fs-small);
    transition: transform var(--motion);
  }

  &:hover > span:last-child {
    transform: translateX(2px);
  }
`

const Feed = styled.ol`
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
`

const FeedItem = styled.li`
  position: relative;

  /* A hairline strings each picture to the next one. */
  &:not(:last-child)::before {
    content: '';
    position: absolute;
    top: 54px;
    bottom: -6px;
    left: 18px;
    width: 1px;
    background: var(--glass-border);
  }

  a {
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr) auto;
    align-items: start;
    gap: 12px;
    padding: 12px 0;
    color: inherit;
    text-decoration: none;
  }

  a:hover strong {
    color: var(--color-primary);
  }

  strong {
    ${ellipsis}
    color: var(--color-text);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
    font-weight: 500;
    transition: color var(--motion);
  }

  em {
    ${ellipsis}
    margin-top: 2px;
    color: var(--color-muted);
    font-size: 12px;
    font-style: normal;
    line-height: 16px;
  }

  em code {
    font-family: var(--font-mono);
  }

  time {
    flex: 0 0 auto;
    color: var(--color-faint);
    font-size: 12px;
    line-height: 16px;
    white-space: nowrap;
  }
`

/** The entry's picture (else its list's logo) with the status dot on its corner. */
const FeedThumb = styled.span`
  position: relative;
  display: inline-flex;
`

const FeedDot = styled(StatusDot)`
  position: absolute;
  right: -3px;
  bottom: -3px;
  box-shadow: 0 0 0 2.5px var(--color-surface);
`

/** A bare address or transaction hash, set in mono and shortened. */
const HEX_ID = /^0x(?:[0-9a-f]{40}|[0-9a-f]{64})$/i

/**
 * The item's first field; CAIP-10 values read as "0x94bA…8a2f · Robinhood
 * Chain", bare addresses as "0x4790…a1B2".
 */
const Identifier = ({ label, value }: { label: string; value: string }) => {
  const rich = parseRichAddress(value)
  return (
    <em title={`${label}: ${value}`}>
      {rich ? (
        <>
          <code>{truncateMiddle(rich.address)}</code> · {rich.reference.name}
        </>
      ) : HEX_ID.test(value.trim()) ? (
        <code>{truncateMiddle(value.trim())}</code>
      ) : (
        value
      )}
    </em>
  )
}

/**
 * The list's name, then how long ago: a name gives way first; an address
 * stays whole and the time gives way instead.
 */
const FeedFoot = styled.span`
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  margin-top: 2px;
  color: var(--color-faint);
  font-size: 12px;
  line-height: 16px;

  > span,
  > time {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  > span {
    flex: 0 1 auto;
  }

  > code {
    flex: 0 0 auto;
    font-family: var(--font-mono);
    font-size: 12px;
    white-space: nowrap;
  }

  > time {
    flex: 0 0 auto;
  }

  > code + time {
    flex: 0 1 auto;
  }

  > time::before {
    content: '·';
    margin-right: 6px;
    color: var(--color-faint);
  }

  > span[role='img'] {
    flex: 0 0 auto;
    overflow: visible;
    align-self: center;
  }
`

/** Read by screen readers, not shown. */
const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`

/* ---------- Pieces ---------- */

/** The list's logo from its metadata, else its gem (see Avatar). */
const RegistryLogo = ({
  registry,
  size = 44,
}: {
  registry: DashboardRegistry
  size?: number
}) => (
  <Avatar
    uri={registry.logoURI}
    seed={registry.address}
    size={size}
    style={{ gridArea: 'logo' }}
  />
)

/** The Kleros Verified seal for a verified list; Community lists carry none. */
const ListSeal = ({
  registry,
  size = 16,
}: {
  registry?: DashboardRegistry
  size?: number
}) =>
  registry?.trustStatus === 'verified' ? <VerifiedBadge size={size} /> : null

const TitleSeal = styled(VerifiedBadge)`
  margin-right: 8px;
  vertical-align: -2px;
`

/**
 * A list's name in the rail. A list known only by its address shows the
 * address, whole and in mono ("0x0391…ad67"), not "Registry 0x0391…".
 */
const ListName = ({ title, address }: { title: string; address: string }) =>
  /^(Permanent registry|Registry) 0x/i.test(title) ? (
    <code title={address}>{truncateMiddle(address)}</code>
  ) : (
    <span>{title}</span>
  )

/**
 * A chain mark that stays visible on a dark surface: the Gnosis mark is a
 * dark green, so on the dark themes it sits on a light plate.
 */
const ChainMark = styled.span`
  display: inline-flex;
  flex: 0 0 auto;

  body:not([data-theme='light']) &[data-plate] > span {
    background: color-mix(in srgb, var(--color-text) 86%, var(--color-surface));
  }
`

const RailChain = ({ chainId, size }: { chainId: number; size: number }) => (
  <ChainMark data-plate={chainId === NETWORKS.gnosis || undefined}>
    <ChainLogo chainId={chainId} size={size} />
  </ChainMark>
)

const STAKE_PENDING_TITLE =
  'Stake lists report the entries currently listed, not open requests'

/** Open requests, or for Stake lists the entries currently listed. */
const pendingTitle = (registry: DashboardRegistry) =>
  registry.kind === 'permanent' ? STAKE_PENDING_TITLE : undefined

/** The table's Open requests cell: Stake lists have none, so a dash. */
const OpenRequestsCell = ({ registry }: { registry: DashboardRegistry }) =>
  registry.kind === 'permanent' ? (
    <Small $faint title="Stake lists have no requests">
      <span aria-hidden>—</span>
      <VisuallyHidden>None, Stake lists have no requests</VisuallyHidden>
    </Small>
  ) : (
    <>{formatInt(registry.pendingCount)}</>
  )

const conjunction = new Intl.ListFormat('en-GB', {
  style: 'long',
  type: 'conjunction',
})
const listFormat = (names: string[]) => conjunction.format(names)

/** A list's key across chains: "<chainId>:<address>". */
const listKey = (chainId: number, address: string) =>
  `${chainId}:${address.toLowerCase()}`

/** "Kleros Verified lists", "Community list", "lists": the badge's words. */
const listsLabel = (mode: TrustMode, count: number): string => {
  const one = count === 1
  if (mode === 'verified')
    return one ? `${VERIFIED_LABEL} list` : VERIFIED_LISTS_LABEL
  if (mode === 'community')
    return one ? `${COMMUNITY_LABEL} list` : COMMUNITY_LISTS_LABEL
  return one ? 'list' : 'lists'
}

/** The default first; the seal names what Kleros Verified lists earned. */
const TRUST_OPTIONS: SegmentOption<TrustMode>[] = [
  {
    value: 'verified',
    label: VERIFIED_LABEL,
    icon: <VerifiedBadge size={15} decorative />,
  },
  { value: 'community', label: COMMUNITY_LABEL },
  { value: 'all', label: 'All' },
]

/** What the chosen lists are, in one line. */
const standingNote = (mode: TrustMode): React.ReactNode =>
  mode === 'verified' ? (
    VERIFIED_EXPLANATION
  ) : mode === 'community' ? (
    COMMUNITY_EXPLANATION
  ) : (
    <>
      Every list, with <VerifiedBadge size={15} decorative />
      <VisuallyHidden>the seal</VisuallyHidden> on the {VERIFIED_LABEL} ones.
    </>
  )

/** How many verified lists' logos the figures panel shows. */
const SHOWCASE_SIZE = 6

/** A logo's figure: open requests, or the entries of a Stake list. */
const showcaseFigure = (registry: DashboardRegistry): string => {
  if (registry.kind === 'permanent') {
    const entries = entryCount(registry)
    return `Stake · ${formatInt(entries)} ${entries === 1 ? 'entry' : 'entries'}`
  }
  const open = openRequests(registry)
  return `${formatInt(open)} open ${open === 1 ? 'request' : 'requests'}`
}

/**
 * Below this width the table cannot fit its columns (the shared Table is at
 * least 640px wide), so rows stand in for it without changing the stored
 * choice, and the switch stops offering it.
 */
const NARROW_QUERY = '(max-width: 720px)'

/** True while the viewport is too narrow for the table; follows resizes. */
const useNarrow = (): boolean => {
  const [narrow, setNarrow] = useState(
    () =>
      typeof window.matchMedia === 'function' &&
      window.matchMedia(NARROW_QUERY).matches,
  )
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const media = window.matchMedia(NARROW_QUERY)
    const onChange = () => setNarrow(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return narrow
}

/** "In court" with an amber haloed dot when something is in court. */
const CourtValue = ({ count }: { count: number }) => (
  <>
    {count > 0 && <StatusDot $tone="contested" aria-hidden />}
    {formatInt(count)}
  </>
)

const CreatedOn = ({ timestamp }: { timestamp: number }) => (
  <Created title={formatAbsolute(timestamp)}>
    Created {formatDay(timestamp)}
  </Created>
)

const ArrowIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <g
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </g>
  </svg>
)

type Freshness = 'live' | 'partial' | 'stale' | 'connecting' | 'down'

const FRESHNESS_TONE: Record<Exclude<Freshness, 'live'>, StatusTone> = {
  partial: 'contested',
  stale: 'contested',
  connecting: 'neutral',
  down: 'off',
}

/**
 * The data's state, said plainly: a pulsing "Live" only while the figures are
 * loaded and the last fetch worked; a still dot otherwise.
 */
const FreshnessPill = ({
  state,
  missing,
  updatedAt,
  now,
  index,
}: {
  state: Freshness
  /** The chains whose data did not load, named, when `state` is partial. */
  missing?: string
  updatedAt?: number
  now: number
  index: number
}) => {
  const ago = updatedAt ? `Updated ${formatAgo(updatedAt, now)}` : ''
  return (
    <LivePill
      style={{ ['--i' as string]: index }}
      data-partial={state === 'partial' ? '' : undefined}
    >
      {state === 'live' ? (
        <Pulse aria-hidden />
      ) : (
        <StatusDot $tone={FRESHNESS_TONE[state]} aria-hidden />
      )}
      {state === 'live' && <b>Live</b>}
      {state === 'partial' && <b>Partial</b>}
      {state === 'live'
        ? ago
        : state === 'partial'
          ? `Some ${missing} data did not load`
          : state === 'stale'
            ? `${ago} · last refresh failed`
            : state === 'connecting'
              ? 'Connecting to the indexers'
              : 'Indexers not answering'}
    </LivePill>
  )
}

/* ---------- Page ---------- */

const BrowsePage = () => {
  useDocumentHead(
    'Browse registries | Kleros Curate',
    'Browse Kleros Verified and Community Curate lists on Ethereum and Gnosis, and on the Sepolia testnet.',
  )
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const chainParam = searchParams.get('chain')
  const chains = useMemo(() => parseChains(chainParam), [chainParam])
  const trust = parseTrust(searchParams.get('trust'))
  const kindParam = searchParams.get('kind')
  const kinds = useMemo(() => parseKinds(kindParam), [kindParam])
  const sort = parseSort(searchParams.get('sort'))
  const search = searchParams.get('q') || ''
  const requestedPage = parsePage(searchParams.get('page'))
  const [layout, setLayout] = useStoredLayout('browse', 'rows')
  // A phone shows rows for a stored table choice and keeps the choice.
  const narrow = useNarrow()
  const shown = narrow && layout === 'table' ? 'rows' : layout
  const layoutOptions = useMemo(
    () =>
      narrow
        ? LAYOUT_OPTIONS.filter((option) => option.value !== 'table')
        : LAYOUT_OPTIONS,
    [narrow],
  )
  const now = useNow(30_000)

  const query = useQuery({
    queryKey: ['curateDashboard'],
    queryFn: fetchDashboardData,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
  const data = query.data

  // Real creation blocks (factory NewGTCR events), cached once read. Until
  // they arrive the dashboard data already carries whatever was cached.
  const creation = useQuery({
    queryKey: ['registryCreationTimes'],
    queryFn: () => fetchRegistryCreationTimes(SUPPORTED_CHAIN_IDS),
    staleTime: 10 * 60_000,
  })

  const setParam = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value)
      else next.delete(key)
    })
    setSearchParams(next, { replace: true })
  }

  // Any filter change returns to the first page, including changes made
  // elsewhere (the app bar's chain chip, back and forward navigation).
  const filterKey = `${chainParam ?? ''}|${trust}|${kindParam ?? ''}|${sort}|${search}`
  const lastFilterKey = useRef(filterKey)
  useEffect(() => {
    if (lastFilterKey.current === filterKey) return
    lastFilterKey.current = filterKey
    if (!searchParams.get('page')) return
    const next = new URLSearchParams(searchParams)
    next.delete('page')
    setSearchParams(next, { replace: true })
  }, [filterKey, searchParams, setSearchParams])

  // Old links carried the layout in the URL (?view=list or ?view=cards). The
  // layout is now remembered per device, so adopt it once and drop the param.
  useEffect(() => {
    const view = searchParams.get('view')
    if (view === null) return
    if (view === 'list') setLayout('rows')
    else if (view === 'cards') setLayout('cards')
    const next = new URLSearchParams(searchParams)
    next.delete('view')
    setSearchParams(next, { replace: true })
  }, [searchParams, setLayout, setSearchParams])

  const dated = useMemo(
    () =>
      data
        ? creation.data
          ? applyCreationTimes(data.registries, creation.data)
          : data.registries
        : [],
    [data, creation.data],
  )
  // Lists the indexer knew only by their address get their real title
  // before filtering and sorting, so search and "Name A to Z" use the name
  // each row shows.
  const named = useNamedRegistries(dated)
  // Kleros Verified by the shared rule (the chain's Kleros lists of lists,
  // Light and Classic, and the lists registered on any of them), read apart
  // from the dashboard load: a list whose chain has not answered is neither
  // Verified nor Community yet.
  const verifiedSets = useVerifiedSets(SUPPORTED_CHAIN_IDS)
  const trusted = useMemo(
    () => withVerified(named, verifiedSets.sets),
    [named, verifiedSets.sets],
  )
  const registries = useMemo(
    () =>
      sortRegistries(
        filterRegistries(trusted, { chains, trust, kinds, search }),
        sort,
      ),
    [trusted, chains, trust, kinds, search, sort],
  )
  // With nothing in this choice, how many match in the other one: a search
  // for a Community list from Kleros Verified should say where it is. "All"
  // has no other.
  const otherTrust: TrustMode | null =
    trust === 'verified'
      ? 'community'
      : trust === 'community'
        ? 'verified'
        : null
  const otherMatches = useMemo(
    () =>
      registries.length === 0 && otherTrust
        ? filterRegistries(trusted, {
            chains,
            trust: otherTrust,
            kinds,
            search,
          }).length
        : 0,
    [trusted, registries.length, chains, otherTrust, kinds, search],
  )
  // "All chains" leaves the testnet out: a search that matches only there
  // says so and offers it, in this choice first, else in the other one.
  const testnetHint = useMemo(() => {
    if (registries.length > 0 || otherMatches > 0 || chains.length > 0)
      return null
    for (const mode of otherTrust ? [trust, otherTrust] : [trust]) {
      const count = filterRegistries(trusted, {
        chains: TESTNET_CHAIN_IDS,
        trust: mode,
        kinds,
        search,
      }).length
      if (count > 0) return { trust: mode, count }
    }
    return null
  }, [
    trusted,
    registries.length,
    otherMatches,
    chains.length,
    trust,
    otherTrust,
    kinds,
    search,
  ])
  const pageCount = Math.max(1, Math.ceil(registries.length / PAGE_SIZE))
  const currentPage = Math.min(requestedPage, pageCount)
  const visible = registries.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  const figures = useMemo(() => summarize(trusted, chains), [trusted, chains])
  const showcase = useMemo(
    () => verifiedShowcase(trusted, chains, SHOWCASE_SIZE),
    [trusted, chains],
  )
  // A chain in scope whose lists of lists did not answer: its lists are in
  // neither count, so neither count is given.
  const trustFailed = verifiedSets.failed.filter((chainId) =>
    inScope(chains, chainId),
  )
  const trustUnknown = trustFailed.length > 0
  // A chain in scope whose lists did not load: its lists and entries are
  // missing, so no count is given rather than a low one.
  const listsMissing = (data?.listFailedChains ?? []).filter((chainId) =>
    inScope(chains, chainId),
  )
  const countsUnknown = trustUnknown || listsMissing.length > 0
  const partialChains = [...new Set([...listsMissing, ...trustFailed])]
  // The chains the list below lacks: their lists, or (for Kleros Verified
  // or Community) which of their lists are which.
  const missingChains = trust === 'all' ? listsMissing : partialChains
  const missingNames = listFormat(missingChains.map(chainName))
  const retryMissing = () => {
    if (listsMissing.length > 0) void query.refetch()
    verifiedSets.retry()
  }

  const latest = useMemo(
    () =>
      (data?.activities ?? [])
        .filter((activity) => inScope(chains, activity.chainId))
        .slice(0, 5),
    [data, chains],
  )

  // The lists on screen, rows and rail, completed from their own metadata
  // where the dashboard load left out a logo or a title.
  const registryByKey = useMemo(
    () =>
      new Map(
        trusted.map((registry) => [
          listKey(registry.chainId, registry.address),
          registry,
        ]),
      ),
    [trusted],
  )
  const onScreen = useMemo(() => {
    const rail = latest
      .map((activity) =>
        registryByKey.get(listKey(activity.chainId, activity.registryAddress)),
      )
      .filter((registry): registry is DashboardRegistry => !!registry)
    return [...new Set([...visible, ...rail, ...showcase])]
  }, [visible, latest, registryByKey, showcase])
  const complete = useCompletedRegistries(onScreen)
  const shownRows = visible.map(complete)
  const shownShowcase = showcase.map(complete)

  // The entries in the rail with their own image field (Light and Stake).
  const entryRefs = useMemo(
    () =>
      latest.flatMap((activity): EntryRef[] => {
        const registry = registryByKey.get(
          listKey(activity.chainId, activity.registryAddress),
        )
        return activity.itemID && registry && registry.kind !== 'classic'
          ? [
              {
                chainId: activity.chainId,
                registryAddress: activity.registryAddress,
                itemID: activity.itemID,
                kind: registry.kind,
              },
            ]
          : []
      }),
    [latest, registryByKey],
  )
  const entryImages = useQuery({
    queryKey: [
      'browseEntryImages',
      entryRefs.map((entry) => `${entry.chainId}:${entryKey(entry)}`),
    ],
    queryFn: () => fetchEntryImages(entryRefs),
    enabled: entryRefs.length > 0,
    staleTime: 10 * 60_000,
    // A new entry in the rail keeps the pictures already shown.
    placeholderData: keepPreviousData,
  })

  // Where a list can be put forward for verification: the chains in scope
  // with a Light Kleros list of lists, where new lists are submitted.
  const scopedVerification = scopeChainIds(chains).filter((chainId) =>
    VERIFICATION_CHAIN_IDS.includes(chainId),
  )
  const verificationChains =
    scopedVerification.length > 0 ? scopedVerification : VERIFICATION_CHAIN_IDS
  const scope = scopeText(chains)
  const showCreated = sort === 'recent-creation'

  const loading =
    query.isLoading || (!data && !query.isError) || verifiedSets.pending
  // fetchDashboardData swallows indexer errors and answers with empty lists,
  // so an answer without a single registry means the indexers did not answer
  // (every supported chain has registries, its list of lists at least).
  const unanswered = !!data && data.registries.length === 0
  const failed = (query.isError && !data) || unanswered
  const freshness: Freshness =
    data && !unanswered
      ? query.isError
        ? 'stale'
        : partialChains.length > 0
          ? 'partial'
          : 'live'
      : failed
        ? 'down'
        : 'connecting'
  const clearFilters = () =>
    setParam({ q: null, trust: null, kind: null, chain: null, page: null })

  return (
    <Page>
      <Header>
        <div style={{ ['--i' as string]: 0 }}>
          <Title>Registries</Title>
          <Lede>Every Curate list on {scope}.</Lede>
        </div>
        <FreshnessPill
          state={freshness}
          missing={listFormat(partialChains.map(chainName))}
          updatedAt={data ? Math.floor(data.generatedAt / 1000) : undefined}
          now={now}
          index={1}
        />
      </Header>

      <FiguresPanel
        as="section"
        $featured
        $padding="none"
        aria-labelledby="browse-figures-title"
        style={{ ['--i' as string]: 2 }}
      >
        <VisuallyHidden as="h2" id="browse-figures-title">
          Registry figures for {scope}
        </VisuallyHidden>
        {failed ? (
          <Small $muted style={{ gridColumn: '1 / -1' }}>
            No figures until the indexers answer.
          </Small>
        ) : (
          <>
            <VerifiedFigure>
              <FigureHead>
                <VerifiedBadge size={18} decorative />
                <Label $tone="faint">{VERIFIED_LABEL}</Label>
              </FigureHead>
              <FigureLine>
                <BigFigure>
                  <AnimatedNumber
                    value={
                      loading || countsUnknown ? undefined : figures.verified
                    }
                  />
                  {!loading && !countsUnknown && (
                    <small>{figures.verified === 1 ? 'list' : 'lists'}</small>
                  )}
                </BigFigure>
                {!loading && shownShowcase.length > 0 && (
                  <Showcase>
                    <LogoRow
                      aria-label={`${VERIFIED_LISTS_LABEL}, most open requests first`}
                    >
                      {shownShowcase.map((registry) => (
                        <li key={registry.id}>
                          <Tooltip
                            title={
                              <>
                                <TipName>{registry.title}</TipName>
                                <TipFigure>
                                  {showcaseFigure(registry)}
                                </TipFigure>
                              </>
                            }
                          >
                            <LogoLink
                              to={registryHref(registry)}
                              aria-label={registry.title}
                            >
                              <Avatar
                                uri={registry.logoURI}
                                seed={registry.address}
                                size={32}
                              />
                            </LogoLink>
                          </Tooltip>
                        </li>
                      ))}
                      {!countsUnknown &&
                        figures.verified > shownShowcase.length && (
                          <li>
                            <MoreLists>
                              +
                              {formatInt(
                                figures.verified - shownShowcase.length,
                              )}
                              <VisuallyHidden> more</VisuallyHidden>
                            </MoreLists>
                          </li>
                        )}
                    </LogoRow>
                    <ShowcaseNote aria-hidden>
                      Most open requests first
                    </ShowcaseNote>
                  </Showcase>
                )}
              </FigureLine>
            </VerifiedFigure>
            <InlineStats>
              {[
                {
                  label: COMMUNITY_LISTS_LABEL,
                  value: countsUnknown ? undefined : figures.community,
                },
                {
                  label: 'Entries',
                  value: listsMissing.length > 0 ? undefined : figures.entries,
                },
                {
                  label: 'Open requests',
                  value:
                    listsMissing.length > 0 ? undefined : figures.openRequests,
                },
              ].map((figure) => (
                <InlineStat key={figure.label}>
                  <Label $tone="faint">{figure.label}</Label>
                  <b>
                    <AnimatedNumber
                      value={loading ? undefined : figure.value}
                    />
                  </b>
                </InlineStat>
              ))}
            </InlineStats>
          </>
        )}
      </FiguresPanel>

      <Split>
        <Explorer
          aria-labelledby="browse-explorer-title"
          style={{ ['--i' as string]: 3 }}
        >
          <VisuallyHidden as="h2" id="browse-explorer-title">
            Registry list
          </VisuallyHidden>
          <StandingBar>
            <SegmentedControl<TrustMode>
              ariaLabel="Which lists"
              value={trust}
              onChange={(value) =>
                setParam({ trust: trustParam(value), page: null })
              }
              options={TRUST_OPTIONS}
            />
            <StandingNote aria-live="polite">
              {standingNote(trust)}
            </StandingNote>
          </StandingBar>
          <Toolbar>
            <Search>
              <CurateIcon name="search" size={16} />
              <input
                aria-label="Search registries"
                placeholder="Search name, address or chain"
                value={search}
                onChange={(event) =>
                  setParam({
                    q: event.currentTarget.value || null,
                    page: null,
                  })
                }
              />
              {search && (
                <ClearButton
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setParam({ q: null, page: null })}
                >
                  <CurateIcon name="close" size={14} />
                </ClearButton>
              )}
            </Search>
            <ToggleGroup<RegistryKind>
              className="browse-kind"
              ariaLabel="Registry type"
              value={kinds}
              onChange={(value) =>
                setParam({ kind: value.join(',') || null, page: null })
              }
              options={KIND_OPTIONS}
            />
            <SelectMenu<BrowseSort>
              className="browse-sort"
              label="Sort"
              value={sort}
              menuWidth={248}
              onChange={(value) =>
                setParam({
                  sort: value === 'recent-submission' ? null : value,
                  page: null,
                })
              }
              options={SORT_OPTIONS}
            />
            <SegmentedControl<ListLayout>
              className="browse-layout"
              ariaLabel="Layout"
              value={shown}
              onChange={setLayout}
              options={layoutOptions.map((option) => ({
                value: option.value,
                label: option.label,
                icon: option.icon,
                hideLabel: true,
              }))}
            />
          </Toolbar>

          {loading ? (
            <List aria-busy="true">
              {Array.from({ length: 6 }).map((_, index) => (
                <SkeletonBlock
                  key={index}
                  $height="78px"
                  style={{ borderRadius: 'var(--radius)' }}
                />
              ))}
            </List>
          ) : failed ? (
            <Surface $padding="none">
              <EmptyState
                icon="registry"
                title="Registries could not be loaded"
                action={
                  <Button
                    type="button"
                    $variant="secondary"
                    $size="sm"
                    onClick={() => query.refetch()}
                  >
                    Try again
                  </Button>
                }
              >
                The indexers did not answer. Check your connection and try
                again.
              </EmptyState>
            </Surface>
          ) : registries.length === 0 && missingChains.length > 0 ? (
            <Surface $padding="none">
              <EmptyState
                icon="registry"
                title={`${missingNames} lists did not load`}
                action={
                  <Button
                    type="button"
                    $variant="secondary"
                    $size="sm"
                    onClick={retryMissing}
                  >
                    Try again
                  </Button>
                }
              />
            </Surface>
          ) : registries.length === 0 && otherTrust && otherMatches > 0 ? (
            <Surface $padding="none">
              <EmptyState
                icon="filter"
                title={`No ${listsLabel(trust, 2)} match`}
                action={
                  <Button
                    type="button"
                    $size="sm"
                    onClick={() =>
                      setParam({ trust: trustParam(otherTrust), page: null })
                    }
                  >
                    Show {formatInt(otherMatches)}{' '}
                    {listsLabel(otherTrust, otherMatches)}
                  </Button>
                }
              />
            </Surface>
          ) : registries.length === 0 && testnetHint ? (
            <Surface $padding="none">
              <EmptyState
                icon="filter"
                title="None on Ethereum or Gnosis"
                action={
                  <Button
                    type="button"
                    $size="sm"
                    onClick={() =>
                      setParam({
                        chain: TESTNET_CHAIN_IDS.join(','),
                        trust: trustParam(testnetHint.trust),
                        page: null,
                      })
                    }
                  >
                    Show {formatInt(testnetHint.count)}{' '}
                    {listsLabel(testnetHint.trust, testnetHint.count)} on the{' '}
                    {listFormat(TESTNET_CHAIN_IDS.map(chainName))} testnet
                  </Button>
                }
              />
            </Surface>
          ) : registries.length === 0 ? (
            <Surface $padding="none">
              <EmptyState
                icon="filter"
                title="No registries match"
                action={
                  <Button
                    type="button"
                    $variant="secondary"
                    $size="sm"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </Button>
                }
              >
                Change the search, the chain or a filter.
              </EmptyState>
            </Surface>
          ) : shown === 'table' ? (
            <TableScroller>
              <Table>
                <thead>
                  <tr>
                    <th>Registry</th>
                    {showCreated ? <th>Created</th> : <th>Chain</th>}
                    <th className="num">Entries</th>
                    <th className="num">Open requests</th>
                    <th className="num">In court</th>
                  </tr>
                </thead>
                <tbody>
                  {shownRows.map((registry) => {
                    const created = shownCreation(registry, sort)
                    return (
                      <tr
                        key={registry.id}
                        data-href={registryHref(registry)}
                        onClick={() => navigate(registryHref(registry))}
                      >
                        <RegistryCell>
                          <IdentityCell>
                            <RegistryLogo registry={registry} size={34} />
                            <div style={{ minWidth: 0 }}>
                              <NameLine>
                                <TableName
                                  to={registryHref(registry)}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  {registry.title}
                                </TableName>
                                <ListSeal registry={registry} />
                              </NameLine>
                              <SubLine>
                                {kindLabel(registry.kind)}
                                {/* With the Created column the chain rides here. */}
                                {showCreated &&
                                  ` · ${chainName(registry.chainId)}`}
                                {' · '}
                                <code>{truncateMiddle(registry.address)}</code>
                              </SubLine>
                            </div>
                          </IdentityCell>
                        </RegistryCell>
                        {showCreated ? (
                          <td>
                            {created ? (
                              <Small
                                $muted
                                title={formatAbsolute(created)}
                                style={{ whiteSpace: 'nowrap' }}
                              >
                                {formatDay(created)}
                              </Small>
                            ) : (
                              <Small $faint>—</Small>
                            )}
                          </td>
                        ) : (
                          <td>
                            <ChainChip chainId={registry.chainId} size="sm" />
                          </td>
                        )}
                        <td className="num">
                          {formatInt(entryCount(registry))}
                        </td>
                        <td className="num">
                          <OpenRequestsCell registry={registry} />
                        </td>
                        <td className="num">
                          <CourtCell>
                            <CourtValue count={registry.disputeCount} />
                          </CourtCell>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </TableScroller>
          ) : shown === 'cards' ? (
            <CardGrid>
              {shownRows.map((registry, index) => {
                const created = shownCreation(registry, sort)
                const blurb = registryBlurb(registry)
                return (
                  <CardLink
                    key={registry.id}
                    to={registryHref(registry)}
                    style={{ ['--i' as string]: Math.min(index, 12) }}
                  >
                    <CardTop>
                      <RegistryLogo registry={registry} size={40} />
                      <span style={{ minWidth: 0 }}>
                        <NameLine>
                          <Name>{registry.title}</Name>
                          <ListSeal registry={registry} />
                        </NameLine>
                        <SubLine>
                          {kindLabel(registry.kind)}
                          {created && (
                            <>
                              {' · '}
                              <CreatedOn timestamp={created} />
                            </>
                          )}
                        </SubLine>
                      </span>
                    </CardTop>
                    {blurb ? (
                      <CardDescription>{blurb}</CardDescription>
                    ) : (
                      !hasAddressTitle(registry) && (
                        <CardDescription>
                          {kindLabel(registry.kind)} registry at{' '}
                          <code>{truncateMiddle(registry.address)}</code>
                        </CardDescription>
                      )
                    )}
                    <Meta style={{ marginTop: 0 }}>
                      <ChainChip chainId={registry.chainId} size="sm" />
                    </Meta>
                    <CardStats>
                      <span>
                        <StatValue $large $zero={entryCount(registry) === 0}>
                          {formatInt(entryCount(registry))}
                        </StatValue>
                        <StatLabel>Entries</StatLabel>
                      </span>
                      <CardSide>
                        <span title={pendingTitle(registry)}>
                          <b data-zero={registry.pendingCount === 0}>
                            {formatInt(registry.pendingCount)}
                          </b>
                          {pendingLabel(registry.kind)}
                        </span>
                        <span>
                          <b data-zero={registry.disputeCount === 0}>
                            <CourtValue count={registry.disputeCount} />
                          </b>
                          In court
                        </span>
                      </CardSide>
                    </CardStats>
                  </CardLink>
                )
              })}
            </CardGrid>
          ) : (
            <List>
              {shownRows.map((registry, index) => {
                const created = shownCreation(registry, sort)
                const blurb = registryBlurb(registry)
                return (
                  <RowLink
                    key={registry.id}
                    to={registryHref(registry)}
                    title={`${registry.title} · ${registry.address}`}
                    style={{ ['--i' as string]: Math.min(index, 12) }}
                  >
                    <RegistryLogo registry={registry} />
                    <RowId>
                      <NameLine>
                        <Name>{registry.title}</Name>
                        <ListSeal registry={registry} />
                      </NameLine>
                      <RowMeta>
                        <Chip>{kindLabel(registry.kind)}</Chip>
                        <ChainChip chainId={registry.chainId} size="sm" />
                        {created && <CreatedOn timestamp={created} />}
                        {/* No blurb when the title already is the address. */}
                        {blurb ? (
                          <Blurb>{blurb}</Blurb>
                        ) : (
                          !hasAddressTitle(registry) && (
                            <Blurb>
                              <code>{truncateMiddle(registry.address)}</code>
                            </Blurb>
                          )
                        )}
                      </RowMeta>
                    </RowId>
                    <RowStat $area="entries">
                      <StatValue $large $zero={entryCount(registry) === 0}>
                        {formatInt(entryCount(registry))}
                      </StatValue>
                      <StatLabel>Entries</StatLabel>
                    </RowStat>
                    <RowStat $area="open" title={pendingTitle(registry)}>
                      <StatValue $zero={registry.pendingCount === 0}>
                        {formatInt(registry.pendingCount)}
                      </StatValue>
                      <StatLabel>{pendingLabel(registry.kind)}</StatLabel>
                    </RowStat>
                    <RowStat $area="court">
                      <StatValue $zero={registry.disputeCount === 0}>
                        <CourtValue count={registry.disputeCount} />
                      </StatValue>
                      <StatLabel>In court</StatLabel>
                    </RowStat>
                    <Go data-go aria-hidden>
                      <ArrowIcon />
                    </Go>
                  </RowLink>
                )
              })}
            </List>
          )}

          {!loading && !failed && registries.length > 0 && (
            <Footer>
              <Small $muted>
                {formatInt((currentPage - 1) * PAGE_SIZE + 1)}–
                {formatInt(
                  Math.min(currentPage * PAGE_SIZE, registries.length),
                )}{' '}
                of {formatInt(registries.length)}{' '}
                {listsLabel(trust, registries.length)}
              </Small>
              {registries.length > PAGE_SIZE && (
                <Pagination
                  current={currentPage}
                  pageSize={PAGE_SIZE}
                  total={registries.length}
                  onChange={(page: number) =>
                    setParam({ page: page === 1 ? null : String(page) })
                  }
                />
              )}
            </Footer>
          )}
        </Explorer>

        <Rail aria-label="Verification and activity">
          <Surface
            as="section"
            $padding="standard"
            aria-labelledby="browse-verify-title"
            style={{ ['--i' as string]: 4 }}
          >
            <RailTitle id="browse-verify-title">
              <TitleSeal size={20} decorative />
              Get {VERIFIED_LABEL}
            </RailTitle>
            <Small $muted as="p" style={{ margin: '6px 0 0' }}>
              Submit your list to the Kleros list of lists on its chain.
            </Small>
            <VerifyLinks>
              {verificationChains.map((chainId) => {
                const href = verificationHref(chainId)
                return href ? (
                  <VerifyLink
                    key={chainId}
                    to={href}
                    aria-label={`Submit a list to the Kleros list of lists on ${chainName(chainId)}`}
                  >
                    <RailChain chainId={chainId} size={20} />
                    <span>{chainName(chainId)}</span>
                    <span>
                      Submit <ArrowIcon size={14} />
                    </span>
                  </VerifyLink>
                ) : null
              })}
            </VerifyLinks>
          </Surface>

          <Surface
            as="section"
            $padding="standard"
            aria-labelledby="browse-activity-title"
            style={{ ['--i' as string]: 5 }}
          >
            <RailHead>
              <RailTitle id="browse-activity-title">Recent activity</RailTitle>
              <Label $tone="faint">Latest 5</Label>
            </RailHead>
            {loading ? (
              <SkeletonBlock $height="220px" style={{ marginTop: 10 }} />
            ) : failed ? (
              <Small $muted>No activity until the indexers answer.</Small>
            ) : latest.length === 0 ? (
              <Small $muted>No recent requests in this scope.</Small>
            ) : (
              <Feed>
                {latest.map((activity) => {
                  const found = registryByKey.get(
                    listKey(activity.chainId, activity.registryAddress),
                  )
                  const registry = found && complete(found)
                  const image = activity.itemID
                    ? entryImages.data?.[
                        entryKey({
                          registryAddress: activity.registryAddress,
                          itemID: activity.itemID,
                        })
                      ]
                    : undefined
                  return (
                    <FeedItem key={activity.id}>
                      <Link to={activity.href}>
                        <FeedThumb>
                          <Avatar
                            uri={[image, registry?.logoURI]}
                            seed={activity.registryAddress}
                            size={36}
                          />
                          <FeedDot $tone={activityTone(activity)} aria-hidden />
                        </FeedThumb>
                        <span style={{ minWidth: 0 }}>
                          <strong>{activity.status}</strong>
                          {activity.previewProps?.[0]?.value && (
                            <Identifier
                              label={activity.previewProps[0].label}
                              value={activity.previewProps[0].value}
                            />
                          )}
                          <FeedFoot>
                            <ListName
                              title={registry?.title ?? activity.registryTitle}
                              address={activity.registryAddress}
                            />
                            <ListSeal registry={registry} size={12} />
                            <time
                              dateTime={new Date(
                                activity.timestamp * 1000,
                              ).toISOString()}
                              title={formatAbsolute(activity.timestamp)}
                            >
                              {formatAgo(activity.timestamp, now)}
                            </time>
                          </FeedFoot>
                        </span>
                        <span title={chainName(activity.chainId)}>
                          <RailChain chainId={activity.chainId} size={18} />
                          <VisuallyHidden>
                            {chainName(activity.chainId)}
                          </VisuallyHidden>
                        </span>
                      </Link>
                    </FeedItem>
                  )
                })}
              </Feed>
            )}
          </Surface>
        </Rail>
      </Split>
    </Page>
  )
}

export default BrowsePage
