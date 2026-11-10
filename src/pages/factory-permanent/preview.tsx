import React from 'react'
import styled, { keyframes } from 'styled-components'
import type { BigNumber } from 'ethers'
import { useEthersProvider } from 'hooks/ethers-adapters'
import useArbitrationCost from 'hooks/arbitration-cost'
import useTokenSymbol from 'hooks/token-symbol'
import useNow from 'hooks/use-now'
import { parseIpfs } from 'utils/ipfs-parse'
import { isVowel } from 'utils/string'
import { formatAbsolute, formatDuration, formatDurationLong } from 'utils/time'
import { CurateIcon } from 'components/curate/icons'
import { AnimatedNumber } from 'components/curate/motion/animated-number'
import {
  Chip,
  Label,
  SkeletonBlock,
  StatusDot,
  Surface,
  truncateMiddle,
} from 'components/curate/primitives'
import { SafeImage, VisuallyHidden } from './controls'
import { useCourtSummary } from './court'
import {
  amountFormat,
  effectivePercent,
  formatMaybe,
  formatToken,
  groupAmount,
  hoursToSeconds,
  parseAmount,
  shareOf,
} from './format'
import type { TcrState } from '.'

/*
 * The preview beside the Stake wizard: the list as people will see it, what
 * each side locks at the minimum stake (the token stake on one shared scale,
 * with the share a failed challenge adds to the entry's stake, plus the
 * arbitration deposit in the chain's currency), the submission period as a
 * timeline from submission to acceptance (the end in UTC; an entry stays
 * challengeable after it), the other periods and the court. Every number is
 * read from the wizard state, the token and the arbitrator; stakes are in
 * the token's own decimals, as the contract will enforce them.
 */

const Panel = styled(Surface)`
  display: flex;
  flex-direction: column;
  padding: 20px 22px;

  @media (max-width: 720px) {
    padding: 18px 16px;
  }
`

const Block = styled.div`
  padding: 18px 0;
  border-top: 1px solid var(--glass-border);

  &:last-child {
    padding-bottom: 0;
  }
`

const Tag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  color: var(--color-muted);
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;

  i {
    width: 6px;
    height: 6px;
    border-radius: var(--radius-pill);
    background: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-soft);
  }
`

/* ---------- Identity ---------- */

const Identity = styled.div`
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  padding-bottom: 18px;
`

const Logo = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  overflow: hidden;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  background: var(--color-raised);
  color: var(--color-faint);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`

const Name = styled.span<{ $empty?: boolean }>`
  display: block;
  overflow: hidden;
  color: ${({ $empty }) =>
    $empty ? 'var(--color-faint)' : 'var(--color-text)'};
  font-family: var(--font-display);
  font-size: 22px;
  line-height: 26px;
  font-weight: 500;
  letter-spacing: -0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const Description = styled.span<{ $empty?: boolean }>`
  display: -webkit-box;
  margin-top: 2px;
  overflow: hidden;
  color: ${({ $empty }) =>
    $empty ? 'var(--color-faint)' : 'var(--color-muted)'};
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
`

/** One quiet line under the description: fields, then the submit label. */
const Meta = styled.span`
  display: block;
  margin-top: 8px;
  overflow: hidden;
  color: var(--color-faint);
  font-size: 13px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
`

/* ---------- What each side locks ---------- */

const BlockHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
`

const Side = styled.div`
  & + & {
    margin-top: 16px;
  }
`

const SideTop = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 2px 12px;
  margin-bottom: 10px;
`

/** The side's name and what its figure measures, beside the figure. */
const SideName = styled.span`
  display: flex;
  flex-direction: column;
  gap: 4px;
  grid-row: span 2;
  min-width: 0;

  small {
    color: var(--color-muted);
    font-size: 12px;
    line-height: 16px;
  }
`

const Amount = styled.span<{ $long?: boolean }>`
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: ${({ $long }) => ($long ? '22px' : '28px')};
  line-height: 32px;
  font-weight: 500;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;

  small {
    margin-left: 6px;
    color: var(--color-muted);
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0;
  }
`

/** The arbitration part, in the chain's currency, under the token figure. */
const Native = styled.span`
  grid-column: 2;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  color: var(--color-muted);
  font-size: 12px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  b {
    color: var(--color-text);
    font-weight: 500;
  }
`

const wipe = keyframes`
  from { clip-path: inset(0 100% 0 0 round 999px); }
  to { clip-path: inset(0 0 0 0 round 999px); }
