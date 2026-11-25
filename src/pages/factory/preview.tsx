import React, { useState } from 'react'
import styled, { keyframes } from 'styled-components'
import type { BigNumber } from 'ethers'
import { useEthersProvider } from 'hooks/ethers-adapters'
import useArbitrationCost from 'hooks/arbitration-cost'
import useNow from 'hooks/use-now'
import { parseIpfs } from 'utils/ipfs-parse'
import { getArticleFor } from 'utils/string'
import { formatAbsolute, formatDuration, formatDurationLong } from 'utils/time'
import { CurateIcon } from 'components/curate/icons'
import {
  AnimatedNumber,
  amountFormat,
} from 'components/curate/motion/animated-number'
import {
  Label,
  SegmentedControl,
  SkeletonBlock,
  Surface,
} from 'components/curate/primitives'
import { VisuallyHidden } from 'components/curate/factory-shared-fields'
import {
  MinusIcon,
  Outcomes,
  PreviewCourtRow,
  PreviewIdentity,
} from 'components/curate/factory-shared-preview'
import { groupThousands } from 'components/curate/item-standard-format'
import { formatNative, totalDeposit } from './amounts'
import type { TcrState } from '.'
import { plainDecimal, typedNumber } from 'pages/factory-permanent/format'

/*
 * The preview beside the wizard: the list as people will see it, what each
 * side sends (base deposit + arbitration cost, on one shared scale) and
 * what happens to it, the challenge period as a timeline from submission to
 * acceptance (the end written in UTC) and the court. Every number is read
 * from the wizard state and the arbitrator; nothing is an example.
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

const BlockTitle = styled(Label)`
  margin: 0;
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

  /* A plain marker: the pulse is kept for live on-chain states. */
  i {
    width: 6px;
    height: 6px;
    border-radius: var(--radius-pill);
    background: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-soft);
  }
`

/* ---------- Deposits ---------- */

const BlockHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
`

const Side = styled.div`
  & + & {
    margin-top: 14px;
  }
`

const SideTop = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
`

const Amount = styled.span`
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: 28px;
  line-height: 32px;
  font-weight: 500;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  small {
    margin-left: 6px;
    color: var(--color-muted);
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0;
  }
`

const hatch = `repeating-linear-gradient(
  -45deg,
  color-mix(in srgb, var(--color-primary) 62%, transparent) 0 2px,
  color-mix(in srgb, var(--color-primary) 16%, transparent) 2px 5px
)`

/* The one accent, flat: the aurora is the stage's light, never chrome
   (it read pastel on Light and purple on Kleros). */
const baseFill = 'var(--color-primary)'

const Bar = styled.div`
  display: flex;
  gap: 2px;
  height: 10px;
  border-radius: var(--radius-pill);
  background: var(--color-raised);
  overflow: hidden;
`

const Segment = styled.span<{ $kind: 'base' | 'cost' }>`
  display: block;
  flex: 0 0 auto;
  /* A non-zero part stays visible even when it is a sliver of the total. */
  min-width: 4px;
  height: 100%;
  border-radius: var(--radius-pill);
  background: ${({ $kind }) => ($kind === 'base' ? baseFill : hatch)};
  box-shadow: ${({ $kind }) =>
    $kind === 'base'
      ? '0 0 12px color-mix(in srgb, var(--color-primary) 55%, transparent)'
      : 'none'};
  transition: width 900ms var(--ease-out);

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

/** The breakdown under a bar doubles as its legend: swatch, amount, name. */
const Breakdown = styled.span`
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

/* ---------- Challenge period timeline ---------- */

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

const wipe = keyframes`
  from { clip-path: inset(0 100% 0 0 round 999px); }
  to { clip-path: inset(0 0 0 0 round 999px); }
`

const Timeline = styled.div`
  position: relative;
  height: 14px;
  margin: 14px 0 0;
`

const Window = styled.span<{ $empty?: boolean }>`
  position: absolute;
  top: 3px;
  left: 0;
  right: 0;
  height: 8px;
  border-radius: var(--radius-pill);
  background: ${({ $empty }) => ($empty ? 'var(--color-raised)' : baseFill)};
  box-shadow: ${({ $empty }) =>
    $empty
      ? 'none'
      : '0 0 14px color-mix(in srgb, var(--color-primary) 50%, transparent)'};
  animation: ${wipe} 900ms var(--ease-out) both;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
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

