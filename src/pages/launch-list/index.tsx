import React from 'react'
import styled, { css, keyframes } from 'styled-components'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import useDocumentHead from 'hooks/use-document-head'
import { NETWORKS, NETWORKS_INFO, getNativeCurrency } from 'config/networks'
import { formatDuration, formatDurationLong } from 'utils/time'
import { preloadFactory, preloadPermanentFactory } from 'bootstrap/app-router'
import {
  WIZARD_DEFAULTS as STAKE_DEFAULTS,
  defaultStakeToken,
} from 'pages/factory-permanent/defaults'
import { CurateIcon } from 'components/curate/icons'
import {
  ButtonAnchor,
  ButtonLink,
  Label,
  Page,
  Surface,
  VisuallyHidden,
} from 'components/curate/primitives'
import { litThumb, recessTrack } from 'components/ui/kit-styles'
import { reveal } from 'components/curate/motion/reveal'
import { ChainSwitch } from './chain-switch'
import { Lifecycle, axisScale, type LifecycleSpec } from './lifecycle'

/*
 * Launch a list (route /launch/:chainId): a choice between the two list
 * types that can be created today, Light (Light Curate) and Stake (Stake
 * Curate), on the chain from the URL. The two cards are the options of one
 * radio group and neither is chosen at first: the rim previews on hover and
 * focus and stays on the chosen card, whose foot then offers its factory.
 * The choice lives in `?kind=`, so it survives the back button and a chain
 * switch. Each card leads with what the two sides get (the submitter's
 * money back, the challenger's bounty), then the wizard defaults the creator
 * can change, an entry's life drawn to scale under the default periods (one
 * time axis for both cards), and one advantage and one trade-off. The
 * court, and so the arbitration fee and the number of jurors, is the
 * creator's pick in the factory: this page shows no figure for it. Then a
 * note that Classic lists can no longer be created, and the assisted route.
 */

const SUPPORTED_CHAINS: number[] = [
  NETWORKS.ethereum,
  NETWORKS.gnosis,
  NETWORKS.sepolia,
]
const TESTNETS: number[] = [NETWORKS.sepolia]

const HOUR = 60 * 60

/*
 * The Light wizard's defaults. They live inside the factory's state hook
 * (pages/factory/index.tsx, initialWizardState) and are not exported, so
 * they are mirrored here: keep the two in sync. The Stake defaults are
 * imported from the Stake factory.
 */
const STANDARD_DEFAULTS = {
  submissionBaseDeposit: 0.05,
  removalBaseDeposit: 0.05,
  challengePeriodDuration: 84,
} as const

const CONTACT_HREF =
  'mailto:contact@kleros.io?subject=Launch%20a%20Curate%20list'

/* ---------- The two kinds ---------- */

const KINDS = {
  standard: {
    name: 'Light list',
    href: (chainId: number) => `/factory/${chainId}`,
    preload: preloadFactory,
  },
  stake: {
    name: 'Stake list',
    href: (chainId: number) => `/factory-permanent/${chainId}`,
    preload: preloadPermanentFactory,
  },
} as const

type Kind = keyof typeof KINDS

const isKind = (value: string | null): value is Kind =>
  value === 'standard' || value === 'stake'

/* ---------- Lifecycles, on one shared scale ---------- */

const challengePeriod = STANDARD_DEFAULTS.challengePeriodDuration * HOUR
const submissionPeriod = STAKE_DEFAULTS.submissionPeriodDuration * HOUR
const withdrawingPeriod = STAKE_DEFAULTS.withdrawingPeriodDuration * HOUR

const STANDARD_LIFE: LifecycleSpec = {
  phases: [
    {
      label: 'Submitted',
      tone: 'window',
      duration: challengePeriod,
      challengeable: true,
    },
    { label: 'Registered', tone: 'registered' },
    {
      label: 'Removal requested',
      tone: 'window',
      duration: challengePeriod,
      optional: true,
      note: ['if someone requests it', 'if requested'],
      challengeable: true,
    },
  ],
  endLabel: 'Removed',
  funds: { lane: 'Deposit locked', until: 0, label: 'Back in full' },
  description: `Light list, default periods: an entry can be challenged during its ${formatDurationLong(challengePeriod)} challenge period, while its deposit is locked. If nobody challenges, it is registered and the deposit is back in full. Once registered, it can be challenged again only if someone requests its removal, during another ${formatDurationLong(challengePeriod)} period, after which it is removed.`,
}

