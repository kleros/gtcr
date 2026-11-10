import React, { useEffect, useRef, useState } from 'react'
import styled, { css, keyframes } from 'styled-components'
import { Link } from 'react-router-dom'
import useDocumentHead from 'hooks/use-document-head'
import useCountUp from 'hooks/use-count-up'
import { CurateIcon, type CurateIconName } from 'components/curate/icons'
import {
  Button,
  ButtonAnchor,
  ButtonLink,
  HeroStatement,
  Label,
  Page,
  Small,
  Surface,
} from 'components/curate/primitives'
import { reveal } from 'components/curate/motion/reveal'
import { Explainer } from 'components/curate/explainer'
import useDisplayedChainId from 'pages/guide/use-displayed-chain-id'
import { ProductionStackSchematic } from './schematic'
import useInView from './use-in-view'

/*
 * Curate Pro (route /pro): the three ways to run a registry, compared in one
 * matrix. Every path uses the same permissionless contracts; the paid ones buy
 * speed, infrastructure and support. Rows are the layers around the contracts,
 * columns are the paths, and each cell's rail says who carries that layer:
 * Kleros runs it (lit), Kleros supports you on it (hatched), or you run it
 * (empty track). Then the creator prompt for agents and a collapsed explainer.
 */

const CREATOR_PROMPT = `You are helping me launch a production Kleros Curate registry.

Use the kleros-curate skill before taking action. Treat onchain values, MetaEvidence, policy files, deposits, challenge windows, and court parameters as live data that must be read, not guessed.

Goal:
- Turn the registry idea into clear acceptance criteria.
- Choose Light Curate or Stake Curate based on the workflow (Classic Curate is being deprecated).
- Draft or review the policy before launch.
- Prepare valid MetaEvidence and item schema.
- Decide whether we self-host, use Quickstart indexing, or buy Curate Pro support.
- Plan the submission to the Kleros list of lists on its chain, so the list can earn the Kleros Verified badge.
- Produce a launch checklist with risks, costs, dependencies, and next actions.`

const PROMPT_LINES = CREATOR_PROMPT.split('\n')

const contactHref = (subject: string) =>
  `mailto:contact@kleros.io?subject=${encodeURIComponent(subject)}`
const GUIDE_HREF = '/guide'
const SKILL_HREF = '/skills/kleros-curate/SKILL.md'

const COPIED_FOR_MS = 1800

type CopyState = 'idle' | 'copied' | 'failed'

type LayerKey = 'registry' | 'frontend' | 'indexing' | 'policy'

/** The pieces around the contracts that someone has to build and run. */
const LAYERS: { key: LayerKey; label: string }[] = [
  { key: 'registry', label: 'Registry' },
  { key: 'frontend', label: 'Frontend' },
  { key: 'indexing', label: 'Indexing' },
  { key: 'policy', label: 'Policy' },
]

/** Who carries a layer: Kleros runs it, Kleros supports you on it, or you. */
type Owner = 'runs' | 'supports' | 'you'

const OWNERS: { owner: Owner; text: string }[] = [
  { owner: 'runs', text: 'Kleros runs it' },
  { owner: 'supports', text: 'Kleros supports you' },
  { owner: 'you', text: 'You run it' },
]

const ownerText = (owner: Owner) =>
  OWNERS.find((entry) => entry.owner === owner)?.text ?? ''

interface Layer {
  owner: Owner
  /** Two to four words, shown in the cell. */
  label: string
  /** The full sentence, shown on hover or on a tap. */
  text: string
}

/** Free path: the launch chooser on the header's chain. Paid: an email. */
type TierAction =
  | { kind: 'launch'; label: string; icon: CurateIconName }
  | {
      kind: 'contact'
      label: string
      /** Names the plan in the email and in the phone's stacked buttons. */
      subject: string
      phoneLabel: string
    }

interface Tier {
  name: string
  path: string
  /** US dollars per month. */
  price: number
  priceDetail: string
  layers: Record<LayerKey, Layer>
  action: TierAction
}

