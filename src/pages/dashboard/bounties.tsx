import React, { useId } from 'react'
import styled from 'styled-components'
import {
  Label,
  SkeletonBlock,
  Small,
  StatusDot,
  VisuallyHidden,
} from 'components/curate/primitives'
import Tooltip from 'components/ui/Tooltip'
import { CurateIcon } from 'components/curate/icons'
import { AnimatedNumber } from 'components/curate/motion/animated-number'
import { RingGauge } from 'components/curate/motion/ring-gauge'
import { reveal } from 'components/curate/motion/reveal'
import { useMediaQuery } from 'pages/guide/hooks'
import { SectionHead, SectionTitle } from './section'
import { formatUsd } from './board-rows'
import type { UpForGrabs } from './open-bounty'
import type { UsdPrice } from './prices'
import { chainInfo, type BountyCoin, type scopedChallengeRecord } from './view'

/*
 * The self-sustaining mechanism: two rings under their title. The money
 * this file also draws (what passed through Curate, the bounties won) sits
 * in the dashboard's hero since 20 Nov 2026 (HeroMoney), beside the
 * headline's "earn".
 *
 * Two rings, two shares of different wholes — every entry ever curated,
 * and the disputes the court has closed on the Standard and Stake lists, all
 * time. They are drawn in the same hues on purpose: two readings of one
 * question, not two categories to tell apart (DESIGN.md keeps --viz-1..4 for
 * categories), so each caption names the whole its share is of.
 *
 *  1. Nobody disputed these entries. Its denominator is every entry ever
 *     curated, in any status, the retired Classic lists' included (round 4:
 *     "when counting the bounties and historically the all time verified
 *     items, the number should be included, only for this"), and its
 *     numerator counts their disputes with them, so both sides are one
 *     population; the live strip in the hero still counts only the lists
 *     Browse can open. `challenged` counts disputed requests, of which one
 *     entry can collect two (its registration and later its removal) — so
 *     the share is a floor on the truth. Where the challenge ledger or the
 *     Classic read is itself a lower bound the biases oppose and no bound
 *     holds, so the ring is not drawn at all rather than drawn as "at most".
 *  2. Of the disputes the court has closed on the Standard and Stake lists,
 *     this share went to the challenger: the reading the owner asked for,
 *     that a challenge here is usually well founded rather than noise. The
 *     Classic disputes are left out of it ("only for this" names the
 *     bounties and the entries), so its count is the Disputes panel's own
 *     ruling count further down the page, and where the scope holds Classic
 *     rulings the sentence and the tooltip name the lists it is taken on.
 *
 * Both percentages are rounded from their two counts, and each ring is
 * handed the rounded figure rather than the raw ratio, so the count-up ends
 * on the number the sentence states and the two can never disagree. Each
 * ring carries a tooltip on hover and focus that says, from the same two
 * counts, why the share is good news for the reader (round 1, item 7, which
 * the round-3 rebuild had dropped); like the sentence, it claims a reading
 * only where the figures bear it out.
 *
 * Then the bounties those challengers took, as one figure in dollars at
 * today's prices (round 16: "simplify and put the total bounties … and
 * mention over several ETH and other tokens on mainnet and gnosis"), the
 * Classic lists' included, with no count of bounties. The line under it
 * names the coins and chains it adds up, and its tooltip gives each coin's
 * amount and dollars. Every price comes from a Chainlink feed on the coin's
 * own chain (prices.ts); where one cannot be read, or a token's decimals
 * never answered, there is no honest total, so the coins' own amounts are
 * listed on one line instead. The figure waits for the first price read
 * (at most a moment, use-usd-prices.ts), so it never paints a coin amount
 * and swaps it for dollars under the reader.
 *
 * No box (round 17: "in a box is cringe"): the section sits on the stage,
 * its title centred over the two rings (round 18); on a phone the rings
 * share one line.
 *
 * Windows are carried by the figures themselves rather than by a chip over
 * the panel (round 3: four "all time" stamps read as boilerplate). The
 * captions and the sentence say what each share measures; entries are every
 * entry ever curated, disputes and bounties are all time and never windowed. A figure reads "n+" when its query stopped at its page
 * cap, and a chain whose ledger did not load is named rather than counted
 * as zero.
 */

type ChallengeRecord = ReturnType<typeof scopedChallengeRecord>