const STAKE_LIFE: LifecycleSpec = {
  phases: [
    {
      label: 'Pending',
      tone: 'window',
      duration: submissionPeriod,
      challengeable: true,
    },
    { label: 'Accepted', tone: 'registered', challengeable: true },
    {
      label: 'Withdrawing',
      tone: 'neutral',
      duration: withdrawingPeriod,
      optional: true,
      note: ['if the submitter withdraws', 'if withdrawn'],
      challengeable: true,
    },
  ],
  endLabel: 'Withdrawn',
  funds: { lane: 'Stake locked', until: 2, label: 'Stake back' },
  description: `Stake list, default periods: an entry is pending for its ${formatDurationLong(submissionPeriod)} submission period, then accepted. It can be challenged at any time until it is withdrawn, and its stake stays locked for that whole time. If the submitter withdraws, the stake comes back after a ${formatDurationLong(withdrawingPeriod)} withdrawing period.`,
}

const SCALE = axisScale([STANDARD_LIFE, STAKE_LIFE])

/* ---------- Header ---------- */

const Header = styled.header`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 16px 0 0;
  text-align: center;

  > * {
    ${reveal}
  }

  @media (max-width: 720px) {
    align-items: flex-start;
    gap: 16px;
    padding-top: 8px;
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
 * the visible verb plus the card's title ("Choose Light list").
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
 * The card's lead: what each side gets. The submitter's deposit comes back
 * (green, as on the drawing's funds lane); a challenger who shows the entry
 * breaks the rules earns a bounty (amber, the contested tone). Side by side
 * in a wide card, stacked in a narrow one: two cards between 961 and 1180px,
 * or a phone. (Media queries: the styled-components 5 parser drops
 * container queries.)
 */
const narrowCard = (rules: ReturnType<typeof css>) => css`
  @media (min-width: 961px) and (max-width: 1180px), (max-width: 560px) {
    ${rules}
  }
`

const Sides = styled.dl`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 28px 0 0;

  ${narrowCard(css`
    grid-template-columns: minmax(0, 1fr);
  `)}
`

const Side = styled.div<{ $tone: 'registered' | 'contested' }>`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding-right: 24px;

  & + & {
    padding: 0 0 0 24px;
    border-left: 1px solid var(--glass-border);
  }

  dt {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  dt i {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-pill);
    background: ${({ $tone }) => `var(--status-${$tone})`};
    box-shadow: 0 0 0 3px ${({ $tone }) => `var(--status-${$tone}-soft)`};
  }

  dd {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
  }

  ${narrowCard(css`
    padding-right: 0;

    & + & {
      margin-top: 18px;
      padding: 18px 0 0;
      border-top: 1px solid var(--glass-border);
      border-left: 0;
    }
  `)}
`

/* The side's outcome, in the display face; durations in the figure face. */
const Outcome = styled.span`
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: 24px;
  line-height: 28px;
  font-weight: 500;
  letter-spacing: -0.025em;
  text-wrap: balance;

  b {
    font-family: var(--font-figure);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    white-space: nowrap;
  }
`

const Condition = styled.span`
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
`

/* The wizard defaults behind the card, all of them the creator's to change. */
const Defaults = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 26px 0 0;
  padding-top: 20px;
  border-top: 1px solid var(--glass-border);

  dl {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 28px;
    margin: 0;
  }

  dl > div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  dt {
    color: var(--color-muted);
    font-size: 12px;
    line-height: 16px;
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

  dd small {
    margin-left: 4px;
    color: var(--color-muted);
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 400;
  }
`

const Drawing = styled.div`
  margin: 22px 0 0;
  padding: 22px 0 20px;
  border-top: 1px solid var(--glass-border);
  border-bottom: 1px solid var(--glass-border);
`