const TIERS: Tier[] = [
  {
    name: 'Permissionless',
    path: 'Open path',
    price: 0,
    priceDetail: 'self-operated',
    layers: {
      registry: {
        owner: 'you',
        label: 'Deploy yourself',
        text: 'Deploy a registry yourself; no permission needed.',
      },
      frontend: {
        owner: 'you',
        label: 'Build and host',
        text: 'Build, host, and maintain your own frontend.',
      },
      indexing: {
        owner: 'you',
        label: 'Local or third\u2011party',
        text: 'Run local indexing or connect a third-party indexer.',
      },
      policy: {
        owner: 'you',
        label: 'Write and maintain',
        text: 'Write, publish, and maintain the policy; monitoring and operations are yours too.',
      },
    },
    action: { kind: 'launch', label: 'Create a registry', icon: 'factory' },
  },
  {
    name: 'Quickstart',
    path: 'Fastest path',
    price: 19.99,
    priceDetail: 'API access',
    layers: {
      registry: {
        owner: 'you',
        label: 'Deploy yourself',
        text: 'Deploy a registry yourself; no permission needed.',
      },
      frontend: {
        owner: 'you',
        label: 'Build and host',
        text: 'Build, host, and maintain your own frontend.',
      },
      indexing: {
        owner: 'runs',
        label: 'Ready API',
        text: 'A ready API for agents and frontends, instead of running the indexer.',
      },
      policy: {
        owner: 'you',
        label: 'Write and maintain',
        text: 'Write and maintain your own policy; product decisions stay in-house.',
      },
    },
    action: {
      kind: 'contact',
      label: 'Talk to Kleros',
      subject: 'Curate Quickstart',
      phoneLabel: 'Quickstart: talk to Kleros',
    },
  },
  {
    name: 'Curate Pro',
    path: 'Supported path',
    price: 199,
    priceDetail: 'managed support',
    layers: {
      registry: {
        owner: 'supports',
        label: 'Help with parameters',
        text: 'Launch with help on registry parameters.',
      },
      frontend: {
        owner: 'supports',
        label: 'Dedicated frontend',
        text: 'Support creating a dedicated frontend.',
      },
      indexing: {
        owner: 'runs',
        label: 'API and guidance',
        text: 'A ready API with operational support and guidance.',
      },
      policy: {
        owner: 'supports',
        label: 'Drafting and review',
        text: 'Policy drafting and review support.',
      },
    },
    action: {
      kind: 'contact',
      label: 'Talk to Kleros',
      subject: 'Curate Pro',
      phoneLabel: 'Pro: talk to Kleros',
    },
  },
]

const usd = (value: number) =>
  `$${Number.isInteger(value) ? value : value.toFixed(2)}`

const prices = TIERS.map((tier) => tier.price)
const lowestPrice = Math.min(...prices)
const highestPrice = Math.max(...prices)

const countOwned = (tier: Tier, owner: Owner) =>
  LAYERS.filter(({ key }) => tier.layers[key].owner === owner).length

/* ---------- Shared ---------- */

const SrOnly = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`

const ArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M5 12h14M13 6l6 6-6 6"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

/* ---------- Hero ---------- */

const Hero = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 8px 0 0;
  text-align: center;

  > * {
    ${reveal}
  }

  @media (max-width: 720px) {
    padding-top: 0;
    align-items: flex-start;
    text-align: left;
  }
`

const HeroPill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 32px;
  padding: 0 14px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  background: var(--color-raised);
  box-shadow: inset 0 1px 0 var(--glass-highlight);
  color: var(--color-muted);
  font-size: 13px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;

  b {
    color: var(--color-primary);
    font-weight: 500;
  }
`

const Headline = styled(HeroStatement)`
  max-width: none;
  font-size: clamp(38px, 3vw + 16px, 60px);

  em {
    display: block;
  }

  @media (max-width: 720px) {
    em {
      display: inline;
    }
  }
`

const Lede = styled.p`
  margin: 0;
  max-width: 52ch;
  color: var(--color-muted);
  font-size: 17px;
  line-height: 26px;
`

/* ---------- Layer matrix ---------- */

/*
 * One grid holds the whole comparison. Desktop: a label column plus one column
 * per path; rows are eyebrow, name, price, action, the four layers and the
 * total. Phone: the three paths side by side, each layer's name on its own
 * full-width row above its cells. Each path is an <article> spanning its
 * column on a row subgrid, so every row lines up across the paths.
 */
const DESKTOP_ROWS = 9
const PHONE_ROWS = 14

/** Row of each piece inside a path column (subgrid lines), desktop / phone. */
const ROW = {
  eyebrow: [1, 1],
  name: [2, 2],
  price: [3, 3],
  action: [4, 4],
  layer: (index: number) => [5 + index, 6 + 2 * index] as const,
  total: [9, 14],
} as const

/** Rows of the full-width pieces in the outer grid, desktop / phone. */
const OUTER = {
  /** The phone layout starts with the legend, so path rows sit one lower. */
  layerLabel: (index: number) => [5 + index, 6 + 2 * index] as const,
  totalLabel: [9, 14],
} as const

const cssVars = (vars: Record<string, string | number>) =>
  vars as React.CSSProperties

/** Places an outer-grid item from --c/--r (desktop) and --mc/--mr (phone). */
const placed = css`
  grid-column: var(--c);
  grid-row: var(--r);

  @media (max-width: 720px) {
    grid-column: var(--mc);
    grid-row: var(--mr);
  }
