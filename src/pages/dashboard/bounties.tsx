import React, { useId } from 'react'
import styled, { css } from 'styled-components'
import ChainLogo from 'components/chain-logo'
import {
  Label,
  SkeletonBlock,
  Small,
  Surface,
} from 'components/curate/primitives'
import Tooltip from 'components/ui/Tooltip'
import { AnimatedNumber } from 'components/curate/motion/animated-number'
import { RingGauge } from 'components/curate/motion/ring-gauge'
import { reveal } from 'components/curate/motion/reveal'
import { useMediaQuery } from 'pages/guide/hooks'
import { SectionHead, SectionTitle } from './section'
import { CoinAmount, formatUsd, usdFormatFor, UsdLead } from './board-rows'
import { priceSource, type UsdPrice } from './prices'
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
 * Then the bounties those challengers took, one figure per coin, never
 * added across coins, the Classic lists' included — a Stake list pays in an ERC-20 of its own choosing,
 * which can differ list to list, so a Stake tile says so in a line of its
 * own ("Any ERC-20, set per list", the owner's words) and its tooltip names
 * the contract the token was read from. The count under an amount is how
 * many bounties that amount is the sum of, so the two answer the same
 * question; a ruling that went to the challenger and paid nothing (a list
 * that asked no base deposit, an entry that carried no stake) is named in
 * the tooltip rather than padding the count. A token whose decimals never
 * answered leaves the tile its count and says why there is no amount,
 * instead of an em dash where a figure should be.
 *
 * Dollars lead each amount where they can be read from a Chainlink feed on
 * the coin's own chain (prices.ts), with the exact coin amount under them,
 * and the tooltip names the feed and how old its answer is: these tiles and
 * the collateral in the strip below are the only two figures on the site
 * that carry dollars, there is no dollar total across coins, and a coin
 * whose price cannot be read leads with its amount, which is what every tile
 * showed before. The tiles wait for the first price read (at most a moment,
 * use-usd-prices.ts), so a tile never paints its coin large and then swaps
 * it for dollars under the reader.
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
const amountFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 4,
})

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

const Panel = styled(Surface)`
  ${reveal}
`

/*
 * Where the rings are drawn smaller beside the money (DESIGN.md: three coins
 * on one line). Between the one-column width and 1100px the column beside
 * two full-size rings is too narrow for three tiles, which broke 2 + 1 and
 * left the third tile alone beside an empty cell; at 140px (a phone's size)
 * the three fit on one line from 901px.
 */
const COMPACT_RINGS = '(min-width: 901px) and (max-width: 1099px)'

