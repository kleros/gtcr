import React, { useEffect, useId, useState } from 'react'
import styled from 'styled-components'
import { Link } from 'react-router-dom'
import ChainLogo from 'components/chain-logo'
import {
  Label,
  SkeletonBlock,
  Small,
  Surface,
  VisuallyHidden,
} from 'components/curate/primitives'
import { CurateIcon } from 'components/curate/icons'
import { AnimatedNumber } from 'components/curate/motion/animated-number'
import { reveal } from 'components/curate/motion/reveal'
import {
  VERIFIED_LISTS_LABEL,
  VerifiedBadge,
} from 'components/curate/verified-badge'
import { isListOfLists } from 'config/list-of-lists'
import { parseIpfs } from 'utils/ipfs-parse'
import { formatDate } from 'utils/time'
import type { DashboardRegistry } from './types'
import { chainInfo, entryCount, registryHref } from './view'

/*
 * Kleros Verified (round 2, items 16 and 17): the lists that carry the
 * badge of approval, shown as themselves rather than as a share of every
 * list. The badge (its tooltip says what Verified means), how many there
 * are in the page's scope, and a strip of them, newest to earn the badge
 * first: logo, name, chain and when it earned the badge (its earliest
 * registration on any of the chain's Kleros lists of lists, Light or
 * Classic), each leading to its list. The lists of lists themselves grant
 * the badge, read "List of lists" and close the strip. The Most
 * active table below ranks by open requests, so the two never mirror. The
 * last tile leads to every Verified list in Browse. On wide screens the
 * strip shows as many as fit on one row; on phones it scrolls sideways.
 */

/** Tiles read for the strip (wide screens show the ones that fit). */
const STRIP_MAX = 12
const TILE_MIN = 136
const GAP = 12

const integer = new Intl.NumberFormat('en-US')
const monthYear = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