`

/** Places a piece inside a path column on its subgrid row. */
const inColumn = css`
  grid-column: 1;
  grid-row: var(--row);

  @media (max-width: 720px) {
    grid-row: var(--mrow);
  }
`

const Module = styled(Surface)`
  margin-top: 44px;
  padding: 26px 26px 22px;
  ${reveal}

  @media (max-width: 720px) {
    margin-top: 32px;
    padding: 18px 12px 16px;
  }
`

const Matrix = styled.div`
  display: grid;
  grid-template-columns: minmax(150px, 0.72fr) repeat(3, minmax(0, 1fr));
  grid-template-rows: repeat(${DESKTOP_ROWS}, auto);
  column-gap: 10px;

  @media (max-width: 720px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-template-rows: repeat(${PHONE_ROWS + 1}, auto);
    column-gap: 6px;
  }
`

const Column = styled.article`
  ${placed}
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: subgrid;
  min-width: 0;
  padding: 18px 0 16px;
  border: 1px solid transparent;
  border-radius: 14px;
  transition:
    background-color var(--motion),
    border-color var(--motion);

  /* Three equal paths: none is lit ahead of the reader's choice. */
  &:hover {
    background-color: color-mix(in srgb, var(--color-text) 3%, transparent);
  }

  @media (max-width: 720px) {
    padding: 14px 0 12px;
    border-radius: 12px;
  }
`

/* Row rules run across every column. */
const RowRule = styled.span`
  ${placed}
  position: relative;
  z-index: 1;
  align-self: start;
  height: 1px;
  background: var(--glass-border);
  pointer-events: none;
`

const cellPad = css`
  padding-left: 16px;
  padding-right: 16px;

  @media (max-width: 720px) {
    padding-left: 8px;
    padding-right: 8px;
  }
`

const Eyebrow = styled.div`
  ${inColumn}
  ${cellPad}
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding-bottom: 10px;

  @media (max-width: 720px) {
    > span:last-child:not(:first-child) {
      display: none;
    }
  }
`

const TierName = styled.h2`
  ${inColumn}
  ${cellPad}
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: 24px;
  line-height: 28px;
  font-weight: 500;
  letter-spacing: -0.03em;

  @media (max-width: 720px) {
    font-family: var(--font-sans);
    font-size: 14px;
    line-height: 20px;
    letter-spacing: -0.01em;
  }
`

const PriceRow = styled.div`
  ${inColumn}
  ${cellPad}
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 10px;
  padding-top: 14px;
  padding-bottom: 18px;

  @media (max-width: 720px) {
    padding-top: 8px;
    padding-bottom: 14px;
  }
`

/* Animated, so set in Geist with tabular figures (Urbanist has none). The
 * currency and the cents sit small, muted and on the baseline. */
const PriceFigure = styled.span`
  display: inline-flex;
  align-items: baseline;
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: clamp(40px, 1.6vw + 20px, 48px);
  line-height: 1;
  font-weight: 500;
  letter-spacing: -0.045em;
  font-variant-numeric: tabular-nums;

  i,
  small {
    color: var(--color-muted);
    font-size: 0.5em;
    font-style: normal;
    font-weight: 400;
    letter-spacing: -0.02em;
  }

  i {
    margin-right: 0.06em;
  }

  small {
    margin-left: 0.04em;
  }

  @media (max-width: 720px) {
    font-size: 28px;
  }
`

/* "/ month · detail" on one line; on a phone each part gets its own line. */
const PriceMeta = styled.span`
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);

  > span + span::before {
    content: ' · ';
  }

  @media (max-width: 720px) {
    flex-basis: 100%;
    font-size: 12px;
    line-height: 16px;

    > span {
      display: block;
    }

    > span + span::before {
      content: none;
    }
  }
`

/* Parts joined by a middle dot; stacked on a phone. */
const Breakdown = styled(Small)`
  > span + span::before {
    content: ' · ';
  }

  @media (max-width: 720px) {
    font-size: 12px;
    line-height: 16px;

    > span {
      display: block;
    }

    > span + span::before {
      content: none;
    }
  }
`

const ActionCell = styled.div`
  ${inColumn}
  ${cellPad}
  padding-bottom: 20px;

  @media (max-width: 720px) {
    display: none;
  }
`

const LegendBox = styled.div`
  ${placed}
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 12px;
  padding: 18px 8px 22px 0;

  ul {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    grid-template-columns: 28px auto;
    align-items: center;
    gap: 10px;
    color: var(--color-muted);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
  }

  @media (max-width: 720px) {
    padding: 0 4px 14px;

    ul {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 8px 16px;
    }

    li {
      grid-template-columns: 20px auto;
      gap: 8px;
      font-size: 12px;
      line-height: 16px;
    }
  }