const integer = new Intl.NumberFormat('en-US')
const formatInt = (value: number) => integer.format(value)

/**
 * A share as a whole percent. Rounded, not floored: 579 of 762 is 75.98%,
 * and flooring it would state 75% for a figure whose nearer whole is 76 —
 * a point of understatement is no more honest than a point of flattery.
 *
 * Taken from the two counts rather than from their ratio, because the ratio
 * is not exact in binary. The ring is handed this figure over 100, not the
 * raw ratio, so its own rounding lands on the same number the sentence
 * prints.
 */
const sharePercent = (part: number, whole: number): number =>
  Math.round((Math.min(Math.max(part, 0), whole) * 100) / whole)

/* The section on the stage, no surface (round 17). */
const Stage = styled.div`
  ${reveal}
`

/* The section's heading, centred over its centred row. */
const CentredHead = styled(SectionHead)`
  justify-content: center;
  text-align: center;
`

/*
 * The two rings together, centred (round 18: "not a big fan of separating
 * the gauges"); on a phone they share one line. The money that stood beside
 * them is in the hero now (HeroMoney).
 */
const Row = styled.div`
  display: flex;
  justify-content: center;
  align-items: stretch;
  max-width: 100%;

  @media (max-width: 720px) {
    flex-direction: column;
    align-items: center;
    gap: 28px;
  }
`

const Rings = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px 32px;
  min-width: 0;

  @media (max-width: 720px) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    width: 100%;

    /* The rings' tooltip wrappers centre in their half. */
    > .ui-tooltip-trigger {
      display: flex;
      justify-content: center;
      width: 100%;
      min-width: 0;
    }
  }
`

/* A ring that explains itself on hover and focus: focusable, so it reads on tab. */
const RingTip = styled.span`
  display: flex;
  justify-content: center;
  width: 100%;
  min-width: 0;
  border-radius: 50%;

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 4px;
  }
`

/* A ring's place while the load runs: round, and as wide as the ring. */
const RingSkeleton = styled(SkeletonBlock)`
  max-width: 100%;
  aspect-ratio: 1;
  border-radius: var(--radius-pill);
`

const TotalFigure = styled.span`
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: clamp(36px, 2vw + 20px, 56px);
  line-height: 1;
  font-weight: 500;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
`

/* The coins' own amounts, when there is no honest dollar total. */
const CoinLine = styled.span`
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: 22px;
  line-height: 30px;
  font-weight: 500;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  text-wrap: balance;
`

const Figure = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
`

/** A label or line that carries a tooltip: focusable, so it reads on tab. */
const TipTarget = styled.span`
  display: inline-flex;
  align-items: center;
  /* A tap target of at least 24px (WCAG 2.5.8), not the label's 16px. */
  min-height: 24px;

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 3px;
    border-radius: 4px;
  }
`

/* Balanced lines: a two-line tip never leaves one word on its own line. */
const TipText = styled.span`
  display: block;
  text-wrap: balance;
`

/* A label on one line, its help icon beside it. */
const LabelRow = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;

  svg {
    color: var(--color-faint);
  }
