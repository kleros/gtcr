import React, { useLayoutEffect, useRef, useState } from 'react'
import styled, { css, keyframes } from 'styled-components'
import { Link } from 'react-router-dom'
import { parseIpfs } from 'utils/ipfs-parse'
import PolicyUpdatedBadge from 'components/policy-updated-badge'
import { inkPlate, useLogoInk } from 'components/curate/logo-ink'
import { getAddressPage } from 'utils/network-utils'
import {
  Button,
  ButtonAnchor,
  ChainChip,
  Label,
  SkeletonBlock,
  StatusDot,
  Surface,
  truncateMiddle,
  VisuallyHidden,
} from './primitives'
import { CurateIcon } from './icons'
import { TrustTag } from './verified-badge'
import { KindTag } from './stake-tag'
import { AddressWrap, CopyValue } from './chrome-address'
import { Explainer, type ExplainerStep } from './explainer'
import { RingGauge } from './motion/ring-gauge'
import { reveal } from './motion/reveal'
import { CountUpText, isPlainCount } from './registry-shared-count'

/*
 * Registry header, a portfolio panel (YMax): identity first, with the list's
 * own address as an explorer link (its arrow shown at rest, copy beside it),
 * then the headline figure with the live counts and the list's terms beside
 * it, and at the right end of that row the list's two gauges — the share of
 * its entries on the list, and beside it the share of its resolved
 * challenges that took an entry off, with the ones that kept an entry and
 * the ones still in court under it. Each is drawn once the page passes its
 * counts; the challenges gauge is drawn on every list whose challenges were
 * read, an empty ring when none has been resolved yet. One inline stat can
 * be marked as the list's live work (open requests): it reads in the window
 * blue behind a haloed dot, so it carries the status colour rather than the
 * look of a link. Then the one action with its exact deposit and what
 * happens to it (a deposit on Standard, a locked stake on Stake), and under
 * it the slot for a control only the list's governor sees (`governance`):
 * the page passes it, and it draws nothing for anyone else. Parameters
 * slide open as a drawer; the per-list explainer waits in a pill.
 */

const integer = new Intl.NumberFormat('en-US')

const Shell = styled(Surface)`
  ${reveal}
`

const Top = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px 40px;
  padding: 28px 28px 24px;

  @media (max-width: 860px) {
    flex-direction: column;
    align-items: stretch;
    padding: 20px 18px;
  }
`

const Identity = styled.div`
  display: flex;
  gap: 18px;
  min-width: 0;

  @media (max-width: 520px) {
    gap: 14px;
  }
`

/* The list's logo is an <img>, never a CSS url(): logoURI comes from
   MetaEvidence that any list creator controls. */
const Logo = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 60px;
  height: 60px;
  overflow: hidden;
  border: 1px solid var(--glass-border);
  border-radius: 18px;
  background: var(--color-raised);
  box-shadow:
    0 0 0 4px color-mix(in srgb, var(--color-primary) 10%, transparent),
    0 12px 36px -12px var(--color-primary),
    inset 0 1px 0 var(--glass-highlight);
  color: var(--color-faint);

  img {
    display: block;
    width: 78%;
    height: 78%;
    object-fit: contain;
  }

  /* A logo whose ink is lost on the tile (a black mark in a dark theme). */
  ${inkPlate}

  @media (max-width: 520px) {
    width: 48px;
    height: 48px;
    border-radius: 14px;
  }
`

const LogoMark = ({ src }: { src?: string | null }) => {
  const ink = useLogoInk(src)
  return (
    <Logo aria-hidden {...(src && !ink.failed ? ink.plate : {})}>
      {src && !ink.failed ? (
        <img key={ink.key} src={src} alt="" {...ink.img} />
      ) : (
        <CurateIcon name="registry" size={24} />
      )}
    </Logo>
  )
}

const IdText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
`

const Title = styled.h1`
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: clamp(30px, 1.6vw + 18px, 40px);
  line-height: 1.04;
  font-weight: 500;
  letter-spacing: -0.03em;
  overflow-wrap: anywhere;