`

const RowLabel = styled.div`
  ${placed}
  position: relative;
  z-index: 1;
  /* Centred on the rail of its row (cells: 20px pad, 8px rail). */
  padding: 14px 8px 14px 0;
  color: var(--color-text);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  font-weight: 500;

  @media (max-width: 720px) {
    padding: 12px 6px 8px 4px;
    color: var(--color-faint);
    font-size: var(--fs-label);
    line-height: var(--lh-label);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
  }
`

const grow = keyframes`
  from { clip-path: inset(-12px 100% -12px -12px); }
  to { clip-path: inset(-12px -12px -12px -12px); }
`

/*
 * The rail: an empty track (you run it), a hatched fill (Kleros supports you)
 * or a solid lit fill (Kleros runs it). It fills from the left once the
 * matrix is in view.
 */
const Rail = styled.span<{ $owner: Owner; $still?: boolean }>`
  position: relative;
  display: block;
  height: 8px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-text) 7%, transparent);
  /* The empty track's outline clears 3:1 on the panel in every theme. */
  box-shadow: inset 0 0 0 1px
    color-mix(in srgb, var(--color-faint) 85%, transparent);

  ${({ $owner }) =>
    $owner !== 'you' &&
    css`
      &::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
      }
    `}

  ${({ $owner }) =>
    $owner === 'runs' &&
    css`
      &::after {
        background: linear-gradient(
          90deg,
          color-mix(in srgb, var(--color-primary) 55%, transparent),
          var(--color-primary)
        );
        box-shadow: 0 0 14px
          color-mix(in srgb, var(--color-primary) 55%, transparent);
      }
    `}

  ${({ $owner }) =>
    $owner === 'supports' &&
    css`
      &::after {
        background: repeating-linear-gradient(
          135deg,
          color-mix(in srgb, var(--color-primary) 85%, transparent) 0 2px,
          transparent 2px 6px
        );
        box-shadow: inset 0 0 0 1px
          color-mix(in srgb, var(--color-primary) 55%, transparent);
      }
    `}

  ${({ $still }) =>
    !$still &&
    css`
      [data-inview='false'] &::after {
        clip-path: inset(-12px 100% -12px -12px);
      }

      [data-inview='true'] &::after {
        animation: ${grow} 760ms var(--ease-out) both;
        animation-delay: var(--d, 0ms);
      }

      @media (prefers-reduced-motion: reduce) {
        [data-inview] &::after {
          clip-path: none;
          animation: none;
        }
      }
    `}

  @media (max-width: 720px) {
    height: 6px;
  }
`

/* Opens below its cell so it never covers the path's button above. */
const Tip = styled.span<{ $align: 'start' | 'center' | 'end' }>`
  position: absolute;
  top: calc(100% - 10px);
  z-index: 5;
  width: max-content;
  max-width: min(260px, 70vw);
  padding: 8px 10px;
  border: 1px solid var(--color-border-strong);
  border-radius: 10px;
  /* Opaque: the raised tint laid over the solid surface. */
  background:
    linear-gradient(var(--color-raised), var(--color-raised)),
    var(--color-surface);
  box-shadow: var(--shadow-overlay);
  color: var(--color-text);
  font-size: 12px;
  line-height: 17px;
  font-weight: 400;
  text-align: left;
  opacity: 0;
  transform: translateY(-4px);
  pointer-events: none;
  transition:
    opacity 160ms var(--ease-out),
    transform 160ms var(--ease-out);

  ${({ $align }) =>
    $align === 'start'
      ? css`
          left: 8px;
        `
      : $align === 'end'
        ? css`
            right: 8px;
          `
        : css`
            left: 50%;
            translate: -50% 0;
          `}
`

/* A button: a tap or Enter opens the sentence, hover shows it too. */
const Cell = styled.button<{ $owner: Owner }>`
  ${inColumn}
  ${cellPad}
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  margin: 0;
  padding-top: 20px;
  padding-bottom: 18px;
  border: 0;
  border-radius: 10px;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  outline-offset: -2px;

  > b {
    color: ${({ $owner }) =>
      $owner === 'you' ? 'var(--color-muted)' : 'var(--color-text)'};
    font-size: var(--fs-small);
    line-height: var(--lh-small);
    font-weight: ${({ $owner }) => ($owner === 'you' ? 400 : 500)};
  }

  &[aria-expanded='true'] ${Tip} {
    opacity: 1;
    transform: none;
  }

  @media (hover: hover) {
    &:hover ${Tip} {
      opacity: 1;
      transform: none;
    }
  }

  @media (max-width: 720px) {
    gap: 8px;
    padding-top: 2px;
    padding-bottom: 14px;

    > b {
      font-size: 12px;
      line-height: 16px;
    }
  }
