import React, { useEffect, useState } from 'react'
import styled, { keyframes } from 'styled-components'
import useCountUp from 'hooks/use-count-up'
import { formatAbsolute, formatDuration } from 'utils/time'
import { reveal } from 'components/curate/motion/reveal'
import {
  ChainChip,
  Label,
  StatusDot,
  Surface,
  type StatusTone,
} from 'components/curate/primitives'
import { formatAmount, type Amount } from './amounts'
import { WindowSpan } from './window-span'
import { useInView } from './use-in-view'

/*
 * What happens next, as the page's featured panel: the exact amount sent
 * (counting up once the panel is in view), its breakdown drawn as a
 * part-of-whole bar when both parts share a currency, the registry's window
 * as a span of time from mining to its end, the outcomes as a small tree
 * whose dots are the entry's status at the end of each branch, the policy
 * link and the confirm action. Every figure comes from the registry.
 */

export interface ReceiptPart {
  key: string
  label: string
  amount?: Amount
  /** Bar and legend colour; text always stays in the text roles. */
  tone: 'primary' | 'faint'
}

export interface Outcome {
  key: string
  /** The entry's status at the end of this branch. */
  tone: StatusTone
  title: string
  status: string
  /**
   * The money at the end of this branch, e.g. "51.6 xDAI back"; one line per
   * asset or part when there are several ("−300 sDAI", "−36 xDAI").
   */
  figure?: string | string[]
  note?: string
  children?: Outcome[]
}

export interface WindowTerms {
  seconds: number
  /** "Challenge period" or "Submission period". */
  label: string
  /** The label of the window's end ("Ends", "Accepted"). */
  endLabel: string
  /** What a zero-length window means on this list. */
  noneText: string
}

const shortDate = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
})

const Panel = styled(Surface)`
  display: flex;
  flex-direction: column;
  padding: 22px 24px 20px;
  ${reveal}

  @media (max-width: 720px) {
    padding: 20px 18px 18px;
  }
`

const Block = styled.div`
  padding: 15px 0;
  border-top: 1px solid var(--glass-border);

  &:first-child {
    padding-top: 0;
    border-top: 0;
  }
`

const TopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
`

const Big = styled.div`
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 10px;
  color: var(--color-text);
  font-family: var(--font-figure, var(--font-display));
  font-size: clamp(44px, 2.2vw + 22px, 58px);
  line-height: 0.95;
  font-weight: 500;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;

  small {
    color: var(--color-muted);
    font-size: 22px;
    line-height: 1;
    font-weight: 500;
    letter-spacing: -0.02em;
  }