`

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
`

/* The trust mark arrives with its data: it fades in rather than popping. */
const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`

const TrustSlot = styled.span`
  display: inline-flex;
  animation: ${fadeIn} 240ms var(--ease-out, ease-out) both;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const Address = styled.span`
  padding: 0 4px;
  color: var(--color-muted);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 24px;
`

/*
 * The list's own address opens it on the chain's explorer. Its arrow is
 * shown at rest, unlike the arrow of an address in a dense cell, because
 * this one stands alone in the identity row and has to read as a link at a
 * glance; hover and keyboard focus both brighten the address and nudge the
 * arrow out, the way it leaves the app. The copy beside it keeps its room
 * and fades in, so the chips never reflow under the pointer. A screen
 * reader hears what the hex is and that it opens a new tab, from hidden
 * text around the visible address, so the name still holds what is seen.
 */
const ContractLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 24px;
  padding: 0 4px;
  color: var(--color-muted);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 24px;
  text-decoration: none;
  white-space: nowrap;
  transition: color var(--motion);

  svg {
    flex: 0 0 auto;
    opacity: 0.7;
    transition:
      opacity var(--motion),
      color var(--motion),
      transform 240ms var(--ease-out);
  }

  &:hover,
  &:focus-visible {
    color: var(--color-text);
  }

  &:hover svg,
  &:focus-visible svg {
    opacity: 1;
    color: var(--color-primary);
    transform: translate(1px, -1px);
  }

  @media (prefers-reduced-motion: reduce) {
    &:hover svg,
    &:focus-visible svg {
      transform: none;
    }
  }
`

const Description = styled.div`
  max-width: 72ch;
  color: var(--color-muted);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
`

const Action = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  flex: 0 0 auto;
  width: min(100%, 300px);

  @media (max-width: 860px) {
    width: 100%;
  }
`

/* Full on-primary ink: any fade drops the amount under AA on the blue
   fill. The lighter weight is what sets it apart from the label. */
const Amount = styled.span`
  font-weight: 400;
  font-variant-numeric: tabular-nums;
`

const Note = styled.span`
  color: var(--color-faint);
  font-size: 12px;
  line-height: 16px;
  text-align: center;
`

/* Every figure sits on the band's bottom line: the headline, the inline
   stats and the ring's caption share one row of labels and one of values.
   The challenges' split hangs below that line, so the band keeps room under
   it rather than letting it touch the footer's hairline. */
const Figures = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 24px 48px;
  padding: 24px 28px;
  border-top: 1px solid var(--glass-border);

  &[data-split] {
    padding-bottom: 36px;
  }

  @media (max-width: 860px) {
    padding: 20px 18px;
    gap: 20px 32px;

    &[data-split] {
      padding-bottom: 32px;
    }
  }

  /* Phones (round 10): the band is centred, the headline, the stats and the
     gauges each on the page's middle, rather than left with a gap beside. */
  @media (max-width: 520px) {
    justify-content: center;
    text-align: center;
  }
`

const Headline = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;

  @media (max-width: 520px) {
    align-items: center;
    width: 100%;
  }
`

const Big = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 14px;
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: clamp(48px, 2.6vw + 26px, 64px);
  line-height: 0.92;
  font-weight: 500;
  letter-spacing: -0.045em;
  font-variant-numeric: tabular-nums;

  /* The window role, the same one the inline stats mark, at headline size:
     the open requests are the list's live work and what a challenger came
     for, so they lead. The haloed dot is what keeps a blue figure from
     reading as a link. */
  &[data-accent] {
    color: var(--status-window);
  }
`

/* A count the indexer did not return: a quiet word, not a display-size dash. */
const Unknown = styled.span`
  display: inline-block;
  color: var(--color-muted);
  font-family: var(--font-sans);
  font-size: 20px;
  line-height: 28px;
  font-weight: 500;
  letter-spacing: -0.01em;
`

const Missing = styled.span`
  color: var(--color-muted);