`

const Bar = styled.div`
  display: flex;
  gap: 2px;
  height: 10px;
  border-radius: var(--radius-pill);
  background: var(--color-raised);
  overflow: hidden;
  animation: ${wipe} 900ms var(--ease-out) both;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const solid = 'linear-gradient(90deg, var(--aurora-b), var(--color-primary))'

const hatch = `repeating-linear-gradient(
  -45deg,
  color-mix(in srgb, var(--color-primary) 62%, transparent) 0 2px,
  color-mix(in srgb, var(--color-primary) 16%, transparent) 2px 5px
)`

const Segment = styled.span<{ $kind: 'stake' | 'gain' }>`
  display: block;
  flex: 0 0 auto;
  /* A non-zero part stays visible even when it is a sliver of the scale. */
  min-width: 4px;
  height: 100%;
  border-radius: var(--radius-pill);
  background: ${({ $kind }) => ($kind === 'stake' ? solid : hatch)};
  box-shadow: ${({ $kind }) =>
    $kind === 'stake'
      ? '0 0 12px color-mix(in srgb, var(--color-primary) 55%, transparent)'
      : 'none'};
  transition: width 900ms var(--ease-out);

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

/** The legend under a bar: swatch and what it measures. */
const Legend = styled.span`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 14px;
  margin-top: 7px;
  color: var(--color-muted);
  font-size: 12px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;

  > span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  i {
    width: 12px;
    height: 6px;
    border-radius: var(--radius-pill);
  }
`

const Outcomes = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--color-muted);
    font-size: 12px;
    line-height: 16px;
  }

  b {
    color: var(--color-text);
    font-weight: 500;
  }
`

/* ---------- Timing ---------- */

const PeriodTop = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px 16px;
  margin-top: 6px;
`

const PeriodFigure = styled.span<{ $empty?: boolean }>`
  color: ${({ $empty }) =>
    $empty ? 'var(--color-faint)' : 'var(--color-text)'};
  font-family: var(--font-figure);
  font-size: 28px;
  line-height: 32px;
  font-weight: 500;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

const PeriodEnd = styled.span`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 0;
  text-align: right;

  strong {
    color: var(--color-text);
    font-size: 12px;
    line-height: 16px;
    font-weight: 500;
  }

  span {
    color: var(--color-muted);
    font-size: 12px;
    line-height: 16px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
`

/** Where the submission period ends on the timeline; the rest is open-ended. */
const WINDOW_SHARE = 0.76

const Timeline = styled.div`
  position: relative;
  height: 14px;
  margin: 14px 0 0;
`

const Window = styled.span<{ $empty?: boolean }>`
  position: absolute;
  top: 3px;
  left: 0;
  width: ${WINDOW_SHARE * 100}%;
  height: 8px;
  border-radius: var(--radius-pill);
  background: ${({ $empty }) => ($empty ? 'var(--color-raised)' : solid)};
  box-shadow: ${({ $empty }) =>
    $empty
      ? 'none'
      : '0 0 14px color-mix(in srgb, var(--color-primary) 50%, transparent)'};
  animation: ${wipe} 900ms var(--ease-out) both;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

/** After acceptance: still listed, still challengeable, with no end. */
const Tail = styled.span<{ $from: number }>`
  position: absolute;
  top: 6px;
  left: ${({ $from }) => $from * 100}%;
  right: 0;
  height: 2px;
  /* The dashes fade out: an open end, not a deadline. */
  background:
    linear-gradient(90deg, transparent 45%, var(--color-surface)),
    repeating-linear-gradient(
      90deg,
      color-mix(in srgb, var(--status-registered) 70%, transparent) 0 4px,
      transparent 4px 8px
    );
`

/** A cut in the window at each axis step: the bar reads as days (or hours). */
const Cut = styled.span`
  position: absolute;
  top: 1px;
  width: 2px;
  height: 12px;
  margin-left: -1px;
  border-radius: 1px;
  background: var(--color-surface);
  transition: left 400ms var(--ease-out);
`

const Node = styled.span<{ $tone: 'start' | 'end' }>`
  position: absolute;
  top: 0;
  width: 14px;
  height: 14px;
  margin-left: -7px;
  border: 2px solid var(--color-surface);
  border-radius: var(--radius-pill);
  background: ${({ $tone }) =>
    $tone === 'start' ? 'var(--color-primary)' : 'var(--status-registered)'};
  box-shadow: 0 0 0 3px
    color-mix(
      in srgb,
      ${({ $tone }) =>
          $tone === 'start'
            ? 'var(--color-primary)'
            : 'var(--status-registered)'}
        28%,
      transparent
    );
  transition: left 400ms var(--ease-out);