`

const TotalCell = styled.div`
  ${inColumn}
  ${cellPad}
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 18px;

  @media (max-width: 720px) {
    padding-top: 2px;
  }
`

const TotalFigure = styled.span`
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: 24px;
  font-variant-numeric: tabular-nums;

  b {
    margin-right: 4px;
    color: var(--color-text);
    font-family: var(--font-figure);
    font-size: 22px;
    font-weight: 500;
    letter-spacing: -0.03em;
  }

  @media (max-width: 720px) {
    font-size: 12px;

    b {
      font-size: 18px;
    }
  }
`

const PhoneActions = styled.div`
  display: none;

  @media (max-width: 720px) {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 16px;
    padding: 0 4px;
  }
`

const ExplainerSlot = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 24px;

  > div {
    width: 100%;
  }

  @media (max-width: 720px) {
    justify-content: flex-start;
  }
`

const FooterLink = styled(Link)`
  color: var(--color-primary);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 500;
  text-decoration: none;

  &:hover {
    color: var(--color-primary-hover);
    text-decoration: underline;
  }
`

/* ---------- Creator prompt ---------- */

const PromptSection = styled.section`
  display: grid;
  grid-template-columns: minmax(0, 360px) minmax(0, 1fr);
  gap: 24px 48px;
  align-items: start;
  margin-top: 88px;

  @media (max-width: 1020px) {
    grid-template-columns: 1fr;
    margin-top: 64px;
  }
`

const PromptIntro = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 8px;

  h2 {
    margin: 0;
    color: var(--color-text);
    font-family: var(--font-display);
    font-size: 30px;
    line-height: 34px;
    font-weight: 500;
    letter-spacing: -0.03em;
  }

  p {
    margin: 0;
    color: var(--color-muted);
    font-size: var(--fs-body);
    line-height: var(--lh-body);
  }
`

const PromptLinks = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: 8px;
  border-top: 1px solid var(--glass-border);
`

const linkRow = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 48px;
  border-bottom: 1px solid var(--glass-border);
  color: var(--color-text);
  font-size: var(--fs-body);
  font-weight: 500;
  text-decoration: none;

  svg {
    color: var(--color-faint);
    transition:
      transform var(--motion),
      color var(--motion);
  }

  &:hover {
    color: var(--color-primary);

    svg {
      color: var(--color-primary);
      transform: translateX(3px);
    }
  }
`

const PromptLink = styled(Link)`
  ${linkRow}
`

const PromptAnchor = styled.a`
  ${linkRow}
`

/* Hidden until it scrolls into view, then it rises in (SPEC 5.2). */
const PromptPanel = styled(Surface)<{ $copied: boolean }>`
  overflow: hidden;

  &[data-inview='false'] {
    opacity: 0;
  }

  &[data-inview='true'] {
    ${reveal}
  }

  @media (prefers-reduced-motion: reduce) {
    &[data-inview] {
      opacity: 1;
    }
  }

  ${({ $copied }) =>
    $copied &&
    css`
      border-color: color-mix(in srgb, var(--color-primary) 55%, transparent);
      box-shadow:
        inset 0 1px 0 var(--glass-highlight),
        0 0 0 3px color-mix(in srgb, var(--color-primary) 14%, transparent),
        var(--shadow-card);
    `}
`

const PromptBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 58px;
  padding: 10px 12px 10px 20px;
  border-bottom: 1px solid var(--glass-border);
`

const PromptTitle = styled.div`
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 12px;
  min-width: 0;
`

const CopyLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;

  svg {
    transition: transform var(--motion);
  }
`

/* Both labels share one cell so the button keeps its width when it flips;
 * the visible one starts at the icon, so "Copied" sits right beside it. */
const CopyText = styled.span`
  display: inline-grid;
  justify-items: start;

  > * {
    grid-area: 1 / 1;
  }

  > [aria-hidden] {
    visibility: hidden;
  }
`

const sweep = keyframes`
  from { transform: translateY(-100%); }
  to { transform: translateY(100%); }
`

const CodeWrap = styled.div`
  position: relative;
  overflow: hidden;
`

/* After a copy, a band of light runs down the text once: what was copied. */
const Sweep = styled.span`
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    transparent,
    color-mix(in srgb, var(--color-primary) 14%, transparent) 50%,
    transparent
  );
  pointer-events: none;
  animation: ${sweep} 760ms cubic-bezier(0.45, 0, 0.2, 1) both;

  @media (prefers-reduced-motion: reduce) {
    display: none;
  }
`

const PromptCode = styled.pre`
  position: relative;
  margin: 0;
  max-height: 480px;
  padding: 18px 20px 20px 12px;
  overflow: auto;
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: var(--fs-data);
  line-height: 22px;
  font-weight: 400;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  counter-reset: line;

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }

  @media (max-width: 720px) {
    max-height: none;
    padding: 14px 14px 16px 6px;
  }