`

const InlineStats = styled.dl`
  display: flex;
  flex-wrap: wrap;
  gap: 18px 36px;
  margin: 0 auto 4px 0;

  div {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  dt {
    white-space: nowrap;
  }

  dd {
    margin: 0;
    color: var(--color-text);
    font-family: var(--font-figure);
    font-size: 18px;
    line-height: 22px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  /* The one stat the page marks. The blue is the status role for an open
     window, which is what an open request is; the dot and its halo are what
     keep a blue figure from reading as a link. */
  dd[data-accent] {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--status-window);
    font-size: 24px;
    line-height: 28px;
  }

  @media (max-width: 520px) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
    margin: 0;
    gap: 16px 20px;

    div {
      align-items: center;
    }

    /* An odd last stat (the challenge period) takes the row, centred. */
    div:last-child:nth-child(odd) {
      grid-column: 1 / -1;
    }

    dd {
      font-size: 16px;
    }

    dd[data-accent] {
      font-size: 20px;
    }
  }
`

/*
 * The gauges wrap as one block at the end of the figure row, so a narrow
 * page breaks the row before them rather than between them. On the row's
 * line they take its spare room and sit at its right end. Once they have
 * wrapped onto a line of their own (a laptop or tablet width), they spread
 * across it, the first ring under the headline and the second at the right
 * edge, rather than hugging the left and leaving half the band empty.
 */
const Gauges = styled.div`
  display: flex;
  flex: 1 1 auto;
  align-items: flex-end;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 28px;

  &[data-wrapped] {
    justify-content: space-between;
  }

  @media (max-width: 640px) {
    gap: 20px 24px;
  }

  /* Phones: the two gauges side by side, each centred over its caption. */
  @media (max-width: 520px) {
    &,
    &[data-wrapped] {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
      align-items: start;
      justify-items: center;
      width: 100%;
      gap: 20px 12px;
    }
  }