const Points = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 22px 0 0;
  padding: 0;
  list-style: none;
`

const Point = styled.li<{ $con?: boolean }>`
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 10px;
  color: ${({ $con }) => ($con ? 'var(--color-muted)' : 'var(--color-text)')};
  font-size: var(--fs-body);
  line-height: var(--lh-body);

  svg {
    margin-top: 1px;
    color: ${({ $con }) =>
      $con ? 'var(--color-faint)' : 'var(--color-primary)'};
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

const MinusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M7 12h10"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
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

/* ---------- Classic note, Pro ---------- */

const ClassicNote = styled.p`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 24px 0 0;
  padding: 0 4px;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  ${reveal}

  svg {
    flex: 0 0 auto;
    margin-top: 1px;
    color: var(--color-faint);
  }

  a {
    font-weight: 500;
    white-space: nowrap;
  }

  @media (max-width: 720px) {
    padding: 0;
  }
`

const Pro = styled(Surface)`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 20px 32px;
  margin-top: 32px;
  padding: 20px 24px;
  ${reveal}

  h2 {
    margin: 4px 0 2px;
    color: var(--color-text);
    font-family: var(--font-display);
    font-size: 20px;
    line-height: 24px;
    font-weight: 500;
    letter-spacing: -0.02em;
  }

  p {
    margin: 0;
    color: var(--color-muted);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
  }

  @media (max-width: 720px) {
    grid-template-columns: minmax(0, 1fr);
    padding: 18px 16px;
  }
`

const ProActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`

/* ---------- One option of the radio group ---------- */

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
    onChoose(kind)
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
            onChange={() => onChoose(kind)}
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
        <Foot>
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

  const period = formatDuration(challengePeriod)
  const withdrawing = formatDuration(withdrawingPeriod)

  useDocumentHead(
    'Launch a list | Kleros Curate',
    'Create a Kleros Curate list: a Light list, where a submitter’s deposit comes back after the challenge period, or a Stake list, where the stake stays locked while the entry is listed and a challenger can earn it at any time. Classic lists can no longer be created.',
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
          family="Light Curate"
          summary={`When the entry follows the rules, the submitter's deposit, in ${symbol}, comes back in full after the ${formatDurationLong(challengePeriod)} challenge period; a challenger who shows within that period that it breaks them earns its base deposit.`}
          checked={kind === 'standard'}
          onChoose={choose}
          chainId={chainId}
          index={3}
        >
          <Sides>
            <Side $tone="registered">
              <Label as="dt" $tone="faint">
                <i aria-hidden />
                Submitter
              </Label>
              <dd>
                <Outcome>
                  Back in <b>{period}</b>
                </Outcome>
                <Condition>
                  The whole deposit, when the entry follows the rules
                </Condition>
              </dd>
            </Side>
            <Side $tone="contested">
              <Label as="dt" $tone="faint">
                <i aria-hidden />
                Challenger
              </Label>
              <dd>
                <Outcome>Earns the base deposit</Outcome>
                <Condition>
                  For showing, within those {period}, that the entry breaks the
                  rules
                </Condition>
              </dd>
            </Side>
          </Sides>

          <Defaults>
            <Label $tone="faint">Defaults · you set them</Label>
            <dl>
              <div>
                <dt>Base deposit</dt>
                <dd>
                  {STANDARD_DEFAULTS.submissionBaseDeposit}
                  <small>{symbol}</small>
                </dd>
              </div>
              <div>
                <dt>Removal deposit</dt>
                <dd>
                  {STANDARD_DEFAULTS.removalBaseDeposit}
                  <small>{symbol}</small>
                </dd>
              </div>
              <div>
                <dt>Arbitration</dt>
                <dd>
                  Court’s fee<small>in {symbol}</small>
                </dd>
              </div>
            </dl>
          </Defaults>

          <Drawing>
            <Lifecycle spec={STANDARD_LIFE} scale={SCALE} delay={700} />
          </Drawing>

          <Points aria-label="Trade-offs">
            <Point>
              <CurateIcon name="check" size={18} />
              <span>
                <VisuallyHidden>Advantage: </VisuallyHidden>
                Only a hash goes on-chain; entry data lives on IPFS.
              </span>
            </Point>
            <Point $con>
              <MinusIcon />
              <span>
                <VisuallyHidden>Trade-off: </VisuallyHidden>
                Once registered, an entry can only be contested through a
                removal request.
              </span>
            </Point>
          </Points>
        </Choice>

        <Choice
          kind="stake"
          family="Stake Curate"
          summary={`The submitter's stake stays locked while the entry is listed and comes back ${formatDurationLong(withdrawingPeriod)} after withdrawing; a challenger who shows at any time that the entry breaks the rules earns the whole stake.`}
          checked={kind === 'stake'}
          onChoose={choose}
          chainId={chainId}
          index={4}
        >
          <Sides>
            <Side $tone="registered">
              <Label as="dt" $tone="faint">
                <i aria-hidden />
                Submitter
              </Label>
              <dd>
                <Outcome>Back on withdrawal</Outcome>
                <Condition>
                  Locked while listed, returned {withdrawing} after you withdraw
                </Condition>
              </dd>
            </Side>
            <Side $tone="contested">
              <Label as="dt" $tone="faint">
                <i aria-hidden />
                Challenger
              </Label>
              <dd>
                <Outcome>Earns the whole stake</Outcome>
                <Condition>
                  For showing, at any time, that the entry breaks the rules
                </Condition>
              </dd>
            </Side>
          </Sides>

          <Defaults>
            <Label $tone="faint">Defaults · you set them</Label>
            <dl>
              <div>
                {stakeToken ? (
                  <>
                    <dt>Minimum stake</dt>
                    <dd>
                      {STAKE_DEFAULTS.submissionMinDeposit}
                      <small>{stakeToken}</small>
                    </dd>
                  </>
                ) : (
                  <>
                    <dt>Stake token</dt>
                    <dd>Any ERC-20</dd>
                  </>
                )}
              </div>
              <div>
                <dt>Challenger stake</dt>
                <dd>
                  {STAKE_DEFAULTS.challengeStakeMultiplier}%
                  <small>of the entry’s</small>
                </dd>
              </div>
              <div>
                <dt>Arbitration</dt>
                <dd>
                  Court’s fee<small>in {symbol}</small>
                </dd>
              </div>
            </dl>
          </Defaults>

          <Drawing>
            <Lifecycle spec={STAKE_LIFE} scale={SCALE} delay={780} />
          </Drawing>

          <Points aria-label="Trade-offs">
            <Point>
              <CurateIcon name="check" size={18} />
              <span>
                <VisuallyHidden>Advantage: </VisuallyHidden>A failed challenge
                adds the challenger’s stake to the entry’s.
              </span>
            </Point>
            <Point $con>
              <MinusIcon />
              <span>
                <VisuallyHidden>Trade-off: </VisuallyHidden>
                Submitters approve and lock a token, and get it back only by
                withdrawing.
              </span>
            </Point>
          </Points>
        </Choice>
      </Choices>

      <ClassicNote style={{ ['--i' as string]: 5 }}>
        <CurateIcon name="help" size={16} />
        <span>
          Classic lists can no longer be created; existing ones keep working.{' '}
          <Link to="/guide">Read the guide</Link>
        </span>
      </ClassicNote>

      <Pro
        as="section"
        $padding="none"
        aria-labelledby="launch-pro"
        style={{ ['--i' as string]: 6 }}
      >
        <div>
          <Label $tone="faint">Assisted route</Label>
          <h2 id="launch-pro">Curate Pro</h2>
          <p>
            Policy drafting and review, a ready API and help with a dedicated
            front end.
          </p>
        </div>
        <ProActions>
          <ButtonLink to="/pro" $variant="secondary" $size="sm">
            See Curate Pro
          </ButtonLink>
          <ButtonAnchor href={CONTACT_HREF} $variant="ghost" $size="sm">
            Email the Kleros team
          </ButtonAnchor>
        </ProActions>
      </Pro>
    </Page>
  )
}

export default LaunchListPage