`

const Extra = styled.div`
  margin-top: 10px;
  color: var(--color-muted);
  font-size: var(--fs-body-lg);
  line-height: var(--lh-body-lg);

  b {
    color: var(--color-text);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
`

const grow = keyframes`
  from { transform: scaleX(0); opacity: 0; }
  to { transform: scaleX(1); opacity: 1; }
`

/** Exact text for screen readers next to the animated digits. */
const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
`

const Bar = styled.div`
  display: flex;
  gap: 3px;
  height: 8px;
  margin: 16px 0 10px;
`

const BarPart = styled.span<{ $share: number; $tone: string; $delay: number }>`
  display: block;
  flex: 0 0 auto;
  width: ${({ $share }) => `calc(${($share * 100).toFixed(3)}% - 1.5px)`};
  min-width: 4px;
  border-radius: var(--radius-pill);
  background: var(--color-${({ $tone }) => $tone});
  box-shadow: ${({ $tone }) =>
    $tone === 'primary'
      ? '0 0 14px color-mix(in srgb, var(--color-primary) 55%, transparent)'
      : 'none'};
  transform-origin: left center;
  animation: ${grow} 900ms cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: ${({ $delay }) => $delay}ms;
  animation-play-state: paused;

  [data-in-view='true'] & {
    animation-play-state: running;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const Legend = styled.dl`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px 16px;
  margin: 0;

  dt {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    color: var(--color-muted);
    font-size: var(--fs-body);
    line-height: var(--lh-body);
  }

  dd {
    margin: 0;
    color: var(--color-text);
    font-size: var(--fs-body);
    line-height: var(--lh-body);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    text-align: right;
    white-space: nowrap;
  }

  i {
    flex: 0 0 auto;
    width: 8px;
    height: 8px;
    border-radius: var(--radius-pill);
  }
`

/**
 * Two labels on one baseline, the duration and the end date on the next:
 * filled column by column, so each label is read before its value.
 */
const WindowTop = styled.div`
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  grid-template-rows: auto auto;
  grid-auto-flow: column;
  align-items: baseline;
  gap: 6px 16px;

  > :nth-child(n + 3) {
    justify-self: end;
    text-align: right;
  }
`

const WindowFigure = styled.div`
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: 28px;
  line-height: 30px;
  font-weight: 500;
  letter-spacing: -0.035em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

const WindowEnd = styled.strong`
  color: var(--color-text);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  text-wrap: balance;
`

const NoWindow = styled.p`
  margin: 6px 0 0;
  color: var(--color-muted);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
`

const Tree = styled.ol`
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
`

/** A branch under a node: elbows run from the parent's dot to each child. */
const Branch = styled.ol`
  display: flex;
  flex-direction: column;
  gap: 12px;
  grid-column: 1 / -1;
  margin: 12px 0 0;
  padding: 0 0 0 22px;
  list-style: none;
`

const Node = styled.li`
  position: relative;
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 1px 12px;

  > span:first-child {
    transform: translateY(-1px);
  }

  ${Branch} > &::before,
  ${Branch} > &:not(:last-child)::after {
    content: '';
    position: absolute;
    left: -18px;
    border-left: 1px solid var(--color-border-strong);
    pointer-events: none;
  }

  ${Branch} > &::before {
    top: -12px;
    height: 21px;
    width: 12px;
    border-bottom: 1px solid var(--color-border-strong);
    border-bottom-left-radius: 6px;
  }

  ${Branch} > &:first-child::before {
    top: -20px;
    height: 29px;
  }

  ${Branch} > &:not(:last-child)::after {
    top: 9px;
    bottom: -12px;
  }
`

const NodeTitle = styled.div`
  min-width: 0;
  color: var(--color-text);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  font-weight: 500;
`

const NodeFigure = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  color: var(--color-text);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
`

/** The entry's status at the end of the branch, then what it means. */
const NodeNote = styled.div`
  grid-column: 2 / -1;
  color: var(--color-faint);
  font-size: var(--fs-small);
  line-height: var(--lh-small);

  b {
    color: var(--color-muted);
    font-weight: 500;
  }
`

const Policy = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 12px;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);

  svg {
    flex: 0 0 auto;
    margin-top: 1px;
    color: var(--color-primary);
  }
`

const PolicyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M7 3h7l5 5v13H7z M14 3v5h5 M10 13h6 M10 17h6"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

/**
 * Counts up to the exact amount once `run` is true, then prints the exact
 * string. Screen readers get the exact amount from hidden text, never the
 * moving digits.
 */
export const CountUpAmount = ({
  amount,
  run = true,
}: {
  amount: Amount
  run?: boolean
}) => {
  const text = formatAmount(amount.value, amount.decimals)
  const target = Number(text)
  const places = Math.min(6, (text.split('.')[1] ?? '').length)
  const current = useCountUp(
    run && Number.isFinite(target) ? target : undefined,
  )
  const settled = Math.abs(current - target) < 10 ** -(places + 1)
  return (
    <>
      <span aria-hidden>{settled ? text : current.toFixed(places)}</span>
      <VisuallyHidden>{text}</VisuallyHidden>
    </>
  )
}

const shareOf = (part: bigint, total: bigint): number =>
  total > 0n ? Number((part * 10000n) / total) / 10000 : 0

const OutcomeNode = ({ outcome }: { outcome: Outcome }) => (
  <Node>
    <StatusDot $tone={outcome.tone} aria-hidden />
    <NodeTitle>{outcome.title}</NodeTitle>
    <NodeFigure>
      {(Array.isArray(outcome.figure)
        ? outcome.figure
        : outcome.figure
          ? [outcome.figure]
          : []
      ).map((line) => (
        <span key={line}>{line}</span>
      ))}
    </NodeFigure>
    <NodeNote>
      <b>{outcome.status}</b>
      {outcome.note ? ` · ${outcome.note}` : ''}
    </NodeNote>
    {outcome.children && (
      <Branch>
        {outcome.children.map((child) => (
          <OutcomeNode key={child.key} outcome={child} />
        ))}
      </Branch>
    )}
  </Node>
)

/** Ticks once a minute: the window's end date moves with the clock. */
const useMinute = () => {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = window.setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      60_000,
    )
    return () => window.clearInterval(id)
  }, [])
  return now
}

