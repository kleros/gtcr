import React, { useEffect, useRef } from 'react'
import styled, { css, keyframes } from 'styled-components'
import { useParams, useSearchParams } from 'react-router-dom'
import useDocumentHead from 'hooks/use-document-head'
import { NETWORKS, NETWORKS_INFO, getNativeCurrency } from 'config/networks'
import { warmFactory, warmPermanentFactory } from 'bootstrap/app-router'
import {
  WIZARD_DEFAULTS as STAKE_DEFAULTS,
  defaultStakeToken,
} from 'pages/factory-permanent/defaults'
import {
  ButtonLink,
  Label,
  Page,
  Surface,
  VisuallyHidden,
} from 'components/curate/primitives'
import { litThumb, recessTrack } from 'components/ui/kit-styles'
import { reveal } from 'components/curate/motion/reveal'
import { ChainSwitch } from './chain-switch'
import { DepositFate, type FateSpec } from './deposit-fate'
import { STANDARD_WIZARD_DEFAULTS } from 'pages/factory/defaults'

/*
 * Launch a list (route /launch/:chainId): a choice between the two list
 * types that can be created today, Standard (Standard Curate) and Stake (Stake
 * Curate), on the chain from the URL. The two cards are the options of one
 * radio group and neither is chosen at first: the rim previews on hover and
 * focus and stays on the chosen card, whose foot then offers its factory.
 * The choice lives in `?kind=`, so it survives the back button and a chain
 * switch.
 *
 * One question decides between them — does the money come back? — so each
 * card is one vertical read of that question: what is put up and what the
 * kind is for, the verdict, the same drawing with one difference in it (see
 * ./deposit-fate), one sentence, and the starting fees in the chain's
 * currency. No period is quoted anywhere: the challenge window, the court
 * and the number of jurors are all the creator's to set in the factory, and
 * the Guide route carries both lifecycles in full.
 */

const SUPPORTED_CHAINS: number[] = [
  NETWORKS.ethereum,
  NETWORKS.gnosis,
  NETWORKS.sepolia,
]
const TESTNETS: number[] = [NETWORKS.sepolia]

/* Both kinds' defaults come from their wizards, so the page and a new list agree. */
const STANDARD_DEFAULTS = STANDARD_WIZARD_DEFAULTS

/* ---------- The two kinds ---------- */

const KINDS = {
  standard: {
    name: 'Standard list',
    href: (chainId: number) => `/factory/${chainId}`,
    preload: warmFactory,
  },
  stake: {
    name: 'Stake list',
    href: (chainId: number) => `/factory-permanent/${chainId}`,
    preload: warmPermanentFactory,
  },
} as const

type Kind = keyof typeof KINDS

const isKind = (value: string | null): value is Kind =>
  value === 'standard' || value === 'stake'

/* ---------- The one difference, drawn the same way twice ---------- */

const STANDARD_FATE: FateSpec = {
  fate: 'returned',
  milestone: 'Registered',
  description:
    'The submitter’s deposit at each step of an entry’s life, drawn as two steps and not to scale: held from submission, then returned in full once the entry is registered.',
}

const STAKE_FATE: FateSpec = {
  fate: 'locked',
  milestone: 'Accepted',
  description:
    'The submitter’s stake at each step of an entry’s life, drawn as two steps and not to scale: locked from submission, and still locked for as long as the entry stays listed.',
}

/* ---------- Header ---------- */

const Header = styled.header`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  text-align: center;

  > * {
    ${reveal}
  }

  @media (max-width: 720px) {
    align-items: flex-start;
    gap: 16px;
    text-align: left;
  }
`

const Title = styled.h1`
  margin: 4px 0 0;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: clamp(40px, 2.4vw + 22px, 56px);
  line-height: 1.02;
  font-weight: 500;
  letter-spacing: -0.035em;
  text-wrap: balance;

  em {
    font-style: normal;
    color: var(--color-primary);
  }
`

const Lede = styled.p`
  margin: 0;
  max-width: 50ch;
  color: var(--color-muted);
  font-size: 17px;
  line-height: 26px;
  text-wrap: balance;
`

/* ---------- The choice: two equal cards in one radio group ---------- */

/* The cards' rows, shared through subgrid so the two cards line up. */
const CARD_ROWS = 7

const Choices = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  margin-top: 44px;

  @media (max-width: 960px) {
    grid-template-columns: minmax(0, 1fr);
  }

  @media (max-width: 720px) {
    margin-top: 32px;
    gap: 16px;
  }
