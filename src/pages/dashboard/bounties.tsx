import React, { useId } from 'react'
import styled from 'styled-components'
import { Label, SkeletonBlock, Small } from 'components/curate/primitives'
import Tooltip from 'components/ui/Tooltip'
import { AnimatedNumber } from 'components/curate/motion/animated-number'
import { RingGauge } from 'components/curate/motion/ring-gauge'
import { reveal } from 'components/curate/motion/reveal'
import { useMediaQuery } from 'pages/guide/hooks'
import { SectionHead, SectionTitle } from './section'
import { formatUsd } from './board-rows'
import type { UsdPrice } from './prices'
import { chainInfo, type BountyCoin, type scopedChallengeRecord } from './view'

/*
 * The self-sustaining mechanism (round 3): one wide card, back to the
 * proportions of the version before it — the rings on the left at full
 * size, the money to their right, and the panel's one sentence under the
 * money (round 5: across the whole foot it ran to 193 characters on one
 * line; under the tiles it keeps a reading measure).
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
 * No box (round 17: "in a box is cringe"): like the Open for verification
 * band, the section sits on the stage, its title centred, and its row is
 * symmetric: a ring, the bounties, a ring, parted by hairlines, the
 * sentence centred under them. On a phone the bounties lead and the two
 * rings share the line under them.
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
 * Where the rings are drawn smaller beside the money (DESIGN.md: three coins
 * on one line). Between the one-column width and 1100px the column beside
 * two full-size rings is too narrow for three tiles, which broke 2 + 1 and
 * left the third tile alone beside an empty cell; at 140px (a phone's size)
 * the three fit on one line from 901px.
 */
const COMPACT_RINGS = '(min-width: 901px) and (max-width: 1099px)'

/*
 * A ring, the bounties, a ring: one centred row, each cell parted from the
 * next by a hairline as the Open for verification figures are. On a phone
 * the bounties take the first line and the rings share the second, each
 * half the width.
 */
const Row = styled.div`
  display: flex;
  justify-content: center;
  align-items: stretch;
  max-width: 100%;

  @media (max-width: 720px) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-areas:
      'money money'
      'left right';
    row-gap: 28px;
  }
`

const Cell = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 0 clamp(28px, 4vw, 72px);

  & + & {
    border-left: 1px solid var(--glass-border);
  }

  @media ${COMPACT_RINGS} {
    padding: 0 24px;
  }

  @media (max-width: 720px) {
    padding: 0 8px;

    &[data-cell='left'] {
      grid-area: left;
      border-left: 0;
    }

    &[data-cell='money'] {
      grid-area: money;
      border-left: 0;
    }

    &[data-cell='right'] {
      grid-area: right;
    }
  }

  /* The rings' tooltip wrappers centre in their cell. */
  > .ui-tooltip-trigger {
    display: flex;
    justify-content: center;
    width: 100%;
    min-width: 0;
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

/* The bounties: the label, the dollars, and the coins they add up. */
const Total = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  min-width: 0;
  max-width: 100%;
  text-align: center;

  > * {
    text-wrap: balance;
  }
`

const TotalFigure = styled.span`
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: clamp(44px, 2.4vw + 22px, 64px);
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

/* The panel's sentence and its notes, centred under the row at a reading
   measure. */
const Words = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  max-width: 68ch;
  min-width: 0;
  margin: 28px auto 0;
  text-align: center;

  > p {
    margin: 0;
    text-wrap: balance;
  }
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

/** "In ETH, xDAI and sDAI on Ethereum and Gnosis" */
const paidIn = (coins: BountyCoin[]) => {
  const symbols = [
    ...new Set(coins.map((coin) => coinSymbol(coin) || 'a list token')),
  ]
  const chains = [...new Set(coins.map((coin) => coin.chainId))]
  return `In ${list.format(symbols)} on ${chainNames(chains)}`
}

/** "$73.3K" */
const compactUsd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumSignificantDigits: 3,
})

/** What a bounty is, and over what window: the figures' own explanation. */
const bountiesTip = (record: ChallengeRecord, plus: string): string =>
  record.winners > 0
    ? `Every bounty challengers have taken, all time: paid to ${formatInt(record.winners)}${plus} ${record.winners === 1 ? 'challenger' : 'different challengers'}, each on top of their own deposit back.`
    : "What a challenger takes when the court rules for them, all time: the requester's base deposit (Standard) or the entry's stake (Stake), on top of their own deposit back."

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

/**
 * The panel's one sentence (DESIGN.md: one sentence under a title at most),
 * built from the same figures as the rings, so the words and the drawings
 * cannot disagree. It names the sample the court's share rests on, and the
 * reading after the colon is printed only where the figures bear it out:
 * "rare" needs the entries to outnumber the disputes twice over, "well
 * founded" needs more than half of at least READING_SAMPLE closed disputes
 * to have gone to the challenger. Below that sample the sentence ends at the
 * figures.
 */
