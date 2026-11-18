import React, { useId } from 'react'
import styled, { keyframes } from 'styled-components'
import ChainLogo from 'components/chain-logo'
import {
  Label,
  SkeletonBlock,
  Small,
  Surface,
} from 'components/curate/primitives'
import { recessTrack } from 'components/ui/kit-styles'
import Tooltip from 'components/ui/Tooltip'
import { AnimatedNumber } from 'components/curate/motion/animated-number'
import { RingGauge } from 'components/curate/motion/ring-gauge'
import { reveal } from 'components/curate/motion/reveal'
import { SectionHead, SectionTitle } from './section'
import { chainInfo, type BountyCoin, type scopedChallengeRecord } from './view'

/*
 * How the lists have held up (round 2, items 7 and 14): what the lists' own
 * history says, all time, in the page's chain scope. It heads itself rather
 * than sitting under "Happening now": nothing in it is live.
 *
 * Three facts, in the order they matter, and in that order of weight:
 *
 *  1. The lists hold a great many entries.
 *  2. Only a small share of them has ever been disputed — the bar draws
 *     that share to scale, the one proportion in the panel that is a
 *     proportion of something the reader can see.
 *  3. When somebody did dispute one, the court mostly agreed: the short arc
 *     and the figure pair beside it, of the disputes the court has closed.
 *
 * Then the bounties those challengers took, one figure per coin, never
 * added across coins.
 *
 * Two measures, two windows, said on the labels: entries are what the lists
 * hold today; challenges and rulings are all time and never windowed. A
 * figure reads "n+" when its query stopped at its page cap, and where that
 * happens the rarity is stated as a bound rather than as a rate, since the
 * true number of challenges can only be higher. A chain whose ledger did
 * not load is named rather than counted as zero.
 *
 * The reader's "why this matters" lines live in the tooltips; the panel
 * itself is figures and labels (DESIGN.md: data first, words last).
 */

type ChallengeRecord = ReturnType<typeof scopedChallengeRecord>

const integer = new Intl.NumberFormat('en-US')
const formatInt = (value: number) => integer.format(value)
const amountFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 4,
})

/** A share, never rounded to a flattering "0%": under a tenth reads "<0.1%". */
const sharePercent = (share: number): string => {
  const percent = share * 100
  if (percent === 0) return '0%'
  if (percent < 0.1) return '<0.1%'
  return `${percent.toFixed(percent < 10 ? 1 : 0)}%`
}

const Panel = styled(Surface)`
  display: flex;
  flex-direction: column;
  gap: 18px;
  ${reveal}
`

/* The rarity, the panel's lead: two figures over one proportional bar. */
const Rarity = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const RarityHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px 32px;
`

const Figure = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
`

/* The denominator reads from the right, over the end of the bar it measures. */
const FigureEnd = styled(Figure)`
  align-items: flex-end;
  text-align: right;

  @media (max-width: 560px) {
    align-items: flex-start;
    text-align: left;
  }
`

const Big = styled.span`
  display: inline-flex;
  align-items: baseline;
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: clamp(34px, 1.4vw + 22px, 44px);
  line-height: 0.95;
  font-weight: 500;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 4px;
    border-radius: 4px;
  }
`

/* The entries the lists hold: the bar's whole length, in figures. */
const Held = styled.span`
  display: inline-flex;
  align-items: baseline;
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: clamp(22px, 0.8vw + 14px, 28px);
  line-height: 1;
  font-weight: 500;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 4px;
    border-radius: 4px;
  }
`

const grow = keyframes`
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
`

/*
 * One bar: its full length is the entries the lists hold today, the lit
 * slice the requests anyone has ever challenged. A slice too thin to see
 * still keeps 3px, so a tiny share reads as tiny rather than as nothing;
 * the figures above it and the label under it carry the exact numbers.
 */