`

/* Each line carries its number in a gutter (not selectable, not copied). */
const PromptLine = styled.span<{ $kind: 'head' | 'item' | 'text' }>`
  position: relative;
  display: block;
  min-height: 22px;
  padding-left: 40px;
  counter-increment: line;
  color: ${({ $kind }) =>
    $kind === 'text' ? 'var(--color-muted)' : 'var(--color-text)'};
  font-weight: ${({ $kind }) => ($kind === 'head' ? 500 : 400)};

  &::before {
    content: counter(line);
    position: absolute;
    left: 0;
    width: 24px;
    color: var(--color-faint);
    text-align: right;
    user-select: none;
  }

  b {
    color: var(--color-primary);
    font-weight: 400;
  }
`

/* Live region for the copy failure; it takes no space while empty. */
const CopyNotice = styled(Small)`
  display: block;
  padding: 0 20px 16px;

  &:empty {
    display: none;
  }
`

/* ---------- Pieces ---------- */

const Price = ({ value, play }: { value: number; play: boolean }) => {
  const current = useCountUp(play ? value : undefined, 1200)
  const cents = !Number.isInteger(value)
  const [whole, fraction] = (
    cents ? current.toFixed(2) : String(Math.round(current))
  ).split('.')
  return (
    <PriceFigure>
      <SrOnly>{usd(value)} per month</SrOnly>
      <span
        aria-hidden
        style={{ display: 'inline-flex', alignItems: 'baseline' }}
      >
        <i>$</i>
        {whole}
        {fraction && <small>.{fraction}</small>}
      </span>
    </PriceFigure>
  )
}

const HelpTotal = ({ tier, play }: { tier: Tier; play: boolean }) => {
  const runs = countOwned(tier, 'runs')
  const supports = countOwned(tier, 'supports')
  const helped = runs + supports
  const shown = useCountUp(play ? helped : undefined, 900)
  const breakdown =
    helped === 0
      ? [`You run all ${LAYERS.length}`]
      : [
          runs > 0 ? `${runs} run by Kleros` : '',
          supports > 0 ? `${supports} supported` : '',
        ].filter(Boolean)
  return (
    <>
      <TotalFigure>
        <SrOnly>
          Kleros helps on {helped} of {LAYERS.length} layers.
        </SrOnly>
        <span aria-hidden>
          <b>{Math.round(shown)}</b>of {LAYERS.length} layers
        </span>
      </TotalFigure>
      <Breakdown $muted>
        {breakdown.map((part) => (
          <span key={part}>{part}</span>
        ))}
      </Breakdown>
    </>
  )
}

const PathButton = ({
  tier,
  launchHref,
  phone,
}: {
  tier: Tier
  launchHref: string
  /** The phone's stacked buttons name the plan on each contact button. */
  phone?: boolean
}) => {
  const { action } = tier
  const variant = 'secondary'
  return action.kind === 'launch' ? (
    <ButtonLink to={launchHref} $variant={variant} $block>
      <CurateIcon name={action.icon} size={16} />
      {action.label}
    </ButtonLink>
  ) : (
    <ButtonAnchor href={contactHref(action.subject)} $variant={variant} $block>
      {phone ? action.phoneLabel : action.label}
    </ButtonAnchor>
  )
}

const TierColumn = ({
  tier,
  index,
  play,
  launchHref,
  openTip,
  onToggleTip,
}: {
  tier: Tier
  index: number
  play: boolean
  launchHref: string
  openTip: string | null
  onToggleTip: (id: string) => void
}) => {
  const at = (rows: readonly [number, number]) =>
    cssVars({ '--row': rows[0], '--mrow': rows[1] })
  const align =
    index === 0 ? 'start' : index === TIERS.length - 1 ? 'end' : 'center'
  return (
    <Column
      aria-label={tier.name}
      style={cssVars({
        '--c': index + 2,
        '--r': `1 / span ${DESKTOP_ROWS}`,
        '--mc': index + 1,
        '--mr': `2 / span ${PHONE_ROWS}`,
      })}
    >
      <Eyebrow style={at(ROW.eyebrow)}>
        <Label $tone="faint">{tier.path}</Label>
      </Eyebrow>
      <TierName style={at(ROW.name)}>{tier.name}</TierName>
      <PriceRow style={at(ROW.price)}>
        <Price value={tier.price} play={play} />
        <PriceMeta>
          <span aria-hidden>/ month</span>
          <span>{tier.priceDetail}</span>
        </PriceMeta>
      </PriceRow>
      <ActionCell style={at(ROW.action)}>
        <PathButton tier={tier} launchHref={launchHref} />
      </ActionCell>
      {LAYERS.map(({ key, label }, row) => {
        const layer = tier.layers[key]
        const tipId = `curate-pro-${index}-${key}`
        return (
          <Cell
            key={key}
            type="button"
            data-layer-cell
            $owner={layer.owner}
            aria-expanded={openTip === tipId}
            aria-describedby={tipId}
            onClick={() => onToggleTip(tipId)}
            style={at(ROW.layer(row))}
          >
            <SrOnly>
              {label}: {ownerText(layer.owner)}.
            </SrOnly>
            <Rail
              $owner={layer.owner}
              aria-hidden
              style={cssVars({ '--d': `${160 + index * 120 + row * 90}ms` })}
            />
            <b>{layer.label}</b>
            <Tip id={tipId} role="tooltip" $align={align}>
              {layer.text}
            </Tip>
          </Cell>
        )
      })}
      <TotalCell style={at(ROW.total)}>
        <HelpTotal tier={tier} play={play} />
      </TotalCell>
    </Column>
  )
}

const LayerMatrix = () => {
  const [ref, inView] = useInView<HTMLDivElement>()
  const launchHref = `/launch/${useDisplayedChainId()}`
  const [openTip, setOpenTip] = useState<string | null>(null)
  const toggleTip = (id: string) =>
    setOpenTip((current) => (current === id ? null : id))

  // An open sentence closes on Escape or a tap anywhere but a cell.
  useEffect(() => {
    if (!openTip) return
    const onPointer = (event: PointerEvent) => {
      if (!(event.target as Element | null)?.closest?.('[data-layer-cell]'))
        setOpenTip(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenTip(null)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [openTip])
  const outer = (
    desktop: readonly [number, number] | [number, number],
    phone: number,
    column: { c: string | number; mc: string | number },
  ) =>
    cssVars({
      '--c': column.c,
      '--r': `${desktop[0]} / span ${desktop[1]}`,
      '--mc': column.mc,
      '--mr': phone,
    })
  const full = { c: 1, mc: '1 / -1' }
  // Row names stay in the first column on a phone.
  const name = { c: 1, mc: 1 }
  const rule = { c: '1 / -1', mc: '1 / -1' }

  return (
    <Module
      as="section"
      $featured
      $padding="none"
      aria-label="Launch paths compared"
      style={{ ['--i' as string]: 3 }}
    >
      <Matrix ref={ref} data-inview={inView ? 'true' : 'false'}>
        <LegendBox style={outer([1, 4], 1, full)}>
          <Label $tone="faint">Where Kleros helps</Label>
          <ul aria-label="Legend">
            {OWNERS.map(({ owner, text }) => (
              <li key={owner}>
                <Rail $owner={owner} $still aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        </LegendBox>

        {LAYERS.map(({ key, label }, row) => {
          const [desktop, phone] = OUTER.layerLabel(row)
          return (
            <React.Fragment key={key}>
              <RowRule aria-hidden style={outer([desktop, 1], phone, rule)} />
              <RowLabel aria-hidden style={outer([desktop, 1], phone, name)}>
                {label}
              </RowLabel>
            </React.Fragment>
          )
        })}
        <RowRule
          aria-hidden
          style={outer([OUTER.totalLabel[0], 1], OUTER.totalLabel[1], rule)}
        />
        <RowLabel
          aria-hidden
          style={outer([OUTER.totalLabel[0], 1], OUTER.totalLabel[1], name)}
        >
          Kleros helps
        </RowLabel>

        {TIERS.map((tier, index) => (
          <TierColumn
            key={tier.name}
            tier={tier}
            index={index}
            play={inView}
            launchHref={launchHref}
            openTip={openTip}
            onToggleTip={toggleTip}
          />
        ))}
      </Matrix>

      <PhoneActions>
        {TIERS.map((tier) => (
          <PathButton
            key={tier.name}
            tier={tier}
            launchHref={launchHref}
            phone
          />
        ))}
      </PhoneActions>
    </Module>
  )
}

/* ---------- Page ---------- */

const CuratePro = () => {
  useDocumentHead(
    'Curate Pro | Kleros Curate',
    'Launch a Kleros Curate registry with permissionless contracts, Quickstart indexing, or supported policy and frontend delivery.',
  )

  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [copies, setCopies] = useState(0)
  const copiedTimer = useRef<number | undefined>(undefined)
  // A panel entrance, not a data draw-in: start it as soon as it shows.
  const [promptRef, promptInView] = useInView<HTMLDivElement>(0.15)

  useEffect(() => () => window.clearTimeout(copiedTimer.current), [])

  const copyCreatorPrompt = async () => {
    window.clearTimeout(copiedTimer.current)
    const clipboard = navigator.clipboard
    if (!clipboard) {
      setCopyState('failed')
      return
    }
    try {
      await clipboard.writeText(CREATOR_PROMPT)
      setCopyState('copied')
      setCopies((count) => count + 1)
      copiedTimer.current = window.setTimeout(
        () => setCopyState('idle'),
        COPIED_FOR_MS,
      )
    } catch {
      setCopyState('failed')
    }
  }

  const copied = copyState === 'copied'

  return (
    <Page>
      <Hero>
        <HeroPill style={{ ['--i' as string]: 0 }}>
          <b>{TIERS.length} launch paths</b>
          {usd(lowestPrice)} to {usd(highestPrice)} a month
        </HeroPill>
        <Headline style={{ ['--i' as string]: 1 }}>
          Launch a registry <em>without building the whole stack.</em>
        </Headline>
        <Lede style={{ ['--i' as string]: 2 }}>
          The same open-source, permissionless protocol on every path; the paid
          ones buy speed, infrastructure and direct support, not access.
        </Lede>
      </Hero>

      <LayerMatrix />

      <ExplainerSlot>
        <Explainer
          id="curate-pro-production-registry"
          eyebrow="Before you launch"
          heading="What a production registry needs"
          intro="Every path runs the same contracts; what changes is who runs the pieces around them."
          steps={[
            {
              title: 'Policy and court',
              body: 'A policy PDF says what belongs on the list, and the list names a Kleros court and juror count. Jurors rule by the policy.',
            },
            {
              title: 'Deposits',
              body: 'In Light and Classic Curate, each request locks a base deposit plus the arbitration cost; it comes back in full when the entry follows the policy. A challenger locks the same kind of deposit and earns the submitter’s base deposit by spotting one that breaks it.',
            },
            {
              title: 'Indexing and front end',
              body: 'Search needs an indexer: run one, connect a third party, or use the ready API in Quickstart and Curate Pro. The front end is yours to build, with support on Curate Pro.',
            },
          ]}
          schematic={<ProductionStackSchematic />}
          footer={<FooterLink to={GUIDE_HREF}>Read the guide</FooterLink>}
        />
      </ExplainerSlot>

      <PromptSection aria-label="Creator prompt">
        <PromptIntro>
          <h2>Creator prompt for new lists</h2>
          <p>
            For creators deciding how to launch and run a new list; paste it
            after the agent loads the Curate skill.
          </p>
          <PromptLinks>
            <PromptLink to={GUIDE_HREF}>
              Open the guide
              <ArrowIcon />
            </PromptLink>
            <PromptAnchor href={SKILL_HREF}>
              Open the Curate skill (SKILL.md)
              <ArrowIcon />
            </PromptAnchor>
          </PromptLinks>
        </PromptIntro>

        <PromptPanel
          ref={promptRef}
          data-inview={promptInView ? 'true' : 'false'}
          $padding="none"
          $copied={copied}
          style={{ ['--i' as string]: 1 }}
        >
          <PromptBar>
            <PromptTitle>
              <Label>Creator prompt</Label>
              <Small $faint>{PROMPT_LINES.length} lines · plain text</Small>
            </PromptTitle>
            <Button
              type="button"
              $variant="primary"
              $size="sm"
              onClick={copyCreatorPrompt}
            >
              <CopyLabel>
                <CurateIcon
                  name={copied ? 'check' : 'copy'}
                  size={14}
                  style={copied ? { transform: 'scale(1.15)' } : undefined}
                />
                <CopyText>
                  <span aria-live="polite">
                    {copied ? 'Copied' : 'Copy creator prompt'}
                  </span>
                  <span aria-hidden>Copy creator prompt</span>
                </CopyText>
              </CopyLabel>
            </Button>
          </PromptBar>
          <CodeWrap>
            <PromptCode
              role="region"
              tabIndex={0}
              aria-label="Creator prompt text"
            >
              {PROMPT_LINES.map((line, index) => {
                const item = line.startsWith('- ')
                const kind = item
                  ? 'item'
                  : line.endsWith(':')
                    ? 'head'
                    : 'text'
                return (
                  <PromptLine key={index} $kind={kind}>
                    {item ? (
                      <>
                        <b>-</b>
                        {line.slice(1)}
                      </>
                    ) : (
                      line
                    )}
                    {'\n'}
                  </PromptLine>
                )
              })}
            </PromptCode>
            {copied && <Sweep key={copies} aria-hidden />}
          </CodeWrap>
          <CopyNotice $muted role="status">
            {copyState === 'failed'
              ? 'Copy failed. Select the text above to copy it.'
              : null}
          </CopyNotice>
        </PromptPanel>
      </PromptSection>
    </Page>
  )
}

export default CuratePro