`

/* The radio's dot: an empty ring that lights a core when chosen. */
const PickDot = styled.span`
  position: relative;
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
  border: 1.5px solid var(--color-faint);
  border-radius: 50%;
  transition: border-color var(--motion);

  &::after {
    content: '';
    position: absolute;
    inset: 2px;
    border-radius: 50%;
    background: var(--edge-2);
    box-shadow: 0 0 10px var(--edge-2);
    transform: scale(0);
    transition: transform var(--dur-control) var(--ease-spring);
  }
`

/*
 * The radio itself, in the selector language: a recessed pill that says
 * what it does ("Choose"), which becomes the raised, lit thumb ("Selected")
 * once chosen. The input is visually hidden but keeps the keyboard: Tab
 * enters the group, the arrows move and choose, Space chooses. Its name is
 * the visible verb plus the card's title ("Choose Standard list").
 */
const Pick = styled.label`
  position: relative;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 13px 0 9px;
  border-radius: var(--radius-pill);
  ${recessTrack}
  color: var(--color-muted);
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background var(--motion),
    box-shadow var(--motion),
    color var(--motion);

  input {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: 0;
    opacity: 0;
    pointer-events: none;
  }
`

const ringGradient = css`
  linear-gradient(
    120deg,
    var(--color-primary),
    var(--aurora-b) 28%,
    color-mix(in srgb, var(--color-warning) 70%, transparent) 48%,
    var(--aurora-c) 72%,
    var(--color-primary)
  )