const mediaUrl = (uri?: string | null): string | null => {
  if (!uri) return null
  if (/^https?:\/\//i.test(uri)) return uri
  return parseIpfs(uri)
}

const Band = styled(Surface)`
  display: grid;
  grid-template-columns: 188px minmax(0, 1fr);
  align-items: center;
  gap: 20px 28px;
  margin-top: 16px;
  padding: 20px 22px;
  ${reveal}

  @media (max-width: 720px) {
    grid-template-columns: minmax(0, 1fr);
    padding: 18px 16px;
  }
`

const Head = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;

  @media (max-width: 720px) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
`

const Figure = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;

  @media (max-width: 720px) {
    align-items: flex-end;
  }
`

const Count = styled.p`
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);

  b {
    color: var(--color-text);
    font-family: var(--font-figure);
    font-size: clamp(32px, 1.4vw + 22px, 44px);
    line-height: 0.95;
    font-weight: 500;
    letter-spacing: -0.04em;
    font-variant-numeric: tabular-nums;
  }
`

const Strip = styled.ul`
  display: grid;
  grid-template-columns: repeat(var(--cols, 6), minmax(0, 1fr));
  gap: ${GAP}px;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;

  > li {
    display: flex;
    min-width: 0;
    ${reveal}
  }

  /* Past the row: out of view and out of the tab order, but still laid
     out, so a tile coming back on a resize does not replay its entrance. */
  > li[data-over] {
    position: absolute;
    width: 0;
    height: 0;
    overflow: hidden;
    visibility: hidden;
  }

  /* Phones: every tile, in a row that scrolls sideways. */
  @media (max-width: 720px) {
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scroll-padding: 0 2px;
    padding: 2px 2px 8px;
    margin: -2px -2px -8px;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }

    > li,
    > li[data-over] {
      position: static;
      display: flex;
      flex: 0 0 136px;
      width: auto;
      height: auto;
      overflow: visible;
      visibility: visible;
      scroll-snap-align: start;
    }
  }
`

const Tile = styled(Link)`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  background: var(--color-raised);
  box-shadow: inset 0 1px 0 var(--glass-highlight);
  color: inherit;
  text-decoration: none;
  transition:
    border-color var(--motion),
    background var(--motion),
    transform var(--motion);

  &:hover {
    border-color: var(--color-border-strong);
    background: color-mix(in srgb, var(--color-raised), var(--color-text) 4%);
    transform: translateY(-2px);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    &:hover {
      transform: none;
    }
  }
`

const LogoWrap = styled.span`
  position: relative;
  display: inline-flex;
  align-self: flex-start;

  /* The seal rides the logo's corner, on a surface-coloured ring. */
  > span:last-child {
    position: absolute;
    right: -6px;
    bottom: -5px;
    padding: 2px;
    border-radius: 999px;
    background: var(--color-surface);
  }
`

const Logo = styled.span<{ $image?: string | null }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  background: ${({ $image }) =>
    $image ? `url(${$image}) center / cover` : 'var(--color-surface)'};
  color: var(--color-faint);
`

const Name = styled.span`
  display: -webkit-box;
  min-height: 36px;
  overflow: hidden;
  color: var(--color-text);
  font-size: 13px;
  line-height: 18px;
  font-weight: 500;
  overflow-wrap: anywhere;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;

  small {
    color: var(--color-muted);
    font-size: inherit;
    font-weight: 400;
  }
`

const Meta = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: auto;
  color: var(--color-muted);
  font-family: var(--font-figure);
  font-size: 12px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

const AllTile = styled(Tile)`
  justify-content: space-between;
  border-style: dashed;
  background: transparent;
  box-shadow: none;

  > span:first-child {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: 1px solid var(--glass-border);
    border-radius: 999px;
    color: var(--color-text);
  }

  &:hover > span:first-child {
    border-color: var(--color-border-strong);
  }
`

/** Columns that fit the strip's width (the "All" tile included). */
const useColumns = () => {
  const [node, setNode] = useState<HTMLUListElement | null>(null)
  const [cols, setCols] = useState(6)
  useEffect(() => {
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width
      setCols(Math.max(2, Math.floor((width + GAP) / (TILE_MIN + GAP))))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])
  return [setNode, cols] as const
}

export const VerifiedLists = ({
  lists,
  loading,
  browseHref,
  scopeKey,
  failed,
}: {
  /** The Kleros Verified lists in scope, newest to earn the badge first. */
  lists: DashboardRegistry[]
  loading: boolean
  /** Browse's Verified tab, in the page's scope. */
  browseHref: string
  /** Changes with the scope, so the strip enters again. */
  scopeKey: string
  /** Some chain in scope did not load: an empty strip says so, not "none". */
  failed: boolean
}) => {
  const titleId = useId()
  const [stripRef, cols] = useColumns()
  const shown = lists.slice(0, STRIP_MAX)
  // Lists sharing a name on two chains ("Seer Markets") say which chain.
  const repeated = new Set(
    lists
      .map((registry) => registry.title)
      .filter((title, index, titles) => titles.indexOf(title) !== index),
  )

  return (
    <Band
      as="section"
      $padding="none"
      aria-labelledby={titleId}
      style={{ ['--i' as string]: 8 }}
    >
      <VisuallyHidden as="h3" id={titleId}>
        {VERIFIED_LISTS_LABEL}
      </VisuallyHidden>
      <Head>
        <VerifiedBadge variant="pill" tooltip />
        <Figure>
          <Count>
            <b>
              <AnimatedNumber
                value={
                  loading || (failed && lists.length === 0)
                    ? undefined
                    : lists.length
                }
              />
            </b>
            {lists.length === 1 ? 'list' : 'lists'}
          </Count>
          {!loading && lists.length > 1 && (
            <Label $tone="faint" aria-hidden>
              Newest first
            </Label>
          )}
        </Figure>
      </Head>
      {loading ? (
        <SkeletonBlock $height="128px" />
      ) : lists.length === 0 ? (
        <Small $muted>
          {failed
            ? 'The lists did not load.'
            : 'No Kleros Verified list on this chain yet.'}
        </Small>
      ) : (
        <Strip
          key={scopeKey}
          ref={stripRef}
          style={{ ['--cols' as string]: cols }}
          aria-label={`${VERIFIED_LISTS_LABEL}, newest to earn the badge first`}
        >
          {shown.map((registry, index) => (
            <li
              key={registry.id}
              data-over={index >= cols - 1 ? '' : undefined}
              style={{ ['--i' as string]: index }}
            >
              <Tile
                to={registryHref(registry)}
                title={`${registry.title} · ${integer.format(entryCount(registry))} ${entryCount(registry) === 1 ? 'entry' : 'entries'}${registry.verifiedAt ? ` · Kleros Verified since ${formatDate(registry.verifiedAt)}` : ''}`}
              >
                <LogoWrap>
                  <Logo $image={mediaUrl(registry.logoURI)} aria-hidden>
                    {!registry.logoURI && (
                      <CurateIcon name="registry" size={18} />
                    )}
                  </Logo>
                  <VerifiedBadge size={14} decorative />
                </LogoWrap>
                <Name>
                  {registry.title}
                  {repeated.has(registry.title) && (
                    <small> on {chainInfo(registry.chainId)?.name}</small>
                  )}
                </Name>
                <Meta>
                  <ChainLogo chainId={registry.chainId} size={14} />
                  <VisuallyHidden>
                    {chainInfo(registry.chainId)?.name},{' '}
                  </VisuallyHidden>
                  {isListOfLists(registry.chainId, registry.address) ? (
                    'List of lists'
                  ) : registry.verifiedAt ? (
                    <time
                      dateTime={new Date(
                        registry.verifiedAt * 1000,
                      ).toISOString()}
                    >
                      Since {monthYear.format(registry.verifiedAt * 1000)}
                    </time>
                  ) : null}
                </Meta>
              </Tile>
            </li>
          ))}
          <li style={{ ['--i' as string]: Math.min(cols, shown.length) }}>
            <AllTile to={browseHref}>
              <span aria-hidden>
                <CurateIcon name="submit" size={14} />
              </span>
              <Name>
                All {integer.format(lists.length)}
                <br />
                in Browse
              </Name>
            </AllTile>
          </li>
        </Strip>
      )}
    </Band>
  )
}

export default VerifiedLists