const Node = styled.span<{ $at: 'start' | 'end' }>`
  position: absolute;
  top: 0;
  ${({ $at }) => ($at === 'start' ? 'left: -1px;' : 'right: -1px;')}
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-surface);
  border-radius: var(--radius-pill);
  background: ${({ $at }) =>
    $at === 'start' ? 'var(--color-primary)' : 'var(--status-registered)'};
  box-shadow: 0 0 0 3px
    color-mix(
      in srgb,
      ${({ $at }) =>
          $at === 'start' ? 'var(--color-primary)' : 'var(--status-registered)'}
        28%,
      transparent
    );
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

const PeriodTimeline = ({ hours }: { hours: number }) => {
  // Re-read every minute so the acceptance time stays "if submitted now".
  const now = useNow(60_000)
  const valid = Number.isFinite(hours) && hours > 0
  const seconds = valid ? Math.round(hours * 3600) : 0
  const end = now + seconds
  const ticks = valid ? axisTicks(hours) : []

  return (
    <>
      <BlockTitle as="h3" $tone="muted">
        Challenge period
      </BlockTitle>
      <PeriodTop>
        <PeriodFigure $empty={!valid}>
          {valid ? formatDuration(seconds) : 'Not set'}
        </PeriodFigure>
        {valid && (
          <PeriodEnd>
            <strong>Accepted if unchallenged</strong>
            <span title={`${formatDurationLong(seconds)} after submission`}>
              {formatAbsolute(end)}
            </span>
          </PeriodEnd>
        )}
      </PeriodTop>
      <Timeline
        role="img"
        aria-label={
          valid
            ? `Challenge period ${formatDurationLong(seconds)}: submitted now, accepted on ${formatAbsolute(end)} if nobody challenges.`
            : 'Challenge period not set'
        }
      >
        <Window $empty={!valid} key={valid ? 'set' : 'unset'} />
        {ticks.map((at, index) => (
          <Cut key={index} style={{ left: `${(at / hours) * 100}%` }} />
        ))}
        <Node $at="start" />
        {valid && <Node $at="end" />}
      </Timeline>
      <Axis aria-hidden>
        <span data-edge="start">Now</span>
        {ticks.map((at, index) => {
          const share = at / hours
          // Leave room for the start label and the end node.
          if (share < 0.14 || share > 0.92) return null
          return (
            <span key={index} style={{ left: `${share * 100}%` }}>
              {formatDuration(at * 3600)}
            </span>
          )
        })}
      </Axis>
    </>
  )
}

/* ---------- Deposit bars ---------- */

type SideFigures = {
  label: string
  base: unknown
}

const toNumber = (value: BigNumber | null): number | undefined => {
  const formatted = formatNative(value)
  return formatted === null ? undefined : Number(formatted)
}

const SideBar = ({
  side,
  arbitrationCost,
  scaleMax,
  currency,
}: {
  side: SideFigures
  arbitrationCost?: BigNumber | null
  scaleMax: number
  currency: string
}) => {
  const total = totalDeposit(side.base, arbitrationCost)
  const totalText = formatNative(total)
  const costText = formatNative(arbitrationCost)
  // As the review and the deploy read it: "0,5" is 0.5.
  const base = typedNumber(side.base)
  const cost = toNumber(arbitrationCost ?? null)
  const baseValid =
    side.base !== '' &&
    side.base !== undefined &&
    Number.isFinite(base) &&
    base >= 0
  const loading = arbitrationCost === undefined || arbitrationCost === null
  const baseShare = baseValid && scaleMax > 0 ? (base / scaleMax) * 100 : 0
  const costShare =
    cost !== undefined && scaleMax > 0 ? (cost / scaleMax) * 100 : 0

  return (
    <Side>
      <SideTop>
        <Label $tone="muted">{side.label}</Label>
        {totalText === null ? (
          loading ? (
            <SkeletonBlock $height="32px" $width="112px" />
          ) : (
            <Amount>
              <span aria-hidden>—</span>
              <VisuallyHidden>Not a valid amount</VisuallyHidden>
            </Amount>
          )
        ) : (
          <Amount>
            <AnimatedNumber
              value={Number(totalText)}
              format={amountFormat(totalText)}
            />
            <small>{currency}</small>
          </Amount>
        )}
      </SideTop>
      <Bar
        role="img"
        aria-label={
          totalText === null
            ? loading
              ? `${side.label}: waiting for the arbitration cost`
              : `${side.label}: the base deposit is not a valid amount`
            : `${side.label} ${groupThousands(totalText)} ${currency}: ${groupThousands(plainDecimal(side.base ?? 0))} base deposit and ${costText === null ? '…' : groupThousands(costText)} arbitration cost`
        }
      >
        {baseShare > 0 && (
          <Segment $kind="base" style={{ width: `${baseShare}%` }} />
        )}
        {costShare > 0 && (
          <Segment $kind="cost" style={{ width: `${costShare}%` }} />
        )}
      </Bar>
      <Breakdown aria-hidden>
        <span>
          <i style={{ background: baseFill }} />
          {baseValid ? groupThousands(plainDecimal(side.base)) : '—'} base
          deposit
        </span>
        <span>
          <i style={{ background: hatch }} />
          {costText === null ? '…' : groupThousands(costText)} arbitration cost
        </span>
      </Breakdown>
    </Side>
  )
}

/* ---------- The panel ---------- */

type Subject = 'list' | 'badges'

export const LivePreview = ({
  tcrState,
  subject,
  chainId,
  currency,
}: {
  tcrState: TcrState
  /** The badges list while its step is open and it is switched on. */
  subject: Subject
  chainId: number
  currency: string
}) => {
  const [request, setRequest] = useState<'submission' | 'removal'>('submission')
  const library = useEthersProvider({ chainId })
  const badges = subject === 'badges'
  const arbitratorAddress = badges
    ? tcrState.relArbitratorAddress
    : tcrState.arbitratorAddress
  const extraData = badges
    ? tcrState.relArbitratorExtraData
    : tcrState.arbitratorExtraData
  const { arbitrationCost } = useArbitrationCost({
    address: arbitratorAddress,
    arbitratorExtraData: extraData,
    library,
  })

  const title = badges
    ? `${tcrState.tcrTitle || 'Your list'} enabled badges`
    : tcrState.tcrTitle
  const description = badges
    ? `A list of lists related to ${tcrState.tcrTitle || 'your list'}`
    : tcrState.tcrDescription
  const logo = !badges && tcrState.tcrLogo ? parseIpfs(tcrState.tcrLogo) : ''
  const itemName = badges ? tcrState.relItemName : tcrState.itemName
  const fieldCount = badges
    ? tcrState.relColumns.length
    : tcrState.isTCRofTCRs
      ? 1
      : tcrState.columns.length
  const article = getArticleFor(itemName)

  const sides: SideFigures[] =
    request === 'submission'
      ? [
          {
            label: badges ? 'Badge submitter sends' : 'Submitter sends',
            base: badges
              ? tcrState.relSubmissionBaseDeposit
              : tcrState.submissionBaseDeposit,
          },
          {
            label: 'Challenger sends',
            base: badges
              ? tcrState.relSubmissionChallengeBaseDeposit
              : tcrState.submissionChallengeBaseDeposit,
          },
        ]
      : [
          {
            label: 'Removal requester sends',
            base: badges
              ? tcrState.relRemovalBaseDeposit
              : tcrState.removalBaseDeposit,
          },
          {
            label: 'Challenger sends',
            base: badges
              ? tcrState.relRemovalChallengeBaseDeposit
              : tcrState.removalChallengeBaseDeposit,
          },
        ]
  const cost = toNumber(arbitrationCost ?? null) ?? 0
  const scaleMax = Math.max(
    ...sides.map((side) => {
      const base = typedNumber(side.base)
      return (Number.isFinite(base) && base > 0 ? base : 0) + cost
    }),
    0,
  )

  const hours = typedNumber(
    badges
      ? tcrState.relChallengePeriodDuration
      : tcrState.challengePeriodDuration,
  )

  return (
    <Panel $featured $padding="none">
      <Tag>
        <i aria-hidden />
        {badges ? 'Badges list preview' : 'Preview'}
      </Tag>

      <PreviewIdentity
        logo={logo}
        title={title}
        description={description}
        icon={badges ? 'layers' : 'registry'}
        meta={[
          `${fieldCount} ${fieldCount === 1 ? 'field' : 'fields'}`,
          !badges && tcrState.isTCRofTCRs ? 'list of lists' : '',
          itemName ? `Submit ${article} ${itemName.toLowerCase()}` : '',
        ]}
      />

      <Block>
        <BlockHead>
          <BlockTitle as="h3" $tone="muted">
            What each side sends
          </BlockTitle>
          <SegmentedControl
            ariaLabel="Request type"
            value={request}
            onChange={setRequest}
            options={[
              { value: 'submission', label: 'Submission' },
              { value: 'removal', label: 'Removal' },
            ]}
          />
        </BlockHead>
        {sides.map((side) => (
          <SideBar
            key={side.label}
            side={side}
            arbitrationCost={arbitrationCost}
            scaleMax={scaleMax}
            currency={currency}
          />
        ))}
        <Outcomes>
          <li>
            <CurateIcon name="check" size={18} />
            <span>
              <b>Unchallenged:</b> back in full
            </span>
          </li>
          <li data-con>
            <MinusIcon />
            <span>
              <b>Challenged:</b> the winner gets the loser’s base deposit
            </span>
          </li>
        </Outcomes>
      </Block>

      <Block>
        <PeriodTimeline hours={hours} />
      </Block>

      <Block>
        <PreviewCourtRow
          chainId={chainId}
          arbitratorAddress={arbitratorAddress}
          extraData={extraData}
        />
      </Block>
    </Panel>
  )
}