`

const ringMask = css`
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
`

const Option = styled(Surface)`
  isolation: isolate;
  display: flex;
  flex-direction: column;
  padding: 28px;
  ${reveal}

  /* Side by side, the cards share their rows: the drawings line up. */
  @supports (grid-template-rows: subgrid) {
    display: grid;
    grid-row: span ${CARD_ROWS};
    grid-template-rows: subgrid;
    row-gap: 0;
  }

  /* A click anywhere on a card not yet chosen chooses it. */
  &:not([data-checked]) {
    cursor: pointer;
  }

  /* The encircling: previewed on hover and focus, held while chosen. */
  &::before {
    content: '';
    position: absolute;
    inset: -1px;
    z-index: 2;
    padding: 1.5px;
    border-radius: inherit;
    background: ${ringGradient};
    ${ringMask}
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--dur-control) var(--ease-out);
  }

  /* A single comet of light runs the rim when the card is chosen. */
  &::after {
    content: '';
    position: absolute;
    inset: -1.5px;
    z-index: 3;
    padding: 2px;
    border-radius: inherit;
    background: conic-gradient(
      from var(--cv-comet),
      transparent 0deg 290deg,
      color-mix(in srgb, var(--edge-2) 80%, transparent) 340deg,
      white 354deg,
      transparent 360deg
    );
    ${ringMask}
    opacity: 0;
    pointer-events: none;
  }

  @media (hover: hover) {
    &:hover::before {
      opacity: 0.45;
    }

    &:not([data-checked]):hover ${Pick} {
      color: var(--color-text);
    }

    &:not([data-checked]):hover ${PickDot} {
      border-color: var(--edge-2);
    }
  }

  &:has(input:focus-visible) {
    outline: 2px solid var(--color-primary);
    outline-offset: 4px;
  }

  &:has(input:focus-visible)::before {
    opacity: 0.8;
  }

  /* Chosen: the rim stays, light pools behind the pill and under the card. */
  &[data-checked] {
    background:
      radial-gradient(
        90% 55% at 100% 0%,
        color-mix(in srgb, var(--edge-2) 8%, transparent),
        transparent 70%
      ),
      var(--color-surface);
    box-shadow:
      inset 0 1px 0 var(--glass-highlight),
      0 0 0 4px color-mix(in srgb, var(--edge-1) 12%, transparent),
      var(--shadow-card),
      0 36px 90px -50px var(--edge-1);
  }

  &[data-checked]::before {
    padding: 2px;
    opacity: 1;
  }

  &[data-checked]::after {
    animation: cv-comet 2400ms cubic-bezier(0.45, 0, 0.2, 1) 1 both;
  }

  &[data-checked] ${Pick} {
    ${litThumb}
    color: var(--color-text);
  }

  &[data-checked] ${PickDot} {
    border-color: var(--edge-2);

    &::after {
      transform: scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    &::before {
      transition: none;
    }

    &::after {
      display: none;
    }
  }

  @media (max-width: 720px) {
    padding: 20px 16px;
  }
`

const CardHead = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`

const CardTitle = styled.h2`
  margin: 6px 0 0;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: 30px;
  line-height: 34px;
  font-weight: 500;
  letter-spacing: -0.03em;
`

/*
 * The card's eyebrow row: on the left what the drawing measures and over
 * what window, on the right what the kind is best for (the docs' "Best
 * for"). The same two slots in both cards, so the pair reads as a pair.
 */
const Lead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 16px;
  margin: 26px 0 0;

  span:last-child {
    text-align: right;
  }

  @media (max-width: 560px) {
    span:last-child {
      text-align: left;
    }
  }
`

/* The verdict on the money, in the display face. */
const Outcome = styled.p`
  margin: 8px 0 0;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: 28px;
  line-height: 32px;
  font-weight: 500;
  letter-spacing: -0.028em;
  text-wrap: balance;
`

/* Separated by space alone: a figure in a card is not a box in a box. */
const Drawing = styled.div`
  margin: 18px 0 0;
`

/* The one sentence a card is allowed beyond its drawing. */
const Note = styled.p`
  margin: 18px 0 0;
  color: var(--color-muted);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  text-wrap: pretty;
`

/*
 * What it costs to start, quietly: the figures the factory pre-fills, in the
 * currency they are paid in. The creator changes them in the next step, so
 * they are starting values and never a price.
 */
const Fees = styled.p`
  display: flex;
  flex-wrap: wrap;
  gap: 2px 10px;
  margin: 16px 0 0;
  padding-top: 14px;
  border-top: 1px solid var(--glass-border);
  color: var(--color-faint);
  font-size: var(--fs-meta);
  line-height: 18px;

  span + span::before {
    content: '·';
    margin-right: 8px;
    color: var(--color-border-strong);
  }

  b {
    color: var(--color-muted);
    font-family: var(--font-figure);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
`

const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M5 12h14m-5-5 5 5-5 5"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

/* ---------- The chosen card's foot: continue to its factory ---------- */

const footIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
`

/* In the card's own flow: nothing floats over the page. */
const Foot = styled.div`
  display: flex;
  align-items: center;
  margin: 24px 0 0;
  padding-top: 20px;
  border-top: 1px solid var(--glass-border);
  /* Brought into view on a pick: some room under the button. */
  scroll-margin-bottom: 32px;
  animation: ${footIn} 360ms var(--ease-out) both;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }

  @media (max-width: 560px) {
    > * {
      width: 100%;
    }
  }
`

/* ---------- One option of the radio group ---------- */

const prefersReducedMotion = () =>
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** True when the click ended a text selection inside `node`. */
const selectingText = (node: Node) => {
  const selection = window.getSelection()
  return Boolean(
    selection &&
    !selection.isCollapsed &&
    selection.anchorNode &&
    node.contains(selection.anchorNode),
  )
}

const Choice = ({
  kind,
  family,
  summary,
  checked,
  onChoose,
  chainId,
  index,
  children,
}: {
  kind: Kind
  /** The Curate product it is built on, the eyebrow above the name. */
  family: string
  /** One sentence for screen readers: what sets this kind apart. */
  summary: string
  checked: boolean
  onChoose: (kind: Kind) => void
  chainId: number
  index: number
  children: React.ReactNode
}) => {
  const { name, href, preload } = KINDS[kind]
  const titleId = `launch-${kind}`
  const verbId = `launch-${kind}-verb`
  const summaryId = `launch-${kind}-summary`
  const footRef = useRef<HTMLDivElement>(null)
  // Set by a pick on this card, so a choice the URL restores never scrolls.
  const picked = useRef(false)
  const pick = () => {
    picked.current = true
    onChoose(kind)
  }

  // The button that goes on opens at the card's foot, under the fold when
  // the card is chosen from its head: bring it into view.
  useEffect(() => {
    if (!checked || !picked.current) return
    picked.current = false
    footRef.current?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'nearest',
    })
  }, [checked])

  /*
   * Pointer convenience on top of the native radio (which keeps the
   * keyboard path): a click on the card's text chooses it, unless it lands
   * on a control or ends a text selection, so the text stays selectable.
   */
  const onCardClick = (event: React.MouseEvent<HTMLElement>) => {
    if (checked) return
    const target = event.target as Element
    if (target.closest('a, button, label, input')) return
    if (selectingText(event.currentTarget)) return
    pick()
  }

  return (
    <Option
      $padding="none"
      data-checked={checked ? '' : undefined}
      onClick={onCardClick}
      onPointerEnter={() => preload()}
      style={{ ['--i' as string]: index }}
    >
      <CardHead>
        <div>
          <Label $tone="faint">{family}</Label>
          <CardTitle id={titleId}>{name}</CardTitle>
        </div>
        <Pick>
          <input
            type="radio"
            name="launch-kind"
            value={kind}
            checked={checked}
            onChange={pick}
            aria-labelledby={`${verbId} ${titleId}`}
            aria-describedby={summaryId}
          />
          <PickDot aria-hidden />
          <span id={verbId} aria-hidden>
            {checked ? 'Selected' : 'Choose'}
          </span>
        </Pick>
      </CardHead>
      <VisuallyHidden id={summaryId}>{summary}</VisuallyHidden>
      {children}
      {checked && (
        <Foot ref={footRef}>
          <ButtonLink
            to={href(chainId)}
            $variant="primary"
            onMouseEnter={() => preload()}
            onFocus={() => preload()}
          >
            Create a {name}
            <ArrowIcon />
          </ButtonLink>
        </Foot>
      )}
    </Option>
  )
}