`

/**
 * An amount's label with a help icon whose tooltip says what the amount
 * counts (round 19: no subtitle under the figures). Without help text, the
 * label alone. `live` leads it with the blue window LED: the one figure that
 * is now, not all time.
 */
const LabelHelp = ({
  help,
  live,
  children,
}: {
  help: string
  live?: boolean
  children: string
}) => {
  const dot = live && <StatusDot $tone="window" aria-hidden />
  return help ? (
    <Tooltip quiet title={help}>
      <TipTarget tabIndex={0} aria-label={`${children}: ${help}`}>
        <LabelRow>
          {dot}
          <Label $tone="faint">{children}</Label>
          <CurateIcon name="help" size={13} />
        </LabelRow>
      </TipTarget>
    </Tooltip>
  ) : (
    <LabelRow>
      {dot}
      <Label $tone="faint">{children}</Label>
    </LabelRow>
  )
}

/** "Ethereum and Gnosis" */
const chainNames = (chains: number[]) =>
  chains
    .map((chainId) => chainInfo(chainId)?.name ?? `Chain ${chainId}`)
    .join(' and ')

const shortToken = (token: string) => `${token.slice(0, 6)}…${token.slice(-4)}`

/**
 * The coin's symbol, when the token answered with one. A token that only
 * answered its decimals is named by its contract in the tooltip instead:
 * the figure never carries an address as if it were a name.
 */
const coinSymbol = (coin: BountyCoin): string =>
  coin.token && coin.symbol === shortToken(coin.token) ? '' : coin.symbol

/** True while the tile can lead with an amount: decimals read, and something paid. */
const amountKnown = (coin: BountyCoin) =>
  coin.decimals !== undefined && coin.paid > 0

/** Several names in a sentence: "ETH, xDAI and sDAI". */
const list = new Intl.ListFormat('en-GB', { type: 'conjunction' })

/**
 * The bounties in dollars at today's prices, and each coin's part, or
 * undefined when there is no honest total: a coin whose decimals never
 * answered, or one with no current price.
 */
const bountyTotal = (
  coins: BountyCoin[],
  prices?: Record<string, UsdPrice>,
) => {
  if (coins.some((coin) => coin.decimals === undefined)) return undefined
  const paid = coins.filter(amountKnown)
  if (paid.length === 0) return undefined
  const parts = paid.map((coin) => {
    const usd = prices?.[coin.key]?.usd
    return {
      coin,
      dollars:
        usd !== undefined && coin.value !== undefined
          ? coin.value * usd
          : undefined,
    }
  })
  if (parts.some((part) => part.dollars === undefined)) return undefined
  return {
    dollars: parts.reduce((sum, part) => sum + (part.dollars ?? 0), 0),
    parts,
  }
}

/**
 * "In ETH, xDAI and other ERC-20 tokens on Ethereum and Gnosis." (round 19):
 * the chains' own coins by name, a Stake list's token as what it is.
 */
const paidIn = (coins: BountyCoin[]) => {
  const names = [
    ...new Set(
      coins
        .filter((coin) => !coin.stake)
        .map((coin) => coinSymbol(coin) || "the chain's coin"),
    ),
  ]
  if (coins.some((coin) => coin.stake))
    names.push(names.length > 0 ? 'other ERC-20 tokens' : 'ERC-20 tokens')
  const chains = [...new Set(coins.map((coin) => coin.chainId))]
  return `In ${list.format(names)} on ${chainNames(chains)}.`
}

/** "$73.3K" */
const compactUsd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumSignificantDigits: 3,
})

/**
 * Why the first ring is good news for the reader, from the two counts it is
 * drawn from: every entry was open to a paid check, and most never needed
 * one.
 */
const neverTip = (never: number, entries: number): string =>
  `Anyone could have challenged these ${formatInt(entries)} entries and taken a bounty for proving one wrong. For ${never}% of them, nobody did: every Curate list stays open to that check.`

/**
 * The lists the court's share is taken on, named only where the scope holds
 * retired Classic rulings it leaves out: elsewhere the two are the same and
 * the words would only lengthen the line.
 */
const onListed = (record: ChallengeRecord): string =>
  record.rulings > record.listedRulings
    ? ' on the Standard and Stake lists'
    : ''

/**
 * Disputes a reading of the court's share needs under it. Five of eight is a
 * figure, not a finding: below this the ring and the sentence state the
 * counts and claim nothing about them (Ethereum, once Classic left the
 * share, rests on 8).
 */
const READING_SAMPLE = 30

/** More than half of enough disputes went to the challenger. */
const challengersRight = (record: ChallengeRecord): boolean =>
  record.listedRulings >= READING_SAMPLE &&
  record.listedWon * 2 > record.listedRulings

/**
 * Why the second ring is good news, claimed only where the figures bear it
 * out (the sentence's "well founded" rule): more than half of at least
 * READING_SAMPLE closed disputes went to the challenger. Otherwise it says
 * what a ruling does, and no more. The same counts as the ring and the
 * sentence.
 */
const wonTip = (record: ChallengeRecord, plus: string): string =>
  challengersRight(record)
    ? `When someone does challenge, they are usually right: jurors sided with the challenger in ${formatInt(record.listedWon)}${plus} of ${formatInt(record.listedRulings)}${plus} disputes${onListed(record)}. A challenge here is a finding, not noise, and finding one pays the bounty.`
    : 'Jurors settle each dispute on its own evidence. A ruling for the challenger pays them the bounty; one for the requester leaves the entry as it stands.'

/*
 * The money, in dollars at today's prices: what has passed through Curate
 * and the bounties challengers won (the paragraphs above say how each is
 * read). Fortunato moved it into the dashboard's hero, beside the headline
 * whose "earn" it backs; the rings stay in the Self-sustaining mechanism.
 * One figure under another, behind a hairline; side by side once the hero
 * stacks at 820px (index.tsx: Hero).
 *
 * Since 26 Nov 2026 a third can follow (open-bounty.ts): what is up for
 * grabs now, while it is $2,000 or more. With three the gaps close from 24px
 * to 18px, so the stack (about 323px at 1440) still fits beside the
 * headline's 331px and the hero keeps its height. At 820px and under the
 * third is a row of its own across both columns, its label on the left and
 * its figure on the right, behind a hairline, so the two totals stay level.
 */
const MoneyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;

  /* A hairline between the figures, as between the rings and them. */
  > [data-money] + [data-money] {
    padding-top: 24px;
    border-top: 1px solid var(--glass-border);
  }

  @media (min-width: 821px) {
    &[data-three] {
      gap: 18px;
    }

    &[data-three] > [data-money] + [data-money] {
      padding-top: 18px;
    }
  }

  @media (max-width: 820px) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    /* "Passed through Curate" takes two lines on most phones, "Bounties
       won" one: the figures line up, not the labels. */
    align-items: end;
    gap: 16px 24px;

    > [data-money] + [data-money] {
      padding-top: 0;
      border-top: 0;
    }

    /* The note about a chain that did not load spans both columns. */
    > p {
      grid-column: 1 / -1;
    }

    /* What is up for grabs: a row across both, under its hairline. */
    > [data-money][data-grabs] {
      grid-column: 1 / -1;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-top: 14px;
      border-top: 1px solid var(--glass-border);
    }

    /* Two labels side by side on a phone: "Passed through Curate" wraps
       rather than running into "Bounties won". */
    ${LabelRow} {
      white-space: normal;
    }
  }
`