/* The rings and the money, side by side; stacked once that is too narrow. */
const Body = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 24px 32px;

  @media ${COMPACT_RINGS} {
    column-gap: 24px;
  }

  @media (max-width: 900px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

/*
 * Two rings at full size, side by side. Once the money goes under them (900px
 * and below) each takes half the width and is centred in it (on a phone the
 * ring scales down to fit), rather than sitting left-aligned with the rest of
 * the row empty beside them. The tooltip wrapper is the item there, so it is
 * what centres.
 */
const Gauges = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 24px 32px;

  @media ${COMPACT_RINGS} {
    gap: 16px 20px;
  }

  @media (max-width: 900px) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    justify-items: center;
    gap: 16px;

    > .ui-tooltip-trigger {
      display: flex;
      justify-content: center;
      width: 100%;
      min-width: 0;
    }
  }

  /* The narrowest phones: the rings take the gap's room, so each keeps the
     width its caption is set for. */
  @media (max-width: 380px) {
    gap: 4px;
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

/*
 * Where one or two tiles leave room for the words beside them: the widths at
 * which the money column is wide enough for that many tiles (about 175px
 * each) and a 280px measure of words. One tile fits from 1080px, and in the
 * one-column layout between 721 and 900px; two only from 1280px.
 */
const BESIDE_ONE =
  '(min-width: 1080px), (min-width: 721px) and (max-width: 900px)'
const BESIDE_TWO = '(min-width: 1280px)'

/*
 * The money column: its label, the tiles, and the panel's words under them,
 * at a reading measure. With one or two coins the tiles leave most of the
 * column's width, so the words move up beside them instead of under them
 * (round 5: a lone tile stretched across the whole column left it ~70%
 * empty), and each tile takes only the width it needs. The tiles carry
 * their own hairlines: no panel in a panel.
 */
const Money = styled.div<{ $beside?: number }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: 12px 40px;
  min-width: 0;

  /* A tooltip opens over its own label, not over the middle of the column. */
  > .ui-tooltip-trigger {
    justify-self: start;
  }

  ${({ $beside }) =>
    !!$beside &&
    css`
      @media ${$beside === 1 ? BESIDE_ONE : BESIDE_TWO} {
        grid-template-columns: max-content minmax(0, 1fr);

        > :first-child {
          grid-column: 1 / -1;
        }

        > ul {
          grid-template-columns: repeat(${$beside}, minmax(150px, max-content));
        }

        > [data-words] {
          grid-column: 2;
          grid-row: 2;
          padding-left: 14px;
          border-left: 1px solid var(--glass-border);
        }
      }
    `}
`

/* The panel's sentence and its notes: one reading measure, never a full row. */
const Words = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 68ch;
  min-width: 0;

  > p {
    margin: 0;
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

/*
 * Phones: one coin per row, two-sided as on the base branch — the lead and
 * the coin amount under it on the left, the chain and the count on the
 * right — with hairlines between coins. A Stake note or a reason takes the
 * row's full width under them.
 */
const phoneCoins = css`
  @media (max-width: 520px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;

    > li {
      grid-row: auto;
      grid-template-rows: none;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: baseline;
      gap: 2px 12px;
      padding: 10px 0;
      border-left: 0;
      border-top: 1px solid var(--glass-border);

      > [data-slot='lead'] {
        grid-area: 1 / 1;
        margin-bottom: 0;
      }

      > [data-slot='amount'] {
        grid-area: 2 / 1;
      }

      > [data-slot='meta'] {
        grid-area: 1 / 2;
        justify-self: end;
      }

      > [data-slot='count'] {
        grid-area: 2 / 2;
        justify-self: end;
      }

      > [data-slot='note'] {
        grid-area: 3 / 1 / auto / -1;
      }
    }
  }
`

/*
 * The tiles. Two or three coins take one equal column each across the money
 * column (round 5: auto-fill left an empty fourth track beside three tiles
 * at 1440, about 200px of blank panel, and broke them 2 + 1 at 1024 with the
 * third alone beside an empty cell). A lone coin keeps auto-fill, so it holds
 * a tile's width instead of stretching across the column; four or more
 * auto-fit, as many to a line as hold a tile. Money sets exactly one column
 * per coin where the words sit beside one or two tiles.
 */
const Coins = styled.ul<{ $count: number }>`
  display: grid;
  grid-template-columns: ${({ $count }) =>
    $count === 1
      ? 'repeat(auto-fill, minmax(172px, 1fr))'
      : $count <= 3
        ? `repeat(${$count}, minmax(0, 1fr))`
        : 'repeat(auto-fit, minmax(172px, 1fr))'};
  column-gap: 24px;
  row-gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
  ${phoneCoins}
`

/*
 * One coin. A subgrid of the tiles' five rows — lead, coin amount, chain,
 * count, note — so a priced tile and an unpriced one beside it keep their
 * lines level: a line a tile does not have leaves its row empty rather than
 * pulling the next line up. Each line is placed by its slot for the same
 * reason. Without subgrid the tiles only top-align, and nothing breaks.
 */
const Coin = styled.li`
  display: grid;
  grid-row: span 5;
  grid-template-rows: subgrid;
  align-content: start;
  min-width: 0;
  padding: 0 0 10px 14px;
  border-left: 1px solid var(--glass-border);
  ${reveal}

  > [data-slot='lead'] {
    grid-row: 1;
    margin-bottom: 4px;
  }

  > [data-slot='amount'] {
    grid-row: 2;
  }

  > [data-slot='meta'] {
    grid-row: 3;
  }

  > [data-slot='count'] {
    grid-row: 4;
  }

  > [data-slot='note'] {
    grid-row: 5;
  }
`

/*
 * A coin's lead: the dollars where a price was read, the amount where not.
 * Keyed by which it is, so a price that answers after the hold fades in as a
 * new figure instead of the digits jumping from coin to dollars.
 */
const Lead = styled.span`
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0 6px;
  min-width: 0;
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: clamp(22px, 0.8vw + 14px, 28px);
  line-height: 1.1;
  font-weight: 500;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  ${reveal}

  small {
    color: var(--color-muted);
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 0;
  }
`

const Slot = styled.span`
  display: block;
  min-width: 0;
`

const CoinMeta = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  white-space: nowrap;

  > span {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`

const WonCount = styled.span`
  color: var(--color-faint);
  font-family: var(--font-figure);
  font-size: 12px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
`

/* The note row: a Stake tile's token line, or why a tile has no amount. */
const Note = styled.span`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

/** "Ethereum and Gnosis" */
const chainNames = (chains: number[]) =>
  chains
    .map((chainId) => chainInfo(chainId)?.name ?? `Chain ${chainId}`)
    .join(' and ')

const shortToken = (token: string) => `${token.slice(0, 6)}…${token.slice(-4)}`

const coinPlace = (coin: BountyCoin) => {
  const chain = chainInfo(coin.chainId)?.name ?? `Chain ${coin.chainId}`
  return coin.stake ? `Stake · ${chain}` : chain
}

/**
 * The coin's symbol, when the token answered with one. A token that only
 * answered its decimals is named by its contract in the tooltip instead:
 * the figure never carries an address as if it were a name.
 */
const coinSymbol = (coin: BountyCoin): string =>
  coin.token && coin.symbol === shortToken(coin.token) ? '' : coin.symbol

/* A unit that is a contract, not a name: the token that never answered a
   symbol. An address, so Geist Mono, at the size of the symbol it stands
   in for, so the figure is never left without a unit. */
const ContractUnit = styled.small`
  font-family: var(--font-mono);
  letter-spacing: 0;
`

/** The figure's unit: the symbol, or else the token's shortened contract. */
const coinUnit = (coin: BountyCoin, symbol: string) =>
  symbol ? (
    <small>{symbol}</small>
  ) : coin.token ? (
    <ContractUnit title={coin.token}>{shortToken(coin.token)}</ContractUnit>
  ) : null

/** True while the tile can lead with an amount: decimals read, and something paid. */
const amountKnown = (coin: BountyCoin) =>
  coin.decimals !== undefined && coin.paid > 0

/**
 * Why a tile shows a count and no amount. Never an em dash on its own. The
 * ledger's bounty is a required field (the requester's deposit, or the
 * entry's stake), so a zero is a list that asked no base deposit or an
 * entry that carried no stake: there was no bounty, not a missing record.
 */
const withheldReason = (coin: BountyCoin): string => {
  if (coin.decimals === undefined)
    return 'amount not shown: the token did not answer'
  const one = coin.won === 1
  if (coin.stake)
    return `no bounty: ${one ? 'the entry' : 'the entries'} carried no stake`
  return `no bounty: ${one ? 'its list' : 'their lists'} asked no base deposit`
}

/** The lead's word when a tile has no amount: what its count counts. */
const countWord = (coin: BountyCoin): string =>
  coin.decimals !== undefined
    ? coin.won === 1
      ? 'challenge won'
      : 'challenges won'
    : coin.won === 1
      ? 'bounty'
      : 'bounties'

/**
 * What a tile cannot fit: the exact total, where its dollars were read from
 * and how old that answer is, which token a Stake list pays in (by the
 * contract it was read from), and any ruling that went to the challenger and
 * paid nothing — named rather than folded into the count beside the amount.
 */
const coinTip = (
  coin: BountyCoin,
  plus: string,
  /** The dollars the tile leads with, and the feed they came from. */
  usd?: string,
  price?: UsdPrice,
): string => {
  const parts: string[] = []
  if (amountKnown(coin) && coin.display)
    parts.push(
      plus ? `${coin.display} or more in all.` : `${coin.display} in all.`,
    )
  if (usd && price)
    parts.push(
      `About ${usd}${plus ? ' or more' : ''} at today’s price, from ${priceSource(price)}.`,
    )
  if (coin.stake)
    parts.push(
      coin.token
        ? `Paid in ${coinSymbol(coin) || 'this token'}, the token these Stake lists chose (contract ${coin.token}). Each Stake list sets its own ERC-20; another token gets a tile of its own and is never added to this one.`
        : "Paid in the list's own token, which did not load, so this amount is kept apart from the chain's coin.",
    )
  const unpaid = coin.won - coin.paid
  if (amountKnown(coin) && unpaid > 0)
    parts.push(
      `${unpaid === 1 ? 'One further ruling' : `${formatInt(unpaid)} further rulings`} went to the challenger on ${
        coin.stake
          ? 'entries with no stake'
          : 'lists that asked no base deposit'
      }, so there was no bounty to add.`,
    )
  return parts.join(' ')
}

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
  // Both sides of "rare" count the Classic lists: entries ever curated,
  // against every request ever disputed.
  const rare =
    never !== undefined &&
    entries !== undefined &&
    entries > record.challenged * 2
  const reading = challengersRight(record)
    ? rare
      ? ': challenges are rare, and mostly well founded'
      : ': most challenges are well founded'
    : ''
  return held
    ? `${held}, and ${share}${reading}.`
    : `${share.charAt(0).toUpperCase()}${share.slice(1)}${reading}.`
}

/** The retired Classic lists' share of these figures, named in one line. */
export interface ClassicHistory {
  lists: number
  entries: number
  /**
   * Their wins that carried an amount: counted in the coins' bounties, and
   * never a row (view.ts, scopedBounties.classicBounties).
   */
  bounties: number
  /** The Classic read came back full: its entries are a lower bound. */
  capped: boolean
}

/**
 * The retired Classic lists, in one faint line: the entries ever curated
 * and the bounties are the only figures on the page that count them (round
 * 4, "only for this"), and this is the one place that is said; the court's
 * share leaves them out, and its own words name the lists it is taken on.
 * It is built from the load alone — no date, no hardcoded total — and it
 * drops the parts the scope has none of.
 */
const classicLine = (classic?: ClassicHistory): string | undefined => {
  if (!classic || classic.lists === 0) return undefined
  // Lists that hold nothing and paid no bounty move no figure on this
  // page, so naming them would explain nothing (Sepolia's two).
  if (classic.entries === 0 && classic.bounties === 0) return undefined
  const plus = classic.capped ? '+' : ''
  const parts = [
    `${formatInt(classic.lists)}${plus} ${classic.lists === 1 ? 'list' : 'lists'}`,
    `${formatInt(classic.entries)}${plus} ${classic.entries === 1 ? 'entry' : 'entries'}`,
  ]
  if (classic.bounties > 0)
    parts.push(
      `${formatInt(classic.bounties)} ${classic.bounties === 1 ? 'bounty' : 'bounties'}`,
    )
  const last = parts.pop()
  const what = classic.bounties > 0 ? 'entries and bounties' : 'entries'
  return `The ${what} include the retired Classic lists: ${parts.join(', ')} and ${last}, none with a page in this app.`
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
  classic,
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
  /** What of these figures the retired Classic lists account for. */
  classic?: ClassicHistory
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
  const classicNote = classicLine(classic)
  // Several Stake tokens in scope: say once that they are not one total.
  const stakeCoins = record?.coins.filter((coin) => coin.stake).length ?? 0
  const ringKey = record ? `${record.loaded.join('-')}-${record.rulings}` : ''
  const coinCount = record && !unknown ? record.coins.length : 0
  // One or two tiles leave the column's width to the words beside them.
  const beside = coinCount > 0 && coinCount <= 2 ? coinCount : undefined
  const words =
    record && (sentence || classicNote || missing) ? (
      <Words data-words="">
        {sentence && (
          <Small $muted as="p">
            {sentence}
          </Small>
        )}
        {classicNote && (
          <Small $faint as="p">
            {classicNote}
          </Small>
        )}
        {missing && (
          <Small $faint as="p">
            {`The rulings on ${missing} did not load: ${record.missing.length > 1 ? 'their' : 'its'} bounties are not counted here.`}
          </Small>
        )}
      </Words>
    ) : null

  return (
    <section aria-labelledby={titleId}>
      <SectionHead>
        <SectionTitle id={titleId}>Self-sustaining mechanism</SectionTitle>
      </SectionHead>

      {/* Second box on the page, straight after the 30-day chart (--i: 4). */}
      <Panel $padding="standard" style={{ ['--i' as string]: 5 }}>
        <Body>
          <Gauges>
            {!record ? (
              <>
                <RingSkeleton $height="0px" $width={`${ringSize}px`} />
                <RingSkeleton $height="0px" $width={`${ringSize}px`} />
              </>
            ) : (
              <>
                {never !== undefined && entries !== undefined && (
                  <Tooltip
                    title={<TipText>{neverTip(never, entries)}</TipText>}
                  >
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
                )}
                {wonShare !== undefined ? (
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
                )}
              </>
            )}
          </Gauges>

          <Money $beside={beside}>
            {!record ? (
              <>
                <Label $tone="faint">Bounties won</Label>
                <SkeletonBlock $height="104px" />
              </>
            ) : (
              <>
                {!unknown && (
                  <Tooltip
                    title={<TipText>{bountiesTip(record, plus)}</TipText>}
                  >
                    <TipTarget tabIndex={0}>
                      <Label $tone="faint">Bounties won</Label>
                    </TipTarget>
                  </Tooltip>
                )}
                {unknown ? null : record.coins.length === 0 ? (
                  <Small $muted as="p" style={{ margin: 0 }}>
                    {record.rulings
                      ? record.rulings === 1 && !plus
                        ? 'No bounty yet: the one ruling did not go to a challenger.'
                        : `No bounty yet: none of the ${formatInt(record.rulings)}${plus} rulings went to a challenger.`
                      : 'No dispute has been ruled on yet.'}
                  </Small>
                ) : !pricesSettled ? (
                  <SkeletonBlock
                    $height="104px"
                    $width={`${coinCount * 190}px`}
                    style={{ maxWidth: '100%' }}
                  />
                ) : (
                  <Coins
                    $count={record.coins.length}
                    aria-label="Bounties won per coin, all time"
                  >
                    {record.coins.map((coin, index) => {
                      /* The amount in dollars, when a feed answered for this
                         coin and there is an amount to convert. */
                      const price = amountKnown(coin)
                        ? prices?.[coin.key]
                        : undefined
                      const dollars =
                        price && coin.value !== undefined
                          ? coin.value * price.usd
                          : undefined
                      const usd =
                        dollars !== undefined ? formatUsd(dollars) : undefined
                      const tip = coinTip(coin, plus, usd, price)
                      const symbol = coinSymbol(coin)
                      const count = amountKnown(coin) ? (
                        <WonCount>
                          {formatInt(coin.paid)}
                          {plus} {coin.paid === 1 ? 'bounty' : 'bounties'}
                        </WonCount>
                      ) : (
                        <Small $faint>{withheldReason(coin)}</Small>
                      )
                      const withTip = tip ? (
                        <Tooltip title={<TipText>{tip}</TipText>}>
                          <TipTarget tabIndex={0}>{count}</TipTarget>
                        </Tooltip>
                      ) : (
                        count
                      )
                      return (
                        <Coin
                          key={coin.key}
                          style={{ ['--i' as string]: index }}
                        >
                          <Lead
                            data-slot="lead"
                            key={usd ? 'usd' : 'coin'}
                            style={{ ['--i' as string]: 0 }}
                          >
                            {usd && dollars !== undefined ? (
                              <UsdLead
                                value={
                                  <AnimatedNumber
                                    value={dollars}
                                    format={usdFormatFor(dollars)}
                                  />
                                }
                                bound={plus}
                              />
                            ) : amountKnown(coin) ? (
                              <>
                                <span>
                                  <AnimatedNumber
                                    value={coin.value ?? 0}
                                    format={(value) =>
                                      amountFormat.format(value)
                                    }
                                  />
                                  {plus}
                                </span>
                                {coinUnit(coin, symbol)}
                              </>
                            ) : (
                              <>
                                <span>
                                  <AnimatedNumber value={coin.won} />
                                  {plus}
                                </span>
                                <small>{countWord(coin)}</small>
                              </>
                            )}
                          </Lead>
                          {usd && (
                            <Slot data-slot="amount">
                              <CoinAmount>
                                {amountFormat.format(coin.value ?? 0)}
                                {plus}
                                {coinUnit(coin, symbol)}
                              </CoinAmount>
                            </Slot>
                          )}
                          <Slot data-slot="meta">
                            <CoinMeta>
                              <ChainLogo chainId={coin.chainId} size={14} />
                              <span>{coinPlace(coin)}</span>
                            </CoinMeta>
                          </Slot>
                          {amountKnown(coin) && (
                            <Slot data-slot="count">{withTip}</Slot>
                          )}
                          {(coin.stake || !amountKnown(coin)) && (
                            <Note data-slot="note">
                              {coin.stake && (
                                <Small $faint>Any ERC-20, set per list</Small>
                              )}
                              {!amountKnown(coin) && withTip}
                            </Note>
                          )}
                        </Coin>
                      )
                    })}
                  </Coins>
                )}
                {stakeCoins > 1 && pricesSettled && (
                  <Small $faint as="p" style={{ margin: 0 }}>
                    Stake bounties are paid in each list&apos;s own token and
                    are never added together.
                  </Small>
                )}
                {words}
              </>
            )}
          </Money>
        </Body>
      </Panel>
    </section>
  )
}