const Bar = styled.div`
  position: relative;
  height: 14px;
  border-radius: var(--radius-pill);
  ${recessTrack}
  overflow: hidden;

  > i {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    border-radius: var(--radius-pill);
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--viz-3) 45%, transparent),
      var(--viz-3)
    );
    box-shadow: 0 0 16px -2px color-mix(in srgb, var(--viz-3) 70%, transparent);
    transform-origin: left center;
    animation: ${grow} 900ms var(--ease-out) both;
  }

  @media (prefers-reduced-motion: reduce) {
    > i {
      animation: none;
    }
  }
`

/* The court's record: a short arc and its figures, under a hairline. */
const Court = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px 22px;
  padding-top: 18px;
  border-top: 1px solid var(--glass-border);
`

/** "18 of 24 rulings", the won figure leading. */
const Pair = styled.span`
  display: inline-flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0 8px;
  color: var(--color-muted);
  font-family: var(--font-figure);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-variant-numeric: tabular-nums;

  b {
    color: var(--color-text);
    font-size: 28px;
    line-height: 1;
    font-weight: 500;
    letter-spacing: -0.03em;
  }
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

/* The bounties, under their own hairline. */
const Bounties = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 18px;
  border-top: 1px solid var(--glass-border);
`

/* Phones: one coin per row, the amount on the left, where and how many on the right. */
const phoneCoins = `
  @media (max-width: 520px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;

    > li {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      column-gap: 12px;
      row-gap: 2px;
      padding: 10px 0;
      border-left: 0;
      border-top: 1px solid var(--glass-border);
    }

    > li > b {
      grid-row: span 2;
      margin: 0;
    }

    > li > span {
      justify-self: end;
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

/** "Ethereum and Gnosis" */
const chainNames = (chains: number[]) =>
  chains
    .map((chainId) => chainInfo(chainId)?.name ?? `Chain ${chainId}`)
    .join(' and ')

const coinPlace = (coin: BountyCoin) => {
  const chain = chainInfo(coin.chainId)?.name ?? `Chain ${coin.chainId}`
  return coin.token ? `Stake · ${chain}` : chain
}

/**
 * What the challenged figure means for the reader: challenges are rare next
 * to what the lists hold. Only claimed with the entries to compare it to,
 * and only while the challenge count is not itself a lower bound — a capped
 * ledger or a chain that did not answer leaves the true count higher than
 * the figure, so no rate is claimed from it.
 */
const challengedTip = (
  record: ChallengeRecord,
  entries: number | undefined,
  plus: string,
): string => {
  if (record.challenged === 0)
    return 'No request here has been disputed yet. Anyone may challenge one while its challenge window is open.'
  const count = `${formatInt(record.challenged)}${plus}`
  if (entries === undefined || record.challengedPartial)
    return `Every request anyone has disputed, all time: ${count}, in court now or already ruled on.`
  const both = `${count} all time, including the ones still in court, against ${formatInt(entries)} entries held today.`
  // "Rare" is only said where the figures bear it out.
  return entries > record.challenged * 2
    ? `Challenges are rare next to what the lists hold: ${both} Most of what these lists hold has never been disputed.`
    : `Every request anyone has disputed: ${both}`
}

/** What the entries figure is for: the bar's whole length. */
const ENTRIES_TIP =
  'Every entry these lists hold right now. Each one went through a challenge window in which anyone could have disputed it.'

/** What the arc means for the reader, without over-claiming it. */
const rulingsTip = (record: ChallengeRecord): string =>
  record.won * 2 > record.rulings
    ? 'Most rulings so far have gone to the challenger: when someone shows an entry breaks the rules, jurors tend to agree. Each case is still decided on its own evidence.'
    : 'Jurors settle each dispute on its own evidence. A ruling for the challenger pays them the bounty; one for the requester leaves the entry as it stands.'

/**
 * How the lists have held up: how rarely anything is challenged, how the
 * court ruled when it was, and what the challengers took. The section heads
 * itself and owns its loading state, so the heading never pops in.
 */
export const VerificationRecord = ({
  record,
  entries,
}: {
  /** Undefined while the load is still running. */
  record?: ChallengeRecord
  /** Entries the lists hold today, or undefined when a chain's lists are missing. */
  entries?: number
}) => {
  const titleId = useId()

  const plus = record?.capped ? '+' : ''
  const challengedPlus = record?.challengedPartial ? '+' : ''
  const missing =
    record && record.missing.length > 0 ? chainNames(record.missing) : undefined
  // A chain whose ledger did not load: the arc covers the others, by name.
  const partial = !!missing && !!record && record.loaded.length > 0
  const where = partial && record ? ` on ${chainNames(record.loaded)}` : ''
  const unknown = !!record && record.rulings === 0 && !!missing

  // Entries now against challenges all time: two measures, both named.
  const share =
    record && entries !== undefined && entries > 0
      ? Math.min(1, record.challenged / entries)
      : undefined
  // Floored, never rounded up: a rarity claim is never better than the data.
  const ratio =
    record && entries !== undefined && record.challenged > 0
      ? Math.floor(entries / record.challenged)
      : undefined
  /** The bar's own label: both measures, both windows, the exact figures. */
  const barLabel =
    record && entries !== undefined && share !== undefined
      ? `Requests ever challenged, all time, against the entries the lists hold today: ${formatInt(record.challenged)}${challengedPlus ? ' or more' : ''} of ${formatInt(entries)}, ${sharePercent(share)} of them`
      : undefined
  /*
   * The rate under the bar. While the challenge count is a lower bound (a
   * capped ledger, a chain that did not answer) the true rate can only be
   * higher, so the line reads as a bound instead of as a rate.
   */
  const rate =
    share === undefined || !record || record.challenged === 0
      ? undefined
      : ratio !== undefined && ratio >= 2
        ? record.challengedPartial
          ? `1 per ${formatInt(ratio)} entries held today or fewer`
          : `1 per ${formatInt(ratio)} entries held today`
        : record.challengedPartial
          ? `at least ${sharePercent(share)} of the entries held today`
          : `${sharePercent(share)} of the entries held today`

  return (
    <section aria-labelledby={titleId}>
      <SectionHead>
        <SectionTitle id={titleId}>How the lists have held up</SectionTitle>
        <Label $tone="faint">Challenges and rulings · all time</Label>
      </SectionHead>

      <Panel $padding="standard" style={{ ['--i' as string]: 0 }}>
        <Rarity>
          <RarityHead>
            <Figure>
              <Label $tone="faint">Ever challenged · all time</Label>
              {record ? (
                <Tooltip
                  title={
                    <TipText>
                      {challengedTip(record, entries, challengedPlus)}
                    </TipText>
                  }
                >
                  <Big
                    tabIndex={0}
                    role="img"
                    aria-label={`${formatInt(record.challenged)}${challengedPlus ? ' or more' : ''} requests ever challenged, all time`}
                  >
                    <AnimatedNumber value={record.challenged} />
                    {challengedPlus}
                  </Big>
                </Tooltip>
              ) : (
                <SkeletonBlock $height="40px" $width="140px" />
              )}
            </Figure>
            <FigureEnd>
              <Label $tone="faint">Entries held today</Label>
              {entries !== undefined ? (
                <Tooltip title={<TipText>{ENTRIES_TIP}</TipText>}>
                  <Held
                    tabIndex={0}
                    role="img"
                    aria-label={`${formatInt(entries)} entries held today`}
                  >
                    <AnimatedNumber value={entries} />
                  </Held>
                </Tooltip>
              ) : record ? (
                <Held role="img" aria-label="Entries held today: not known">
                  —
                </Held>
              ) : (
                <SkeletonBlock $height="28px" $width="110px" />
              )}
            </FigureEnd>
          </RarityHead>
          {/* No bar without the entries to draw the challenges against: a
              chain whose lists did not load leaves the comparison out. */}
          {barLabel !== undefined && share !== undefined ? (
            <Bar role="img" aria-label={barLabel}>
              {/* Nothing challenged draws nothing; a thin slice keeps 3px. */}
              <i
                style={{
                  width:
                    share === 0 ? 0 : `max(3px, ${(share * 100).toFixed(2)}%)`,
                }}
              />
            </Bar>
          ) : (
            !record && <SkeletonBlock $height="14px" />
          )}
          {rate && <Small $muted>{rate}</Small>}
        </Rarity>

        <Court>
          {!record ? (
            <>
              <SkeletonBlock
                $height="104px"
                $width="104px"
                style={{ borderRadius: 'var(--radius-pill)' }}
              />
              <Figure>
                <Label $tone="faint">Sided with the challenger</Label>
                <SkeletonBlock $height="28px" $width="160px" />
              </Figure>
            </>
          ) : record.rulings > 0 ? (
            <>
              <RingGauge
                key={`${record.loaded.join('-')}-${record.rulings}`}
                size={104}
                ratio={record.won / record.rulings}
                from="var(--edge-3)"
                to="var(--edge-2)"
                label={`The court sided with the challenger in ${formatInt(record.won)}${plus} of ${formatInt(record.rulings)}${plus} rulings${where}, all time.`}
              />
              <Figure>
                <Tooltip title={<TipText>{rulingsTip(record)}</TipText>}>
                  <TipTarget tabIndex={0}>
                    <Label $tone="faint">Sided with the challenger</Label>
                  </TipTarget>
                </Tooltip>
                <Pair>
                  <b>
                    {formatInt(record.won)}
                    {plus}
                  </b>
                  of {formatInt(record.rulings)}
                  {plus} rulings{where}
                </Pair>
              </Figure>
            </>
          ) : (
            <Figure>
              <Label $tone="faint">Sided with the challenger</Label>
              <Small $muted>
                {unknown
                  ? 'The rulings did not load'
                  : 'No dispute has been ruled on yet'}
              </Small>
            </Figure>
          )}
        </Court>

        {!record ? (
          <Bounties>
            <Label $tone="faint">Bounties won · all time</Label>
            <SkeletonBlock $height="58px" />
          </Bounties>
        ) : (
          !unknown && (
            <Bounties>
              {record.winners > 0 ? (
                <Tooltip
                  title={
                    <TipText>
                      {`Paid to ${formatInt(record.winners)}${plus} ${record.winners === 1 ? 'challenger' : 'different challengers'}, each on top of their own deposit back.`}
                    </TipText>
                  }
                >
                  <TipTarget tabIndex={0}>
                    <Label $tone="faint">Bounties won · all time</Label>
                  </TipTarget>
                </Tooltip>
              ) : (
                <Label $tone="faint">Bounties won · all time</Label>
              )}
              {record.coins.length === 0 ? (
                <Small $muted as="p" style={{ margin: 0 }}>
                  {record.rulings
                    ? record.rulings === 1 && !plus
                      ? 'No bounty yet: the one ruling did not go to a challenger.'
                      : `No bounty yet: none of the ${formatInt(record.rulings)}${plus} rulings went to a challenger.`
                    : 'No dispute has been ruled on yet.'}
                </Small>
              ) : (
                <Coins aria-label="Bounties won, all time, per coin">
                  {record.coins.map((coin, index) => (
                    <Coin key={coin.key} style={{ ['--i' as string]: index }}>
                      <b>
                        {coin.value !== undefined ? (
                          <span>
                            <AnimatedNumber
                              value={coin.value}
                              format={(value) => amountFormat.format(value)}
                            />
                          </span>
                        ) : (
                          <span aria-hidden>—</span>
                        )}
                        <small>{coin.symbol}</small>
                      </b>
                      <CoinMeta title={coin.display}>
                        <ChainLogo chainId={coin.chainId} size={14} />
                        <span>{coinPlace(coin)}</span>
                      </CoinMeta>
                      <WonCount>
                        {formatInt(coin.won)}
                        {plus} {coin.won === 1 ? 'bounty' : 'bounties'}
                      </WonCount>
                    </Coin>
                  ))}
                </Coins>
              )}
            </Bounties>
          )
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
