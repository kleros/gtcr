import React, { useEffect, useRef } from 'react'
import styled, { css, keyframes } from 'styled-components'
import { useParams, useSearchParams } from 'react-router-dom'
import useDocumentHead from 'hooks/use-document-head'
import { NETWORKS, NETWORKS_INFO, getNativeCurrency } from 'config/networks'
import { warmFactory, warmPermanentFactory } from 'bootstrap/app-router'
import {
  ButtonLink,
  Label,
  Page,
  Surface,
  VisuallyHidden,
} from 'components/curate/primitives'
import { litThumb, recessTrack } from 'components/ui/kit-styles'
import { CurateIcon } from 'components/curate/icons'
import { reveal } from 'components/curate/motion/reveal'
import { ChainSwitch } from './chain-switch'
import { DepositFate, type FateSpec } from './deposit-fate'

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
 * card is one vertical read of that question, top to bottom: the kind's
 * name, what it is for, the verdict on the money, the same two-lane drawing
 * with one difference in it (see ./deposit-fate), two lines on how the money
 * moves and what to know before choosing, and the foot that holds the
 * choice. Each says one thing: the verdict is the money's fate, the drawing
 * names the events (on Standard, the removal request that can open a
 * registered entry to a challenge again, drawn dashed), the lines explain
 * them. The coin is named, after the name of the drawing's money lane, but
 * no figure and no period is quoted anywhere: the deposits, the challenge
 * window, the court and the number of jurors are all the creator's to set
 * in the factory, and the Guide route carries both lifecycles in full.
 */

const SUPPORTED_CHAINS: number[] = [
  NETWORKS.ethereum,
  NETWORKS.gnosis,
  NETWORKS.sepolia,
]
const TESTNETS: number[] = [NETWORKS.sepolia]

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

/**
 * Where the Standard deposit comes back, as a share of a lane with no axis:
 * about where the original lifecycle put registration (31% of its lane at
 * 1440). Not a measurement. A short bar beside the Stake card's full one is
 * what makes "one-time" visible; the dashed removal band at the lane's end
 * is as long, since a removal request runs on the same challenge period.
 */
const RETURNED_AT = 0.32

const STANDARD_FATE: FateSpec = {
  lane: 'Deposit locked',
  release: RETURNED_AT,
  event: 'Registered',
  removal: 'Removal request',
  description:
    'Drawn by event, not to scale. An entry is open to challenge from submission until it is registered; the deposit is locked for that time and comes back in full at registration. Once registered, it is open to challenge again only during a removal request, drawn dashed at the end, and only if someone makes one.',
}

