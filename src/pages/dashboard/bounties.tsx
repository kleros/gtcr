import React, { useId } from 'react'
import styled from 'styled-components'
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
import { SectionHead, SectionTitle } from './section'
import { formatUsd, UsdValue } from './board-rows'
import { priceSource, type UsdPrice } from './prices'
import { chainInfo, type BountyCoin, type scopedChallengeRecord } from './view'

/*
 * The self-sustaining mechanism (round 3): one wide card, back to the
 * proportions of the version before it — the rings on the left at full
 * size, the money to their right, one sentence across the foot.
 *
 * Two rings, two shares of different wholes — the entries these lists
 * have ever held, and the disputes the court has closed all time. They are
 * drawn in the same hues on purpose: two readings of one question, not two
 * categories to tell apart (DESIGN.md keeps --viz-1..4 for categories), so
 * each caption names the whole its share is of.
 *
 *  1. Nobody disputed these entries. Its denominator is every entry these
 *     lists have ever held, in any status, the retired Classic lists'
 *     included (round 4: the all-time figures are the protocol's history,
 *     so they count the lists it no longer shows — the one line under the
 *     panel says so, and the live strip in the hero still counts only the
 *     lists Browse can open). `challenged` counts disputed requests, of
 *     which one entry can collect two (its registration and later its
 *     removal) — so the share is a floor on the truth. Where the challenge
 *     ledger or the Classic read is itself a lower bound the biases oppose
 *     and no bound holds, so the ring is not drawn at all rather than drawn
 *     as "at most".
 *  2. Of the disputes the court has closed, this share went to the
 *     challenger: the reading the owner asked for, that a challenge here is
 *     usually well founded rather than noise.
 *
 * Both percentages are rounded from their two counts, and each ring is
 * handed the rounded figure rather than the raw ratio, so the count-up ends
 * on the number the sentence states and the two can never disagree.
 *
 * Then the bounties those challengers took, one figure per coin, never
 * added across coins — a Stake list pays in its own token, which is the
 * list's choice and can differ list to list, so the tile names the token
 * and identifies it by the contract it was read from. The count under an
 * amount is how many bounties that amount is the sum of, so the two answer
 * the same question; a ruling that went to the challenger with no deposit
 * recorded is named in the tooltip rather than padding the count. A token
 * whose decimals never answered leaves the tile its count and says why
 * there is no amount, instead of an em dash where a figure should be.
 *
 * Each amount carries what it is worth in dollars, when that can be read from
 * a Chainlink feed on the coin's own chain (prices.ts): these tiles and the
 * collateral in the strip below are the only two figures on the site that do,
 * and the tooltip names the feed and how old its answer is. The dollars are
 * an aside on the amount, never the amount, there is no dollar total across
 * coins, and a coin whose price cannot be read shows its amount alone — which
 * is what every tile showed before.
 *
 * Windows are carried by the figures themselves rather than by a chip over
 * the panel (round 3: four "all time" stamps read as boilerplate). The
 * captions and the sentence say what each share measures; entries are what
 * the lists hold today, disputes and bounties are all time and never
 * windowed. A figure reads "n+" when its query stopped at its page cap, and
 * a chain whose ledger did not load is named rather than counted as zero.
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
  display: flex;
  flex-direction: column;
  gap: 18px;
  ${reveal}
`

/* The rings and the money, side by side; stacked once that is too narrow. */
const Body = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 24px 32px;

  @media (max-width: 900px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

/* Two rings at full size; one per row when both no longer fit. */
const Gauges = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 24px 32px;
`

/* The money column. Its tiles carry their own hairlines: no panel in a panel. */
const Money = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
`

const Figure = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
`

/** A label that carries a tooltip: focusable, so it reads on tab. */
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

/* Phones: one coin per row, its lines stacked, hairlines between them. */
const phoneCoins = `
  @media (max-width: 520px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;

    > li {
      padding: 10px 0;
      border-left: 0;
      border-top: 1px solid var(--glass-border);
    }
  }
`

const Coins = styled.ul`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 14px 24px;
  margin: 0;
  padding: 0;
  list-style: none;
  ${phoneCoins}
`

const Coin = styled.li`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding-left: 14px;
  border-left: 1px solid var(--glass-border);
  ${reveal}

  b {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0 6px;
    color: var(--color-text);
    font-family: var(--font-figure);
    font-size: clamp(22px, 0.8vw + 14px, 28px);
    line-height: 1.1;
    font-weight: 500;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
    margin-bottom: 4px;
  }

  b small {
    color: var(--color-muted);
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 0;
  }
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

/* Which token a Stake list pays in: an address, so Geist Mono. */
const CoinToken = styled.span`
  min-width: 0;
  overflow: hidden;
  color: var(--color-faint);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
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
 * answered its decimals is named by its address in the line below instead:
 * the figure never carries an address as if it were a name.
 */
const coinSymbol = (coin: BountyCoin): string =>
  coin.token && coin.symbol === shortToken(coin.token) ? '' : coin.symbol

/** True while the tile can lead with an amount: decimals read, and something paid. */
const amountKnown = (coin: BountyCoin) =>
  coin.decimals !== undefined && coin.paid > 0

/** Why a tile shows a count and no amount. Never an em dash on its own. */
const withheldReason = (coin: BountyCoin): string =>
  coin.decimals === undefined
    ? 'amount not shown: the token did not answer'
    : `amount not shown: no deposit was recorded for ${coin.won === 1 ? 'it' : 'them'}`

/**
 * What a tile cannot fit: the exact total, where its dollar aside was read
 * from and how old that answer is, which token a Stake list pays in (by the
 * contract it was read from), and any ruling that went to the challenger with
 * no deposit recorded — named rather than folded into the count beside the
 * amount.
 */
const coinTip = (
  coin: BountyCoin,
  plus: string,
  /** The dollar aside the tile shows, and the feed it came from. */
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
        ? `Paid in this list's own token, read from its contract: ${coin.token}.`
        : "Paid in the list's own token, which did not load, so this amount is kept apart from the chain's coin.",
    )
  const unrecorded = coin.won - coin.paid
  if (amountKnown(coin) && unrecorded > 0)
    parts.push(
      unrecorded === 1
        ? 'One further ruling went to the challenger with no deposit recorded, so the amount does not cover it.'
        : `${formatInt(unrecorded)} further rulings went to the challenger with no deposit recorded, so the amount does not cover them.`,
    )
  return parts.join(' ')
}