`

const Axis = styled.div`
  position: relative;
  height: 16px;
  margin-top: 8px;
  color: var(--color-muted);
  font-size: 11px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;

  span {
    position: absolute;
    top: 0;
    white-space: nowrap;
    transform: translateX(-50%);
    transition: left 400ms var(--ease-out);
  }

  span[data-edge='start'] {
    left: 0;
    transform: none;
  }

  span[data-edge='end'] {
    right: 0;
    left: auto;
    transform: none;
    color: var(--color-faint);
  }
`

const Periods = styled.dl`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 16px 0 0;

  div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    padding: 0 12px;
    border-left: 1px solid var(--glass-border);
  }

  div:first-child {
    padding-left: 0;
    border-left: 0;
  }

  dd {
    margin: 0;
    color: var(--color-text);
    font-family: var(--font-figure);
    font-size: 15px;
    line-height: 20px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
`

/** Axis steps in hours: the smallest that leaves at most four cuts. */
const AXIS_STEPS = [1, 2, 3, 6, 12, 24, 48, 24 * 7, 24 * 14, 24 * 30, 24 * 90]

const axisTicks = (hours: number): number[] => {
  const step =
    AXIS_STEPS.find((candidate) => Math.ceil(hours / candidate) - 1 <= 4) ??
    24 * 180
  const ticks: number[] = []
  for (let at = step; at < hours; at += step) ticks.push(at)
  return ticks
}

const durationText = (seconds: number | null): string =>
  seconds === null ? '—' : seconds === 0 ? 'None' : formatDuration(seconds)

const SubmissionTimeline = ({
  seconds,
  withdrawing,
  reinclusion,
  cooldown,
}: {
  seconds: number | null
  withdrawing: number | null
  reinclusion: number | null
  cooldown: number | null
}) => {
  // Re-read every minute so the acceptance time stays "if submitted now".
  const now = useNow(60_000)
  const valid = seconds !== null
  const atOnce = seconds === 0
  const end = now + (seconds ?? 0)
  const hours = (seconds ?? 0) / 3600
  const ticks = valid && !atOnce ? axisTicks(hours) : []
  const endShare = atOnce ? 0 : WINDOW_SHARE

  return (
    <>
      <Label as="h3" $tone="muted">
        Submission period
      </Label>
      <PeriodTop>
        <PeriodFigure $empty={!valid}>
          {!valid ? 'Not set' : atOnce ? 'None' : formatDuration(seconds)}
        </PeriodFigure>
        {valid && (
          <PeriodEnd>
            <strong>
              {atOnce ? 'Accepted at once' : 'Accepted if unchallenged'}
            </strong>
            <span
              title={
                atOnce
                  ? undefined
                  : `${formatDurationLong(seconds)} after submission`
              }
            >
              {formatAbsolute(end)}
            </span>
          </PeriodEnd>
        )}
      </PeriodTop>
      <Timeline
        role="img"
        aria-label={
          !valid
            ? 'Submission period not set'
            : atOnce
              ? 'No submission period: an entry is accepted when submitted and stays challengeable while listed.'
              : `Submission period ${formatDurationLong(seconds)}: submitted now, accepted on ${formatAbsolute(end)} if nobody challenges, then still challengeable while listed.`
        }
      >
        {!atOnce && <Window $empty={!valid} key={valid ? 'set' : 'unset'} />}
        {valid && <Tail $from={endShare} />}
        {ticks.map((at, index) => (
          <Cut
            key={index}
            style={{ left: `${(at / hours) * WINDOW_SHARE * 100}%` }}
          />
        ))}
        <Node $tone="start" style={{ left: '7px' }} />
        {valid && (
          <Node
            $tone="end"
            style={{ left: atOnce ? '7px' : `${endShare * 100}%` }}
          />
        )}
      </Timeline>
      <Axis aria-hidden>
        <span data-edge="start">Now</span>
        {ticks.map((at, index) => {
          const share = (at / hours) * WINDOW_SHARE
          // Leave room for the start label and the open-end label.
          if (share < 0.12 || share > 0.5) return null
          return (
            <span key={index} style={{ left: `${share * 100}%` }}>
              {formatDuration(at * 3600)}
            </span>
          )
        })}
        {valid && <span data-edge="end">Challengeable while listed</span>}
      </Axis>
      <Periods>
        <div>
          <Label as="dt" $tone="faint">
            Withdrawal
          </Label>
          <dd title={withdrawing ? formatDurationLong(withdrawing) : undefined}>
            {durationText(withdrawing)}
          </dd>
        </div>
        <div>
          <Label as="dt" $tone="faint">
            Reinclusion
          </Label>
          <dd title={reinclusion ? formatDurationLong(reinclusion) : undefined}>
            {durationText(reinclusion)}
          </dd>
        </div>
        <div>
          <Label as="dt" $tone="faint">
            Cooldown
          </Label>
          <dd title={cooldown ? formatDurationLong(cooldown) : undefined}>
            {durationText(cooldown)}
          </dd>
        </div>
      </Periods>
    </>
  )
}

/* ---------- Court ---------- */

const CourtRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  strong {
    min-width: 0;
    overflow: hidden;
    color: var(--color-text);
    font-size: var(--fs-body);
    line-height: var(--lh-body);
    font-weight: 500;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

/* ---------- A side ---------- */

const AmountFigure = ({ text, unit }: { text: string | null; unit: string }) =>
  text === null ? (
    <Amount>
      <span aria-hidden>—</span>
      <VisuallyHidden>Not a valid amount</VisuallyHidden>
    </Amount>
  ) : (
    <Amount $long={text.length > 9}>
      <AnimatedNumber value={Number(text)} format={amountFormat(text)} />
      <small>{unit}</small>
    </Amount>
  )

const share = (part: number, scale: number) =>
  scale > 0 ? (part / scale) * 100 : 0

/* ---------- The panel ---------- */

export const StakePreview = ({
  tcrState,
  chainId,
  currency,
}: {
  tcrState: TcrState
  chainId: number
  currency: string
}) => {
  const library = useEthersProvider({ chainId })
  const { arbitrationCost } = useArbitrationCost({
    address: tcrState.arbitratorAddress,
    arbitratorExtraData: tcrState.arbitratorExtraData,
    library,
  })
  const {
    symbol,
    decimals: tokenDecimals,
    decimalsRead,
    loading: loadingSymbol,
  } = useTokenSymbol(tcrState.tokenAddress || undefined)
  const court = useCourtSummary(
    chainId,
    tcrState.arbitratorAddress,
    tcrState.arbitratorExtraData,
  )

  const symbolKnown = !!tcrState.tokenAddress && symbol !== 'tokens'
  const unit = symbolKnown ? symbol : 'tokens'
  // Until the token is read its decimals are unknown: 18 as a placeholder.
  const decimals = symbolKnown && decimalsRead ? tokenDecimals : 18
  // Base units, as the deploy call encodes the typed minimum (token decimals).
  const stake = parseAmount(tcrState.submissionMinDeposit, decimals)
  const percent = effectivePercent(tcrState.challengeStakeMultiplier)
  const challenger: BigNumber | null =
    stake && percent !== null ? shareOf(stake, percent) : null
  const grown = stake && challenger ? stake.add(challenger) : null
  // In tokens: what the contract enforces for this token's decimals.
  const stakeText = formatToken(stake, decimals)
  const challengerText = formatToken(challenger, decimals)
  const grownText = groupAmount(formatToken(grown, decimals))
  const stakeShown = groupAmount(stakeText)
  const challengerShown = groupAmount(challengerText)
  const costText = formatMaybe(arbitrationCost)
  const stakeNumber = Number(stakeText ?? 0)
  const challengerNumber = Number(challengerText ?? 0)
  const scale = stakeNumber + challengerNumber

  const title = tcrState.tcrTitle
  const description = tcrState.tcrDescription
  const logo = tcrState.tcrLogo ? parseIpfs(tcrState.tcrLogo) : ''
  const { itemName } = tcrState
  const fieldCount = tcrState.columns.length
  const article = itemName && isVowel(itemName[0]) ? 'an' : 'a'

  const native = (label: string) => (
    <Native>
      {costText === null ? (
        <SkeletonBlock $height="14px" $width="96px" />
      ) : (
        <>
          + <b>{costText}</b> {currency} {label}
        </>
      )}
    </Native>
  )

  return (
    <Panel $featured $padding="none">
      <Tag>
        <i aria-hidden />
        Preview
      </Tag>

      <Identity>
        <Logo aria-hidden>
          <SafeImage
            src={logo || undefined}
            alt=""
            fallback={<CurateIcon name="registry" size={20} />}
          />
        </Logo>
        <div style={{ minWidth: 0 }}>
          <Name $empty={!title}>{title || 'Untitled list'}</Name>
          <Description $empty={!description}>
            {description || 'No description yet'}
          </Description>
          <Meta>
            {fieldCount} {fieldCount === 1 ? 'field' : 'fields'}
            {itemName ? ` · Submit ${article} ${itemName.toLowerCase()}` : ''}
          </Meta>
        </div>
      </Identity>

      <Block>
        <BlockHead>
          <Label as="h3" $tone="muted">
            What each side locks
          </Label>
          {tcrState.tokenAddress &&
            (loadingSymbol ? (
              <SkeletonBlock $height="24px" $width="72px" />
            ) : (
              <Chip title={tcrState.tokenAddress}>
                {symbolKnown
                  ? `Stake in ${symbol}`
                  : truncateMiddle(tcrState.tokenAddress, 6, 4)}
              </Chip>
            ))}
        </BlockHead>

        <Side>
          <SideTop>
            <SideName>
              <Label $tone="text">Submitter</Label>
              <small>Minimum stake</small>
            </SideName>
            <AmountFigure text={stakeText} unit={unit} />
            {native('arbitration deposit')}
          </SideTop>
          <Bar
            role="img"
            aria-label={
              stakeShown === null
                ? 'Submitter: the minimum stake is not a valid amount'
                : `Submitter stakes at least ${stakeShown} ${unit}${grownText ? `; a failed challenge raises the minimum stake to ${grownText} ${unit}` : ''}`
            }
          >
            {stakeNumber > 0 && (
              <Segment
                $kind="stake"
                style={{ width: `${share(stakeNumber, scale)}%` }}
              />
            )}
            {challengerNumber > 0 && (
              <Segment
                $kind="gain"
                style={{ width: `${share(challengerNumber, scale)}%` }}
              />
            )}
          </Bar>
          <Legend aria-hidden>
            <span>
              <i style={{ background: solid }} />
              Stake
            </span>
            {challengerShown !== null && (
              <span>
                <i style={{ background: hatch }} />+{challengerShown} if a
                challenge fails
              </span>
            )}
          </Legend>
        </Side>

        <Side>
          <SideTop>
            <SideName>
              <Label $tone="text">Challenger</Label>
              <small>At the minimum stake</small>
            </SideName>
            <AmountFigure text={challengerText} unit={unit} />
            {native('arbitration cost')}
          </SideTop>
          <Bar
            role="img"
            aria-label={
              challengerShown === null
                ? 'Challenger: the challenger stake is not set'
                : `Challenger stakes ${percent}% of the entry's stake: ${challengerShown} ${unit} at the minimum stake`
            }
          >
            {challengerNumber > 0 && (
              <Segment
                $kind="stake"
                style={{ width: `${share(challengerNumber, scale)}%` }}
              />
            )}
          </Bar>
          <Legend aria-hidden>
            <span>
              <i style={{ background: solid }} />
              {percent === null
                ? 'Share not set'
                : `${percent}% of the entry’s stake${challengerShown !== null ? ` (${challengerShown} at the minimum)` : ''}`}
            </span>
          </Legend>
        </Side>

        <Outcomes>
          <li>
            <StatusDot $tone="registered" aria-hidden />
            <span>
              <b>Unchallenged:</b> both come back after a withdrawal
            </span>
          </li>
          <li>
            <StatusDot $tone="contested" aria-hidden />
            <span>
              <b>Challenge fails:</b>{' '}
              {grownText && percent !== null
                ? `the stake grows by ${percent}% (to ${grownText} ${unit} from the minimum)`
                : 'the challenger stake joins the entry'}
            </span>
          </li>
          <li>
            <StatusDot $tone="off" aria-hidden />
            <span>
              <b>Challenge wins:</b> the challenger takes the stake and the
              deposit
            </span>
          </li>
        </Outcomes>
      </Block>

      <Block>
        <SubmissionTimeline
          seconds={hoursToSeconds(tcrState.submissionPeriodDuration)}
          withdrawing={hoursToSeconds(tcrState.withdrawingPeriodDuration)}
          reinclusion={hoursToSeconds(tcrState.reinclusionPeriodDuration)}
          cooldown={hoursToSeconds(tcrState.arbitrationParamsCooldown)}
        />
      </Block>

      <Block>
        <CourtRow>
          <Label $tone="muted">
            {court.isKleros ? 'Kleros court' : 'Arbitrator'}
          </Label>
          <strong
            title={
              court.isKleros
                ? undefined
                : tcrState.arbitratorAddress || 'No arbitrator set'
            }
          >
            {court.isKleros
              ? (court.text ?? '—')
              : tcrState.arbitratorAddress
                ? truncateMiddle(tcrState.arbitratorAddress, 8, 6)
                : '—'}
          </strong>
        </CourtRow>
      </Block>
    </Panel>
  )
}