`

/*
 * Whether the gauges sit on a line of their own under the figures. It is
 * read from the layout because where the row breaks depends on the figures'
 * own widths (the counts, the period, a Stake list's locked stake), not on
 * the viewport. Only the gauges' justify-content follows it, and that never
 * moves the break, so the reading cannot flip back and forth.
 */
const useGaugesWrapped = () => {
  const row = useRef<HTMLDivElement>(null)
  const [wrapped, setWrapped] = useState(false)
  useLayoutEffect(() => {
    const node = row.current
    if (!node || typeof ResizeObserver === 'undefined') return undefined
    const measure = () => {
      const gauges = node.querySelector('[data-gauges]')
      const first = node.firstElementChild
      setWrapped(
        !!gauges &&
          !!first &&
          gauges !== first &&
          gauges.getBoundingClientRect().top >=
            first.getBoundingClientRect().bottom - 1,
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return [row, wrapped] as const
}

const RingBlock = styled.figure`
  display: flex;
  align-items: flex-end;
  gap: 16px;
  margin: 0;

  /*
   * The gauge's arc is painted from 10% to 78% of its box (the gap is at the
   * bottom), so a box aligned on the row's bottom draws the ring well above
   * the figures beside it. Hanging the box 26px lower puts the painted ring's
   * middle on the middle of the label and value lines; the hanging part is
   * the empty gap, inside the row's padding.
   */
  > figure {
    margin-bottom: -26px;
  }

  figcaption {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 5px;
  }

  @media (max-width: 520px) {
    flex-direction: column;
    align-items: center;
    gap: 6px;

    > figure {
      margin-bottom: -18px;
    }

    figcaption {
      align-items: center;
      margin-bottom: 0;
      text-wrap: balance;
    }
  }

  b {
    color: var(--color-text);
    font-size: 15px;
    line-height: 20px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
`

/*
 * The two outcomes the challenges ring does not draw: the ones that kept
 * the entry and the ones still in court. Muted, under the figure, and hung
 * below the caption into the row's padding (as the ring hangs below its own
 * box), so the figure above it stays on the row's one line of values.
 */
const Split = styled.span`
  margin-bottom: -22px;
  color: var(--color-muted);
  font-size: 12px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

const Footer = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 22px;
  padding: 14px 28px;
  border-top: 1px solid var(--glass-border);

  @media (max-width: 860px) {
    padding: 14px 18px;
  }
`

const quiet = css`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 24px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: color var(--motion);

  &:hover {
    color: var(--color-text);
  }

  svg {
    flex: 0 0 auto;
  }
`

const QuietButton = styled.button`
  ${quiet}
`

const QuietLink = styled(Link)`
  ${quiet}
`

const ParamsToggle = styled.button`
  ${quiet}
  color: var(--color-text);

  svg {
    transition: transform 360ms cubic-bezier(0.34, 1.4, 0.64, 1);
  }

  &[aria-expanded='true'] svg {
    transform: rotate(180deg);
  }
`

const Drawer = styled.div<{ $open: boolean }>`
  display: grid;
  grid-template-rows: ${({ $open }) => ($open ? '1fr' : '0fr')};
  visibility: ${({ $open }) => ($open ? 'visible' : 'hidden')};
  transition:
    grid-template-rows 420ms cubic-bezier(0.16, 1, 0.3, 1),
    visibility 0s linear ${({ $open }) => ($open ? '0s' : '420ms')};

  > div {
    min-height: 0;
    overflow: hidden;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const ParamsGrid = styled.dl`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0 32px;
  margin: 0;
  padding: 4px 28px 24px;
  border-top: 1px solid var(--glass-border);

  > div {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    padding: 16px 0 14px;
    border-bottom: 1px solid var(--glass-border);
  }

  dd {
    margin: 0;
    color: var(--color-text);
    font-size: var(--fs-body);
    line-height: var(--lh-body);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }

  dd + dd {
    color: var(--color-faint);
    font-size: 12px;
    line-height: 16px;
    font-weight: 400;
  }

  @media (max-width: 860px) {
    padding: 4px 18px 18px;
  }
`

export interface RegistryParameter {
  label: string
  value?: React.ReactNode
  hint?: string
}

export interface RegistryStat {
  label: string
  value?: React.ReactNode
  /**
   * Marks this stat as the list's live work: drawn in the window blue with a
   * haloed dot. One stat at most, or the row is a page of blue figures and
   * nothing stands out.
   */
  tone?: 'window'
}

const isMissing = (value?: React.ReactNode) =>
  value === undefined || value === null || value === ''

/** A count worth a status dot: "84" yes, "0" and "—" no. */
const isLiveCount = (value?: React.ReactNode) =>
  isPlainCount(value) && Number(value.replace(/,/g, '')) > 0

/** A figure from a capped read is a lower bound: it reads "n+". */
const lowerBound = (value: number, capped?: boolean) =>
  `${integer.format(value)}${capped && value > 0 ? '+' : ''}`

/** Plain counts climb; anything else (durations, amounts, nodes) stays put. */
const StatValue = ({ value }: { value?: React.ReactNode }) =>
  isMissing(value) ? (
    <Missing>—</Missing>
  ) : isPlainCount(value) ? (
    <CountUpText value={value} />
  ) : (
    <>{value}</>
  )

/**
 * A Kleros court's name as a phrase, for the explainer and the Parameters
 * hints of both list kinds: "xDai Curation" reads "xDai Curation court", a
 * name that already says it ("General Court") is left as it is, and a
 * trailing qualifier stays after the word: "xDai Curation court (Hidden
 * Voting)".
 */
export const courtPhrase = (name: string): string => {
  const match = name.match(/^(.*?)\s*(\([^)]*\))$/)
  const base = match ? match[1] : name
  const qualifier = match ? ` ${match[2]}` : ''
  return `${/court$/i.test(base) ? base : `${base} court`}${qualifier}`
}

/** What happens to the primary button's amount, per kind. */
const depositNoteFor = (kind: 'standard' | 'permanent', itemName: string) =>
  kind === 'permanent'
    ? `Locked, not spent: it stays locked while your ${itemName} is listed and comes back when you withdraw, unless a challenge succeeds.`
    : `A deposit, not a fee: it comes back when your ${itemName} follows the list’s policy.`

export const RegistryHeader = ({
  title,
  description,
  logoURI,
  chainId,
  address,
  verified,
  listOfLists = false,
  kind,
  itemName,
  itemNamePlural,
  primaryLabel,
  primaryAmount,
  depositNote,
  onPrimary,
  policyURI,
  onOpenPolicy,
  policyUpdated = true,
  badgesListTo,
  stats,
  parameters,
  explainerId,
  explainerHeading,
  explainerSteps,
  loading,
  registeredCount,
  totalCount,
  registeredLabel = 'Registered now',
  challenges,
  governance,
}: {
  title?: string
  description?: string
  logoURI?: string | null
  chainId?: number
  address: string
  /**
   * Kleros Verified: the chain's Kleros list of lists or registered on it
   * (useRegistryVerified); false is a Community list. Undefined while that
   * is loading or could not be read: no trust mark then, so the header
   * never calls a list Community without data.
   */
  verified?: boolean
  /** The registry is the chain's Kleros list of lists. */
  listOfLists?: boolean
  /** A Stake list carries the Stake tag; a standard list carries none. */
  kind: 'standard' | 'permanent'
  itemName: string
  /** The list's own plural, where its metadata gives one ("entries"). */
  itemNamePlural?: string
  primaryLabel: string
  /** The exact amount the button sends; also listed in Parameters. */
  primaryAmount?: React.ReactNode
  /** The line under the button: what happens to the amount. Defaults by kind. */
  depositNote?: React.ReactNode
  onPrimary: () => void
  policyURI?: string | null
  onOpenPolicy?: () => void
  /**
   * Show when the policy last changed. Off where the history cannot be read
   * (Stake lists), so no placeholder appears and then vanishes.
   */
  policyUpdated?: boolean
  badgesListTo?: string
  stats: RegistryStat[]
  parameters: RegistryParameter[]
  explainerId: string
  explainerHeading: string
  explainerSteps: ExplainerStep[]
  loading?: boolean
  /** Entries registered right now; with `totalCount`, drawn as a ring. */
  registeredCount?: number
  /** Every entry the registered share is taken from. */
  totalCount?: number
  /** Names the first gauge: a Stake list lists, it does not register. */
  registeredLabel?: string
  /**
   * What the challenges on this list did to its entries, as the second
   * gauge: the share of the resolved ones that took an entry off, with the
   * ones that kept it and the ones still in court under it. Passed once the
   * challenges are read, even when there are none: the gauge is then an
   * honest empty ring. `scope` names what they were counted from when that
   * read was capped, and is what makes the figures read "n+".
   */
  challenges?: {
    offList: number
    onList: number
    /** Challenges not resolved yet: their disputes are still open. */
    inCourt?: number
    /** The phrase after "of": "the newest 1,000 challenges". */
    scope?: string
  }
  /**
   * A control only the list's governor sees, under the action and its note
   * (components/curate/list-governance.tsx); it renders nothing for anyone
   * else, so the column keeps its height for everyone who is not.
   */
  governance?: React.ReactNode
}) => {
  const [paramsOpen, setParamsOpen] = useState(false)
  const [figuresRef, gaugesWrapped] = useGaugesWrapped()
  const explorer = chainId
    ? getAddressPage({ networkId: chainId, address })
    : null
  const [headline, ...rest] = stats
  // The list's window sits beside the counts; its deposit is in the button
  // and in Parameters, never printed a third time here.
  const period = parameters.find((parameter) =>
    /period$/i.test(parameter.label),
  )
  const inline: RegistryStat[] = [
    ...rest,
    ...(period ? [{ label: period.label, value: period.value }] : []),
  ]
  const showRing =
    registeredCount !== undefined &&
    totalCount !== undefined &&
    Number.isFinite(registeredCount) &&
    Number.isFinite(totalCount) &&
    totalCount > 0
  const registeredShare = showRing
    ? Math.min(1, Math.max(0, registeredCount / totalCount))
    : 0
  // The challenges gauge is drawn on every list whose challenges were read,
  // the owner's "for all lists": a list where none has been resolved shows
  // an empty ring and says so, rather than leaving the green gauge alone as
  // if this one did not apply. The ring is the share of the resolved ones
  // that took an entry off; the line under it names the other two outcomes
  // so the count of challenges is whole: the ones that kept the entry, and
  // the ones still in court, which no ring share can include yet.
  const showChallenges = challenges !== undefined
  const offList = challenges?.offList ?? 0
  const kept = challenges?.onList ?? 0
  const inCourt = challenges?.inCourt ?? 0
  const resolved = offList + kept
  const raised = resolved + inCourt
  const challengeScope = challenges?.scope
  const capped = !!challengeScope
  const challengeNote = challengeScope
    ? `Counted from ${challengeScope}.`
    : undefined
  // A capped read cannot say "none" of the whole list, only of what it read.
  const challengeFigure =
    resolved > 0
      ? `${lowerBound(offList, capped)} of ${lowerBound(resolved, capped)} resolved`
      : raised > 0
        ? capped
          ? `None resolved in ${challengeScope}`
          : 'None resolved yet'
        : capped
          ? `None in ${challengeScope}`
          : 'No challenges yet'
  const challengeSplit =
    raised > 0
      ? `${lowerBound(kept, capped)} kept · ${lowerBound(inCourt, capped)} in court`
      : undefined

  return (
    <Shell
      $featured
      $padding="none"
      role="region"
      aria-busy={loading}
      aria-label={title ?? 'List'}
    >
      <Top>
        <Identity>
          <LogoMark
            key={logoURI ?? 'none'}
            src={logoURI ? parseIpfs(logoURI) : null}
          />
          <IdText>
            <Title>{title ?? (loading ? 'Loading list…' : 'List')}</Title>
            <Chips>
              {chainId && <ChainChip chainId={chainId} />}
              <KindTag kind={kind} size="md" />
              {verified !== undefined && (
                <TrustSlot>
                  <TrustTag verified={verified} listOfLists={listOfLists} />
                </TrustSlot>
              )}
              {explorer ? (
                <AddressWrap>
                  <ContractLink
                    href={explorer}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${address} · open in explorer`}
                  >
                    <VisuallyHidden>List contract </VisuallyHidden>
                    {truncateMiddle(address, 8, 6)}
                    <CurateIcon name="external" size={12} />
                    <VisuallyHidden>
                      {' '}
                      on the explorer (opens in a new tab)
                    </VisuallyHidden>
                  </ContractLink>
                  <CopyValue
                    value={address}
                    label="Copy list address"
                    reserve
                  />
                </AddressWrap>
              ) : (
                <Address title={address}>
                  {truncateMiddle(address, 8, 6)}
                </Address>
              )}
            </Chips>
            {description && <Description>{description}</Description>}
          </IdText>
        </Identity>

        <Action>
          <Button type="button" $variant="primary" $block onClick={onPrimary}>
            <CurateIcon name="submit" size={16} />
            {primaryLabel}
            {primaryAmount && <Amount>· {primaryAmount}</Amount>}
          </Button>
          <Note>{depositNote ?? depositNoteFor(kind, itemName)}</Note>
          {governance}
        </Action>
      </Top>

      <Figures ref={figuresRef} data-split={challengeSplit ? '' : undefined}>
        <Headline>
          <Label $tone="faint">{headline?.label ?? 'Entries'}</Label>
          {isMissing(headline?.value) ? (
            loading ? (
              <SkeletonBlock $width="148px" $height="56px" aria-hidden />
            ) : (
              <Unknown title="The indexer did not return this count">
                Not available
              </Unknown>
            )
          ) : (
            <Big data-accent={headline?.tone === 'window' || undefined}>
              {headline?.tone === 'window' && isLiveCount(headline.value) && (
                <StatusDot $tone="window" aria-hidden />
              )}
              <StatValue value={headline?.value} />
            </Big>
          )}
        </Headline>
        {inline.length > 0 && (
          <InlineStats>
            {inline.map((stat) => (
              <div key={stat.label}>
                <dt>
                  <Label $tone="faint">{stat.label}</Label>
                </dt>
                <dd data-accent={stat.tone === 'window' || undefined}>
                  {stat.tone === 'window' && isLiveCount(stat.value) && (
                    <StatusDot $tone="window" aria-hidden />
                  )}
                  <StatValue value={stat.value} />
                </dd>
              </div>
            ))}
          </InlineStats>
        )}
        {(showRing || showChallenges) && (
          <Gauges data-gauges data-wrapped={gaugesWrapped || undefined}>
            {showRing && (
              <RingBlock>
                <RingGauge
                  size={96}
                  ratio={registeredShare}
                  from="color-mix(in srgb, var(--status-registered) 35%, var(--color-raised))"
                  to="var(--status-registered)"
                  label={`${registeredLabel}: ${integer.format(registeredCount)} of ${integer.format(totalCount)} entries`}
                />
                <figcaption>
                  <Label $tone="faint">{registeredLabel}</Label>
                  <b>
                    {integer.format(registeredCount)} of{' '}
                    {integer.format(totalCount)}
                  </b>
                </figcaption>
              </RingBlock>
            )}
            {showChallenges && (
              <RingBlock title={challengeNote}>
                <RingGauge
                  size={96}
                  ratio={resolved > 0 ? offList / resolved : 0}
                  // No share of nothing: an empty ring holds a dash, the
                  // house mark for a figure there is none of, never "0%".
                  value={resolved > 0 ? undefined : '—'}
                  from="var(--status-contested)"
                  to="var(--status-off)"
                  label={`Challenges that took ${itemNamePlural ?? `${itemName}s`} off the list: ${challengeFigure}${
                    challengeSplit ? `, ${challengeSplit}` : ''
                  }${challengeScope ? `, of ${challengeScope}` : ''}`}
                />
                <figcaption>
                  {/*
                   * The caption says challenges, not just the outcome: the
                   * toolbar below carries an "Off the list" chip counting
                   * entries, and the two figures must not read as one.
                   */}
                  <Label $tone="faint">Challenges off the list</Label>
                  <b>{challengeFigure}</b>
                  {challengeSplit && <Split>{challengeSplit}</Split>}
                </figcaption>
              </RingBlock>
            )}
          </Gauges>
        )}
      </Figures>

      <Footer>
        <ParamsToggle
          type="button"
          aria-expanded={paramsOpen}
          aria-controls="registry-parameters"
          onClick={() => setParamsOpen((open) => !open)}
        >
          <CurateIcon name="layers" size={14} />
          Parameters
          <CurateIcon name="chevron-down" size={14} />
        </ParamsToggle>
        {policyURI && onOpenPolicy && (
          <QuietButton type="button" onClick={onOpenPolicy}>
            <CurateIcon name="policy" size={14} />
            Listing policy
            {policyUpdated && <PolicyUpdatedBadge registryAddress={address} />}
          </QuietButton>
        )}
        {badgesListTo && (
          <QuietLink to={badgesListTo}>
            <CurateIcon name="verified" size={14} />
            Badges list
          </QuietLink>
        )}
        <Explainer
          embedded
          id={explainerId}
          eyebrow="How this list works"
          heading={explainerHeading}
          steps={explainerSteps}
          footer={
            policyURI && onOpenPolicy ? (
              <ButtonAnchor
                as="button"
                type="button"
                $variant="secondary"
                $size="sm"
                onClick={onOpenPolicy}
              >
                Read the listing policy
              </ButtonAnchor>
            ) : undefined
          }
        />
      </Footer>

      <Drawer $open={paramsOpen} id="registry-parameters">
        <div>
          <ParamsGrid aria-label="Parameters">
            {parameters.map((parameter) => (
              <div key={parameter.label}>
                <dt>
                  <Label $tone="faint">{parameter.label}</Label>
                </dt>
                <dd>{parameter.value ?? '—'}</dd>
                {parameter.hint && <dd>{parameter.hint}</dd>}
              </div>
            ))}
          </ParamsGrid>
        </div>
      </Drawer>
    </Shell>
  )
}

export default RegistryHeader