/** What a bounty is, and over what window: the figures' own explanation. */
const bountiesTip = (record: ChallengeRecord, plus: string): string =>
  record.winners > 0
    ? `Every bounty challengers have taken, all time: paid to ${formatInt(record.winners)}${plus} ${record.winners === 1 ? 'challenger' : 'different challengers'}, each on top of their own deposit back.`
    : "What a challenger takes when the court rules for them, all time: the requester's base deposit (Standard) or the entry's stake (Stake), on top of their own deposit back."

/**
 * The panel's one sentence (DESIGN.md: one sentence under a title at most),
 * built from the same figures as the rings, so the words and the drawings
 * cannot disagree. It names the sample the court's share rests on, and the
 * reading after the colon is printed only where the figures bear it out:
 * "rare" needs the entries to outnumber the disputes twice over, "well
 * founded" needs more than half of the closed disputes to have gone to the
 * challenger.
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
      ? `Nobody has disputed ${never}% of the ${formatInt(entries)} entries these lists have ever held`
      : undefined
  if (won === undefined)
    return held
      ? `${held}, and no dispute has been ruled on yet.`
      : 'No dispute has been ruled on yet.'
  const sample = `the ${formatInt(record.rulings)}${plus} disputes the court has closed`
  const share = `${won}% went to the challenger`
  const rare =
    never !== undefined &&
    entries !== undefined &&
    entries > record.challenged * 2
  const reading =
    record.won * 2 > record.rulings
      ? rare
        ? ': challenges are rare, and mostly well founded'
        : ': most challenges are well founded'
      : ''
  return held
    ? `${held}, and of ${sample}, ${share}${reading}.`
    : `Of ${sample}, ${share}${reading}.`
}

/** The retired Classic lists' share of these figures, named in one line. */
export interface ClassicHistory {
  lists: number
  entries: number
  /** Its rulings: counted in the figures, and never a row (view.ts). */
  rulings: number
  /** The Classic read came back full: its entries are a lower bound. */
  capped: boolean
}