export const DepositPanel = ({
  chainId,
  headline,
  extra,
  parts,
  period: terms,
  outcomes,
  policy,
  action,
  className,
}: {
  chainId?: number
  /** The amount in the big figure (the total, or the stake). */
  headline?: Amount
  /** A second asset sent with it (Stake Curate's arbitration deposit). */
  extra?: { label: string; amount?: Amount }
  parts: ReceiptPart[]
  period?: WindowTerms
  outcomes: Outcome[]
  policy?: React.ReactNode
  action: React.ReactNode
  className?: string
}) => {
  const now = useMinute()
  const [topRef, topInView] = useInView<HTMLDivElement>()
  const known = parts.every((part) => part.amount)
  // The bar is a part-of-whole: only when every part is the same asset.
  const sameAsset =
    known &&
    parts.length > 1 &&
    parts.every((part) => part.amount?.symbol === parts[0].amount?.symbol)
  const sum = sameAsset
    ? parts.reduce((acc, part) => acc + (part.amount?.value ?? 0n), 0n)
    : 0n
  const end = terms ? now + terms.seconds : 0
  const endText = terms ? `${shortDate.format(new Date(end * 1000))} UTC` : ''

  return (
    <Panel
      $featured
      $padding="none"
      role="group"
      aria-label="What happens next"
      className={className}
      style={{ ['--i' as string]: 1 }}
    >
      <Block ref={topRef} data-in-view={topInView}>
        <TopRow>
          <Label $tone="faint">You send now</Label>
          {chainId ? <ChainChip chainId={chainId} size="sm" /> : null}
        </TopRow>
        <Big>
          {headline ? (
            <>
              <CountUpAmount amount={headline} run={topInView} />
              <small>{headline.symbol}</small>
            </>
          ) : (
            '—'
          )}
        </Big>
        {extra && (
          <Extra>
            +{' '}
            <b>
              {extra.amount
                ? formatAmount(extra.amount.value, extra.amount.decimals)
                : '—'}
            </b>{' '}
            {extra.amount?.symbol} {extra.label}
          </Extra>
        )}
        {sameAsset && (
          <Bar
            role="img"
            aria-label={`Breakdown of what you send: ${parts
              .map(
                (part) =>
                  `${part.label} ${Math.round(shareOf(part.amount!.value, sum) * 100)}%`,
              )
              .join(', ')}`}
          >
            {parts.map((part, index) => (
              <BarPart
                key={part.key}
                $share={shareOf(part.amount!.value, sum)}
                $tone={part.tone}
                $delay={300 + index * 120}
              />
            ))}
          </Bar>
        )}
        {sameAsset && (
          <Legend aria-label="Breakdown">
            {parts.map((part) => (
              <React.Fragment key={part.key}>
                <dt>
                  <i
                    style={{ background: `var(--color-${part.tone})` }}
                    aria-hidden
                  />
                  {part.label}
                </dt>
                <dd>
                  {part.amount
                    ? `${formatAmount(part.amount.value, part.amount.decimals)} ${part.amount.symbol}`
                    : '—'}
                </dd>
              </React.Fragment>
            ))}
          </Legend>
        )}
      </Block>

      {terms && (
        <Block>
          <WindowTop>
            <Label $tone="faint">{terms.label}</Label>
            <WindowFigure>
              {terms.seconds > 0 ? formatDuration(terms.seconds) : 'None'}
            </WindowFigure>
            {terms.seconds > 0 && (
              <>
                <Label $tone="faint">{terms.endLabel}</Label>
                <WindowEnd
                  title={`If the transaction is mined now: ${formatAbsolute(end)}`}
                >
                  ≈ {endText}
                </WindowEnd>
              </>
            )}
          </WindowTop>
          {terms.seconds > 0 ? (
            <WindowSpan
              seconds={terms.seconds}
              label={terms.label}
              endText={`about ${endText}`}
            />
          ) : (
            <NoWindow>{terms.noneText}</NoWindow>
          )}
        </Block>
      )}

      <Block>
        <Label $tone="faint">What happens next</Label>
        <Tree>
          {outcomes.map((outcome) => (
            <OutcomeNode key={outcome.key} outcome={outcome} />
          ))}
        </Tree>
      </Block>

      <Block style={{ paddingBottom: 0 }}>
        {policy && (
          <Policy>
            <PolicyIcon />
            <span>{policy}</span>
          </Policy>
        )}
        {action}
      </Block>
    </Panel>
  )
}

export default DepositPanel