/*
 * What is up for grabs leads down to the requests it stands for: the figure
 * is a link to the Open for verification section, its arrow faint until
 * hovered or focused, when it takes the accent.
 */
const GrabsLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: inherit;
  text-decoration: none;

  > svg {
    flex: 0 0 auto;
    color: var(--color-faint);
    transition:
      color var(--motion),
      translate var(--motion);
  }

  &:hover > svg,
  &:focus-visible > svg {
    color: var(--color-primary);
    translate: 2px 0;
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 4px;
    border-radius: 6px;
  }

  @media (prefers-reduced-motion: reduce) {
    > svg {
      transition: none;
    }

    &:hover > svg,
    &:focus-visible > svg {
      translate: none;
    }
  }
`

/* One amount: its label, then the dollars; left-aligned, as the hero is. */
const MoneyTotal = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
`

export const HeroMoney = ({
  record,
  prices,
  pricesSettled,
  transit,
  transitFailed,
  grabs,
  grabsHref,
}: {
  /** Undefined while the load is still running. */
  record?: ChallengeRecord
  /**
   * Dollars per whole coin, keyed by `BountyCoin.key` (use-usd-prices.ts). A
   * coin missing from it, and every coin once the prices never arrive, leads
   * with its amount. A price that has passed its feed's heartbeat leaves
   * that map, so the dollars go rather than age.
   */
  prices?: Record<string, UsdPrice>
  /** False while the first price read is held for: the figures stay skeletons. */
  pricesSettled: boolean
  /** What has passed through Curate, in dollars (transit.ts). Undefined while it reads. */
  transit?: number
  /** The read failed: the figure is not drawn, never "$—". */
  transitFailed: boolean
  /**
   * The third figure, what is up for grabs now (open-bounty.ts decides):
   * its dollars when drawn, and whether to hold its place while the hero
   * loads.
   */
  grabs: UpForGrabs
  /** Where the figure leads: the Open for verification section. */
  grabsHref: string
}) => {
  const plus = record?.capped ? '+' : ''
  const missing =
    record && record.missing.length > 0 ? chainNames(record.missing) : undefined
  const unknown = !!record && record.rulings === 0 && !!missing

  const coins = record && !unknown ? record.coins : []
  const total = pricesSettled ? bountyTotal(coins, prices) : undefined

  // The bounties: a skeleton while the load or the first price read runs,
  // then the dollars, or the coins' own amounts where no total is honest.
  const bounties = !record ? (
    <SkeletonBlock $height="56px" $width="200px" />
  ) : coins.length === 0 ? (
    <Small $muted as="p" style={{ margin: 0 }}>
      {record.rulings
        ? record.rulings === 1 && !plus
          ? 'No bounty yet: the one ruling did not go to a challenger.'
          : `No bounty yet: none of the ${formatInt(record.rulings)}${plus} rulings went to a challenger.`
        : 'No dispute has been ruled on yet.'}
    </Small>
  ) : !pricesSettled ? (
    <SkeletonBlock $height="56px" $width="200px" />
  ) : total ? (
    <TotalFigure
      aria-label={`${formatUsd(total.dollars)}${plus ? ' or more' : ''} in bounties`}
    >
      <AnimatedNumber
        value={total.dollars}
        format={(value) => compactUsd.format(value)}
      />
      {plus}
    </TotalFigure>
  ) : (
    <CoinLine>
      {coins
        .map((coin) =>
          amountKnown(coin) && coin.display
            ? `${coin.display}${plus}`
            : `${formatInt(coin.won)}${plus} in a token that did not answer`,
        )
        .join(' · ')}
    </CoinLine>
  )

  // What each amount counts, one short line in a quiet tooltip beside its
  // label (round 19: "a tooltip next to … so there is no subtitle", "make
  // it light and the text really minimal").
  const bountiesHelp =
    record && coins.length > 0 ? paidIn(coins.filter(amountKnown)) : ''
  const transitHelp = 'Deposits, challenges and appeals, all time.'
  const grabsHelp = 'Deposits on requests anyone can challenge now.'

  /*
   * What is up for grabs now, under the bounties won. While the bounties
   * still load, or the load they were drawn from is an earlier visit's whose
   * refresh is still coming, a figure that is likely to open holds its place
   * as a skeleton, so it moves nothing when it comes (open-bounty.ts:
   * expected, refreshing).
   */
  const loading = !record || !pricesSettled
  const grabsShown = grabs.usd !== undefined
  const grabsHeld =
    !grabsShown && (loading || grabs.refreshing) && grabs.expected

  return (
    <MoneyStack data-three={grabsShown || grabsHeld ? '' : undefined}>
      {!transitFailed && (
        <MoneyTotal data-money="">
          <LabelHelp help={transitHelp}>Passed through Curate</LabelHelp>
          {transit === undefined ? (
            <SkeletonBlock $height="56px" $width="200px" />
          ) : (
            <TotalFigure
              aria-label={`${formatUsd(transit)} passed through Curate`}
            >
              <AnimatedNumber
                value={transit}
                format={(value) => compactUsd.format(value)}
              />
            </TotalFigure>
          )}
        </MoneyTotal>
      )}
      {!unknown && (
        <MoneyTotal data-money="">
          <LabelHelp help={bountiesHelp}>Bounties won</LabelHelp>
          {bounties}
        </MoneyTotal>
      )}
      {grabsShown && grabs.usd !== undefined && (
        <MoneyTotal data-money="" data-grabs="">
          <LabelHelp help={grabsHelp} live>
            Up for grabs now
          </LabelHelp>
          <GrabsLink href={grabsHref}>
            <TotalFigure>
              <AnimatedNumber
                value={grabs.usd}
                format={(value) => compactUsd.format(value)}
              />
            </TotalFigure>
            <VisuallyHidden>
              {' '}
              up for grabs now: see the requests open to challenge
            </VisuallyHidden>
            <CurateIcon name="submit" size={16} />
          </GrabsLink>
        </MoneyTotal>
      )}
      {grabsHeld && (
        <MoneyTotal data-money="" data-grabs="" aria-hidden>
          <SkeletonBlock $height="16px" $width="130px" />
          <SkeletonBlock $height="56px" $width="160px" />
        </MoneyTotal>
      )}
      {/* Round 19: only a chain whose rulings did not load is named. */}
      {record && missing && (
        <Small $faint as="p" style={{ margin: 0 }}>
          {`The rulings on ${missing} did not load: ${record.missing.length > 1 ? 'their' : 'its'} bounties are not counted here.`}
        </Small>
      )}
    </MoneyStack>
  )
}