const STAKE_FATE: FateSpec = {
  lane: 'Stake locked',
  release: 'end',
  event: 'Withdrawn',
  description:
    'Drawn by event, not to scale. An entry is open to challenge for as long as it is listed; the stake is locked for all of that time and comes back only when the submitter withdraws it.',
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

/*
 * The cards' rows, shared through subgrid so the two cards line up: one per
 * in-flow child of a card, in order the head, the eyebrow (Lead), the
 * verdict (Outcome), the drawing, the two lines (Points) and the foot. The
 * screen-reader summary is out of flow and takes none. Add or remove a child
 * and this must change with it, or the rows of the two cards drift apart.
 */
const CARD_ROWS = 6

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
      var(--sweep-head) 354deg,
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

  /*
   * Chosen: the rim stays, and light pools in the foot's corner, behind the
   * pill and the button it brings, and under the card.
   */
  &[data-checked] {
    background:
      radial-gradient(
        90% 55% at 0% 100%,
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

/* The kind's family and name; the choice itself sits at the card's foot. */
const CardHead = styled.div`
  min-width: 0;
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
 * What the kind is for (the docs' "Best for"), as the card's one eyebrow.
 * The visible "For" carries the meaning, so nothing is hidden for screen
 * readers, and a single label cannot pile into a second one on a phone.
 */
const Lead = styled.div`
  margin: 26px 0 0;
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
  margin: 20px 0 0;
`

/*
 * The two lines a card is allowed beyond its drawing: what the money does,
 * then the one thing about the kind a reader should know before choosing it.
 * Every line on the page takes the same check, so the pair reads as two
 * facts rather than as a score; the list's aria-label names the pair.
 */
const Points = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 18px 0 0;
  padding: 0;
  list-style: none;
`

const Point = styled.li`
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 10px;
  color: var(--color-text);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  text-wrap: pretty;

  svg {
    margin-top: 1px;
    color: var(--color-primary);
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

/* ---------- The card's foot: the choice, then its factory ---------- */

const footIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
`

/*
 * In the card's own flow, on both cards at all times: the radio sits where
 * reading ends, so an unchosen card has no empty block under its lines.
 * Choosing one adds its button. Where the button fits beside the pill, the
 * foot is as tall as that button from the start, so nothing moves when it
 * arrives. On a phone (see Go) it takes its own row under the pill instead,
 * so there the foot reserves nothing, which would only float the pill in an
 * empty band and let it jump when chosen: the chosen card grows by the
 * button's row, below where the reader tapped, and is scrolled until the
 * button shows.
 */
const Foot = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  /* The button's 44px, plus the padding and hairline above it. */
  min-height: calc(44px + 21px);
  margin: 24px 0 0;
  padding-top: 20px;
  border-top: 1px solid var(--glass-border);
  /* Brought into view on a pick: some room under the button. */
  scroll-margin-bottom: 32px;

  @media (max-width: 560px) {
    min-height: 0;
  }
`

/* The way on, which only the chosen card offers. */
const Go = styled.div`
  animation: ${footIn} 360ms var(--ease-out) both;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }

  /* On a phone the button takes its own full-width row under the pill. */
  @media (max-width: 560px) {
    flex: 1 1 100%;

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

  // The button that goes on opens in the card's foot, which can be under the
  // fold when the card is chosen by a click higher up, and which on a phone
  // grows a row for it under the pill: bring it into view.
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
        <Label $tone="faint">{family}</Label>
        <CardTitle id={titleId}>{name}</CardTitle>
      </CardHead>
      <VisuallyHidden id={summaryId}>{summary}</VisuallyHidden>
      {children}
      <Foot ref={footRef}>
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
        {checked && (
          <Go>
            <ButtonLink
              to={href(chainId)}
              $variant="primary"
              onMouseEnter={() => preload()}
              onFocus={() => preload()}
            >
              Create a {name}
              <ArrowIcon />
            </ButtonLink>
          </Go>
        )}
      </Foot>
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
  // The Standard deposit is in the chain's own coin: xDAI on Gnosis, ETH on
  // Ethereum and Sepolia. No figure goes with it (see the header comment).
  const coin = `in ${getNativeCurrency(chainId).symbol}`

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
          summary="The submitter’s deposit comes back in full once the challenge window closes with nobody challenging; once registered, an entry can only be contested through a removal request."
          checked={kind === 'standard'}
          onChoose={choose}
          chainId={chainId}
          index={3}
        >
          <Lead>
            <Label $tone="muted">For one-time verification</Label>
          </Lead>
          <Outcome>Returned in full</Outcome>

          <Drawing>
            <DepositFate spec={STANDARD_FATE} coin={coin} delay={700} />
          </Drawing>

          <Points aria-label="What this kind means">
            <Point>
              <CurateIcon name="check" size={18} />
              <span>
                The deposit comes back in full once the challenge window closes
                with nobody challenging.
              </span>
            </Point>
            <Point>
              <CurateIcon name="check" size={18} />
              <span>
                Once registered, an entry can only be contested through a
                removal request.
              </span>
            </Point>
          </Points>
        </Choice>

        <Choice
          kind="stake"
          family="Stake Curate"
          summary="The submitter’s stake stays locked until they withdraw it, so anyone can challenge the entry at any time and take the stake; a failed challenge adds the challenger’s stake to the entry’s."
          checked={kind === 'stake'}
          onChoose={choose}
          chainId={chainId}
          index={4}
        >
          <Lead>
            <Label $tone="muted">For continuous compliance</Label>
          </Lead>
          <Outcome>Locked while listed</Outcome>

          <Drawing>
            <DepositFate spec={STAKE_FATE} coin="in any ERC-20" delay={780} />
          </Drawing>

          <Points aria-label="What this kind means">
            <Point>
              <CurateIcon name="check" size={18} />
              <span>
                The stake stays locked until the submitter withdraws it, and a
                challenger can take it at any time until then.
              </span>
            </Point>
            <Point>
              <CurateIcon name="check" size={18} />
              <span>
                A failed challenge adds the challenger’s stake to the entry’s.
              </span>
            </Point>
          </Points>
        </Choice>
      </Choices>
    </Page>
  )
}

export default LaunchListPage