/**
 * The retired Classic lists, in one faint line: these are the only figures
 * on the page that count them, and this is the one place that is said. It
 * is built from the load alone — no date, no hardcoded total — and it drops
 * the parts the scope has none of.
 */
const classicLine = (classic?: ClassicHistory): string | undefined => {
  if (!classic || classic.lists === 0) return undefined
  // Lists that hold nothing and were never disputed move no figure on this
  // page, so naming them would explain nothing (Sepolia's two).
  if (classic.entries === 0 && classic.rulings === 0) return undefined
  const plus = classic.capped ? '+' : ''
  const parts = [
    `${formatInt(classic.lists)}${plus} ${classic.lists === 1 ? 'list' : 'lists'}`,
    `${formatInt(classic.entries)}${plus} ${classic.entries === 1 ? 'entry' : 'entries'}`,
  ]
  if (classic.rulings > 0)
    parts.push(
      `${formatInt(classic.rulings)} ${classic.rulings === 1 ? 'ruling' : 'rulings'}`,
    )
  const last = parts.pop()
  return `The retired Classic lists are counted here too: ${parts.join(', ')} and ${last}, none of which has a page in this app.`
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
}: {
  /** Undefined while the load is still running. */
  record?: ChallengeRecord
  /**
   * Every entry these lists have ever held, the retired Classic ones
   * included (view.ts: scopedFigures.entriesAllTime) — the all-time figure,
   * not the hero's live one. Undefined when a chain's lists are missing, or
   * when the Classic read capped: then the share built on it is left out
   * rather than drawn short.
   */
  entries?: number
  /** What of these figures the retired Classic lists account for. */
  classic?: ClassicHistory
  /**
   * Dollars per whole coin, keyed by `BountyCoin.key` (use-usd-prices.ts). A
   * coin missing from it, and every coin while the prices have not arrived or
   * never do, shows its amount alone. A price that has passed its feed's
   * heartbeat leaves that map, so an aside goes rather than ages.
   */
  prices?: Record<string, UsdPrice>
}) => {
  const titleId = useId()

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
  const wonShare =
    record && record.rulings > 0
      ? sharePercent(record.won, record.rulings)
      : undefined
  const sentence = record
    ? heldUpSentence(record, entries, never, wonShare, plus)
    : undefined
  const classicNote = classicLine(classic)
  // Several Stake tokens in scope: say once that they are not one total.
  const stakeCoins = record?.coins.filter((coin) => coin.stake).length ?? 0
  const ringKey = record ? `${record.loaded.join('-')}-${record.rulings}` : ''

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
                <SkeletonBlock
                  $height="168px"
                  $width="168px"
                  style={{ borderRadius: 'var(--radius-pill)' }}
                />
                <SkeletonBlock
                  $height="168px"
                  $width="168px"
                  style={{ borderRadius: 'var(--radius-pill)' }}
                />
              </>
            ) : (
              <>
                {never !== undefined && entries !== undefined && (
                  <RingGauge
                    key={`never-${ringKey}-${entries}`}
                    size={168}
                    ratio={never / 100}
                    from="var(--edge-3)"
                    to="var(--edge-2)"
                    caption="of entries never disputed"
                    label={`Nobody has disputed ${never}% of the ${formatInt(entries)} entries these lists have ever held, against ${formatInt(record.challenged)} requests anyone has disputed, all time.`}
                  />
                )}
                {wonShare !== undefined ? (
                  <RingGauge
                    key={`won-${ringKey}`}
                    size={168}
                    ratio={wonShare / 100}
                    from="var(--edge-3)"
                    to="var(--edge-2)"
                    caption="of disputes went to the challenger"
                    label={`The court sided with the challenger in ${formatInt(record.won)}${plus} of ${formatInt(record.rulings)}${plus} rulings${where}, all time.`}
                  />
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

          <Money>
            {!record ? (
              <>
                <Label $tone="faint">Bounties won</Label>
                <SkeletonBlock $height="58px" />
              </>
            ) : (
              !unknown && (
                <>
                  <Tooltip
                    title={<TipText>{bountiesTip(record, plus)}</TipText>}
                  >
                    <TipTarget tabIndex={0}>
                      <Label $tone="faint">Bounties won</Label>
                    </TipTarget>
                  </Tooltip>
                  {record.coins.length === 0 ? (
                    <Small $muted as="p" style={{ margin: 0 }}>
                      {record.rulings
                        ? record.rulings === 1 && !plus
                          ? 'No bounty yet: the one ruling did not go to a challenger.'
                          : `No bounty yet: none of the ${formatInt(record.rulings)}${plus} rulings went to a challenger.`
                        : 'No dispute has been ruled on yet.'}
                    </Small>
                  ) : (
                    <Coins aria-label="Bounties won per coin, all time">
                      {record.coins.map((coin, index) => {
                        /* The amount in dollars, when a feed answered for
                           this coin and there is an amount to convert. */
                        const price = amountKnown(coin)
                          ? prices?.[coin.key]
                          : undefined
                        const usd =
                          price && coin.value !== undefined
                            ? formatUsd(coin.value * price.usd)
                            : undefined
                        const tip = coinTip(coin, plus, usd, price)
                        /* The count the amount is made of, or why there is
                           no amount: one line, whichever it is. */
                        const under = amountKnown(coin) ? (
                          <WonCount>
                            {formatInt(coin.paid)}
                            {plus} {coin.paid === 1 ? 'bounty' : 'bounties'}
                          </WonCount>
                        ) : (
                          <Small $faint>{withheldReason(coin)}</Small>
                        )
                        return (
                          <Coin
                            key={coin.key}
                            style={{ ['--i' as string]: index }}
                          >
                            <b>
                              {amountKnown(coin) ? (
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
                                  {coinSymbol(coin) && (
                                    <small>{coinSymbol(coin)}</small>
                                  )}
                                  {usd && <UsdValue value={usd} bound={plus} />}
                                </>
                              ) : (
                                <>
                                  <span>
                                    <AnimatedNumber value={coin.won} />
                                    {plus}
                                  </span>
                                  <small>
                                    {coin.won === 1 ? 'bounty' : 'bounties'}
                                  </small>
                                </>
                              )}
                            </b>
                            <CoinMeta>
                              <ChainLogo chainId={coin.chainId} size={14} />
                              <span>{coinPlace(coin)}</span>
                            </CoinMeta>
                            {tip ? (
                              <Tooltip title={<TipText>{tip}</TipText>}>
                                <TipTarget tabIndex={0}>{under}</TipTarget>
                              </Tooltip>
                            ) : (
                              under
                            )}
                            {coin.token && (
                              <CoinToken>{shortToken(coin.token)}</CoinToken>
                            )}
                          </Coin>
                        )
                      })}
                    </Coins>
                  )}
                  {stakeCoins > 1 && (
                    <Small $faint as="p" style={{ margin: 0 }}>
                      Stake bounties are paid in each list&apos;s own token and
                      are never added together.
                    </Small>
                  )}
                </>
              )
            )}
          </Money>
        </Body>

        {sentence && (
          <Small $muted as="p" style={{ margin: 0 }}>
            {sentence}
          </Small>
        )}

        {record && classicNote && (
          <Small $faint as="p" style={{ margin: 0 }}>
            {classicNote}
          </Small>
        )}

        {missing && (
          <Small $faint as="p" style={{ margin: 0 }}>
            {`The rulings on ${missing} did not load: ${record && record.missing.length > 1 ? 'their' : 'its'} bounties are not counted here.`}
          </Small>
        )}
      </Panel>
    </section>
  )
}