/**
 * The self-sustaining mechanism: how much of everything they have ever held
 * nobody disputed, and how the court ruled when somebody did. The section
 * heads itself and owns its loading state, so the heading never pops in.
 */
export const VerificationRecord = ({
  record,
  entries,
}: {
  /** Undefined while the load is still running. */
  record?: ChallengeRecord
  /**
   * Every entry ever curated, the retired Classic lists' included (view.ts:
   * scopedFigures.entriesAllTime) — the all-time figure,
   * not the hero's live one. Undefined when a chain's lists are missing, or
   * when the Classic read capped: then the share built on it is left out
   * rather than drawn short.
   */
  entries?: number
}) => {
  const titleId = useId()
  /*
   * Side by side on a phone each ring has about 130 to 150px. It scales down
   * to fit on its own, but its figure and caption are sized from `size`, so
   * it is drawn at a phone's size there: the caption's last line then clears
   * the arc even at 360px.
   */
  const phone = useMediaQuery('(max-width: 520px)')
  const ringSize = phone ? 140 : 168

  const plus = record?.capped ? '+' : ''
  const missing =
    record && record.missing.length > 0 ? chainNames(record.missing) : undefined
  // A chain whose ledger did not load: the ring covers the others, by name.
  const partial = !!missing && !!record && record.loaded.length > 0
  const where = partial && record ? ` on ${chainNames(record.loaded)}` : ''
  const unknown = !!record && record.rulings === 0 && !!missing

  /*
   * The share nobody has ever disputed, against every entry these lists have
   * ever held (the retired Classic ones included: see the `entries` prop).
   * Left out entirely when the entries are unknown or the challenge count is
   * itself a lower bound: a capped ledger understates the challenges, which
   * overstates this share, and no honest bound survives that.
   */
  const never =
    record && entries !== undefined && entries > 0 && !record.challengedPartial
      ? sharePercent(entries - Math.min(entries, record.challenged), entries)
      : undefined
  // The court's share, on the Standard and Stake lists alone (view.ts:
  // listedRulings): the Disputes panel's own count, Classic left out.
  const wonShare =
    record && record.listedRulings > 0
      ? sharePercent(record.listedWon, record.listedRulings)
      : undefined
  const ringKey = record ? `${record.loaded.join('-')}-${record.rulings}` : ''
  const ring = (key: 'never' | 'won') =>
    !record ? (
      <RingSkeleton $height="0px" $width={`${ringSize}px`} />
    ) : key === 'never' ? (
      never !== undefined && entries !== undefined ? (
        <Tooltip title={<TipText>{neverTip(never, entries)}</TipText>}>
          <RingTip tabIndex={0}>
            <RingGauge
              key={`never-${ringKey}-${entries}`}
              size={ringSize}
              ratio={never / 100}
              from="var(--edge-3)"
              to="var(--edge-2)"
              caption="of entries never disputed"
              label={`Nobody has disputed ${never}% of the ${formatInt(entries)} entries ever curated, against ${formatInt(record.challenged)} requests anyone has disputed, all time.`}
            />
          </RingTip>
        </Tooltip>
      ) : null
    ) : wonShare !== undefined ? (
      <Tooltip title={<TipText>{wonTip(record, plus)}</TipText>}>
        <RingTip tabIndex={0}>
          <RingGauge
            key={`won-${ringKey}`}
            size={ringSize}
            ratio={wonShare / 100}
            from="var(--edge-3)"
            to="var(--edge-2)"
            caption="of disputes went to the challenger"
            label={`The court sided with the challenger in ${formatInt(record.listedWon)}${plus} of ${formatInt(record.listedRulings)}${plus} rulings${onListed(record)}${where}, all time.`}
          />
        </RingTip>
      </Tooltip>
    ) : (
      <Figure>
        <Label $tone="faint">Disputes the court has closed</Label>
        <Small $muted>
          {unknown ? 'The rulings did not load' : 'None yet'}
        </Small>
      </Figure>
    )
  const left = ring('never')

  return (
    <section aria-labelledby={titleId}>
      <CentredHead>
        <SectionTitle id={titleId}>Self-sustaining mechanism</SectionTitle>
      </CentredHead>

      {/* Second section on the page, straight after the chart (--i: 4). */}
      <Stage style={{ ['--i' as string]: 5 }}>
        <Row>
          <Rings>
            {left}
            {ring('won')}
          </Rings>
        </Row>
      </Stage>
    </section>
  )
}