const heldUpSentence = (
  record: ChallengeRecord,
  entries: number | undefined,
  /** The two shares the rings draw, or undefined where one is not drawn. */
  never: number | undefined,
  won: number | undefined,
  plus: string,
): string | undefined => {
  // A ledger that did not load says nothing here: the line under the panel
  // names the chain instead.
  if (record.rulings === 0 && record.missing.length > 0) return undefined
  const held =
    never !== undefined && entries !== undefined
      ? `Nobody has disputed ${never}% of the ${formatInt(entries)} entries ever curated`
      : undefined
  if (won === undefined) {
    const none = `no dispute${onListed(record)} has been ruled on yet`
    return held
      ? `${held}, and ${none}.`
      : `${none.charAt(0).toUpperCase()}${none.slice(1)}.`
  }
  const share = `${won}% of the ${formatInt(record.listedRulings)}${plus} disputes${onListed(record)} went to the challenger`
  // The reading, in the owner's words (round 9), only where the rulings
  // bear it out (challengersRight).
  const reading = challengersRight(record)
    ? ': when challenges happen, they are often right'
    : ''
  return held
    ? `${held}, and ${share}${reading}.`
    : `${share.charAt(0).toUpperCase()}${share.slice(1)}${reading}.`
}

/**
 * The self-sustaining mechanism: how much of everything they have ever held
 * nobody disputed, how the court ruled when somebody did, and what the
 * challengers took. The section heads itself and owns its loading state, so
 * the heading never pops in.
 */
export const VerificationRecord = ({
  record,
  entries,
  prices,
  pricesSettled,
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
  /**
   * Dollars per whole coin, keyed by `BountyCoin.key` (use-usd-prices.ts). A
   * coin missing from it, and every coin once the prices never arrive, leads
   * with its amount. A price that has passed its feed's heartbeat leaves
   * that map, so the dollars go rather than age.
   */
  prices?: Record<string, UsdPrice>
  /** False while the first price read is held for: the tiles stay skeletons. */
  pricesSettled: boolean
}) => {
  const titleId = useId()
  /*
   * Side by side on a phone each ring has about 130 to 150px. It scales down
   * to fit on its own, but its figure and caption are sized from `size`, so
   * it is drawn at a phone's size there: the caption's last line then clears
   * the arc even at 360px. Between 901 and 1099px it takes the same size, so
   * the three coins beside it fit on one line (COMPACT_RINGS).
   */
  const phone = useMediaQuery('(max-width: 520px)')
  const compact = useMediaQuery(COMPACT_RINGS)
  const ringSize = phone || compact ? 140 : 168

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
  const sentence = record
    ? heldUpSentence(record, entries, never, wonShare, plus)
    : undefined
  const ringKey = record ? `${record.loaded.join('-')}-${record.rulings}` : ''
  const coins = record && !unknown ? record.coins : []
  const total = pricesSettled ? bountyTotal(coins, prices) : undefined
  const words =
    record && (sentence || missing) ? (
      <Words data-words="">
        {sentence && (
          <Small $muted as="p">
            {sentence}
          </Small>
        )}
        {missing && (
          <Small $faint as="p">
            {`The rulings on ${missing} did not load: ${record.missing.length > 1 ? 'their' : 'its'} bounties are not counted here.`}
          </Small>
        )}
      </Words>
    ) : null

  // The bounties: a skeleton while the load or the first price read runs,
  // then the dollars, or the coins' own amounts where no total is honest.
  const bounties = !record ? (
    <SkeletonBlock $height="64px" $width="220px" />
  ) : unknown ? null : coins.length === 0 ? (
    <Small $muted as="p" style={{ margin: 0 }}>
      {record.rulings
        ? record.rulings === 1 && !plus
          ? 'No bounty yet: the one ruling did not go to a challenger.'
          : `No bounty yet: none of the ${formatInt(record.rulings)}${plus} rulings went to a challenger.`
        : 'No dispute has been ruled on yet.'}
    </Small>
  ) : !pricesSettled ? (
    <SkeletonBlock $height="64px" $width="220px" />
  ) : total ? (
    <>
      <Tooltip
        title={
          <TipText>
            {`${total.parts
              .map(
                ({ coin, dollars }) =>
                  `${coin.display}${plus} (${formatUsd(dollars ?? 0)})`,
              )
              .join(
                ', ',
              )}, each at today's price from its chain's Chainlink feed.`}
          </TipText>
        }
      >
        <TipTarget tabIndex={0}>
          <TotalFigure
            aria-label={`${formatUsd(total.dollars)}${plus ? ' or more' : ''} in bounties`}
          >
            <AnimatedNumber
              value={total.dollars}
              format={(value) => compactUsd.format(value)}
            />
            {plus}
          </TotalFigure>
        </TipTarget>
      </Tooltip>
      <Small $muted>
        {paidIn(coins.filter(amountKnown))}, at today’s prices
      </Small>
    </>
  ) : (
    <>
      <CoinLine>
        {coins
          .map((coin) =>
            amountKnown(coin) && coin.display
              ? `${coin.display}${plus}`
              : `${formatInt(coin.won)}${plus} in a token that did not answer`,
          )
          .join(' · ')}
      </CoinLine>
      <Small $muted>{paidIn(coins)}</Small>
    </>
  )

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
          {left && <Cell data-cell="left">{left}</Cell>}
          {!unknown && (
            <Cell data-cell="money">
              <Total>
                {record ? (
                  <Tooltip
                    title={<TipText>{bountiesTip(record, plus)}</TipText>}
                  >
                    <TipTarget tabIndex={0}>
                      <Label $tone="faint">Bounties won</Label>
                    </TipTarget>
                  </Tooltip>
                ) : (
                  <Label $tone="faint">Bounties won</Label>
                )}
                {bounties}
              </Total>
            </Cell>
          )}
          <Cell data-cell="right">{ring('won')}</Cell>
        </Row>
        {words}
      </Stage>
    </section>
  )
}