/* ---------- Page ---------- */

const LaunchListPage = () => {
  const { chainId: chainParam } = useParams()
  const parsedChainId = Number(chainParam)
  const chainId = SUPPORTED_CHAINS.includes(parsedChainId)
    ? parsedChainId
    : NETWORKS.gnosis
  const chain = NETWORKS_INFO[chainId as keyof typeof NETWORKS_INFO]
  const chainName = chain?.name ?? `chain ${chainId}`
  const symbol = getNativeCurrency(chainId).symbol
  const stakeToken = defaultStakeToken[chainId]?.label

  // The chosen kind lives in the URL; nothing is chosen until someone picks.
  const [searchParams, setSearchParams] = useSearchParams()
  const kindParam = searchParams.get('kind')
  const kind = isKind(kindParam) ? kindParam : undefined
  const choose = (next: Kind) => {
    KINDS[next].preload()
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous)
        params.set('kind', next)
        return params
      },
      { replace: true, preventScrollReset: true },
    )
  }

  useDocumentHead(
    'Launch a list | Kleros Curate',
    'Create a Kleros Curate list: a Standard list, where a submitter’s deposit comes back in full once the entry is registered, or a Stake list, where the stake stays locked while the entry is listed and a challenger can earn it at any time.',
  )

  return (
    <Page>
      <Header>
        <ChainSwitch
          chainId={chainId}
          chains={SUPPORTED_CHAINS}
          testnets={TESTNETS}
          style={{ ['--i' as string]: 0 }}
        />
        <Title style={{ ['--i' as string]: 1 }}>
          Launch a list on <em>{chainName}</em>
        </Title>
        <Lede style={{ ['--i' as string]: 2 }}>
          Either kind sends its disputes to Kleros: you pick the court and the
          number of jurors when you create the list.
        </Lede>
      </Header>

      <Choices role="group" aria-label="List type">
        <Choice
          kind="standard"
          family="Standard Curate"
          summary="The submitter’s deposit comes back in full once the entry is registered; a registered entry can still be removed later through a removal request."
          checked={kind === 'standard'}
          onChoose={choose}
          chainId={chainId}
          index={3}
        >
          <Lead>
            <Label $tone="faint">Deposit over an entry’s life</Label>
            <Label $tone="faint">
              <VisuallyHidden>Best for: </VisuallyHidden>
              One-time verification
            </Label>
          </Lead>
          <Outcome>Returned in full</Outcome>

          <Drawing>
            <DepositFate spec={STANDARD_FATE} delay={700} />
          </Drawing>

          <Note>A registered entry can still be removed later.</Note>

          <Fees>
            <span>Starting fees in {symbol}</span>
            <span>
              submit <b>{STANDARD_DEFAULTS.submissionBaseDeposit}</b>
            </span>
            <span>
              removal <b>{STANDARD_DEFAULTS.removalBaseDeposit}</b>
            </span>
            <span>plus the court’s fee</span>
          </Fees>
        </Choice>

        <Choice
          kind="stake"
          family="Stake Curate"
          summary="The submitter’s stake stays locked for as long as the entry is listed, so anyone can challenge it at any time; win a challenge and the challenger’s stake joins your entry’s."
          checked={kind === 'stake'}
          onChoose={choose}
          chainId={chainId}
          index={4}
        >
          <Lead>
            <Label $tone="faint">Stake over an entry’s life</Label>
            <Label $tone="faint">
              <VisuallyHidden>Best for: </VisuallyHidden>
              Continuous compliance
            </Label>
          </Lead>
          <Outcome>Locked while listed</Outcome>

          <Drawing>
            <DepositFate spec={STAKE_FATE} delay={780} />
          </Drawing>

          <Note>
            Win a challenge and the challenger’s stake joins your entry’s.
          </Note>

          <Fees>
            {stakeToken ? (
              <>
                <span>Starting stake in {stakeToken}</span>
                <span>
                  minimum <b>{STAKE_DEFAULTS.submissionMinDeposit}</b>
                </span>
              </>
            ) : (
              <span>Stake in any ERC-20</span>
            )}
            <span>plus the court’s fee in {symbol}</span>
          </Fees>
        </Choice>
      </Choices>
    </Page>
  )
}

export default LaunchListPage
