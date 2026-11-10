import React, { useState } from 'react'
import styled, { css, keyframes } from 'styled-components'
import { Link } from 'react-router-dom'
import { parseIpfs } from 'utils/ipfs-parse'
import PolicyUpdatedBadge from 'components/policy-updated-badge'
import { getAddressPage } from 'utils/network-utils'
import {
  Button,
  ButtonAnchor,
  ChainChip,
  Chip,
  Label,
  SkeletonBlock,
  Surface,
  truncateMiddle,
} from './primitives'
import { CurateIcon } from './icons'
import { TrustTag } from './verified-badge'
import { Explainer, type ExplainerStep } from './explainer'
import { RingGauge } from './motion/ring-gauge'
import { reveal } from './motion/reveal'
import { CountUpText, isPlainCount } from './registry-shared-count'

/*
 * Registry header, a portfolio panel (YMax): identity first, then the
 * headline figure with the live counts and the list's terms beside it, the
 * share of entries registered as a ring when the page passes both counts, and
 * the one action with its exact deposit and what happens to it (a deposit on
 * Light and Classic, a locked stake on Stake). Parameters slide open as a
 * drawer; the per-list explainer waits in a pill.
 */

const integer = new Intl.NumberFormat('en-US')

const Shell = styled(Surface)`
  ${reveal}
`

const Top = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px 40px;
  padding: 28px 28px 24px;

  @media (max-width: 860px) {
    flex-direction: column;
    align-items: stretch;
    padding: 20px 18px;
  }
`

const Identity = styled.div`
  display: flex;
  gap: 18px;
  min-width: 0;

  @media (max-width: 520px) {
    gap: 14px;
  }
`

/* The list's logo is an <img>, never a CSS url(): logoURI comes from
   MetaEvidence that any list creator controls. */
const Logo = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 60px;
  height: 60px;
  overflow: hidden;
  border: 1px solid var(--glass-border);
  border-radius: 18px;
  background: var(--color-raised);
  box-shadow:
    0 0 0 4px color-mix(in srgb, var(--color-primary) 10%, transparent),
    0 12px 36px -12px var(--color-primary),
    inset 0 1px 0 var(--glass-highlight);
  color: var(--color-faint);

  img {
    display: block;
    width: 78%;
    height: 78%;
    object-fit: contain;
  }

  @media (max-width: 520px) {
    width: 48px;
    height: 48px;
    border-radius: 14px;
  }
`

const LogoMark = ({ src }: { src?: string | null }) => {
  const [failed, setFailed] = useState(false)
  return (
    <Logo aria-hidden>
      {src && !failed ? (
        <img src={src} alt="" onError={() => setFailed(true)} />
      ) : (
        <CurateIcon name="registry" size={24} />
      )}
    </Logo>
  )
}

const IdText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
`

const Title = styled.h1`
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: clamp(30px, 1.6vw + 18px, 40px);
  line-height: 1.04;
  font-weight: 500;
  letter-spacing: -0.03em;
  overflow-wrap: anywhere;
`

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
`

/* The trust mark arrives with its data: it fades in rather than popping. */
const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`

const TrustSlot = styled.span`
  display: inline-flex;
  animation: ${fadeIn} 240ms var(--ease-out, ease-out) both;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const Address = styled.span`
  padding: 0 4px;
  color: var(--color-muted);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 24px;
`

const Description = styled.div`
  max-width: 72ch;
  color: var(--color-muted);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
`

const Action = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  flex: 0 0 auto;
  width: min(100%, 300px);

  @media (max-width: 860px) {
    width: 100%;
  }
`

/* Full on-primary ink: any fade drops the amount under AA on the blue
   fill. The lighter weight is what sets it apart from the label. */
const Amount = styled.span`
  font-weight: 400;
  font-variant-numeric: tabular-nums;
`

const Note = styled.span`
  color: var(--color-faint);
  font-size: 12px;
  line-height: 16px;
  text-align: center;
`

/* Every figure sits on the band's bottom line: the headline, the inline
   stats and the ring's caption share one row of labels and one of values. */
const Figures = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 24px 48px;
  padding: 24px 28px;
  border-top: 1px solid var(--glass-border);

  @media (max-width: 860px) {
    padding: 20px 18px;
    gap: 20px 32px;
  }
`

const Headline = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
`

const Big = styled.span`
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: clamp(48px, 2.6vw + 26px, 64px);
  line-height: 0.92;
  font-weight: 500;
  letter-spacing: -0.045em;
  font-variant-numeric: tabular-nums;
`

/* A count the indexer did not return: a quiet word, not a display-size dash. */
const Unknown = styled.span`
  display: inline-block;
  color: var(--color-muted);
  font-family: var(--font-sans);
  font-size: 20px;
  line-height: 28px;
  font-weight: 500;
  letter-spacing: -0.01em;
`

const Missing = styled.span`
  color: var(--color-muted);
`

const InlineStats = styled.dl`
  display: flex;
  flex-wrap: wrap;
  gap: 18px 36px;
  margin: 0 auto 4px 0;

  div {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  dt {
    white-space: nowrap;
  }

  dd {
    margin: 0;
    color: var(--color-text);
    font-family: var(--font-figure);
    font-size: 18px;
    line-height: 22px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 520px) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
    gap: 16px 20px;

    dd {
      font-size: 16px;
    }
  }
`

const RingBlock = styled.figure`
  display: flex;
  align-items: flex-end;
  gap: 16px;
  margin: 0;

  figcaption {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 5px;
  }

  b {
    color: var(--color-text);
    font-size: 15px;
    line-height: 20px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
`

const Footer = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 22px;
  padding: 14px 28px;
  border-top: 1px solid var(--glass-border);

  @media (max-width: 860px) {
    padding: 14px 18px;
  }
`

const quiet = css`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 24px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: color var(--motion);

  &:hover {
    color: var(--color-text);
  }

  svg {
    flex: 0 0 auto;
  }
`

const QuietButton = styled.button`
  ${quiet}
`

const QuietAnchor = styled.a`
  ${quiet}
`

const QuietLink = styled(Link)`
  ${quiet}
`

const ParamsToggle = styled.button`
  ${quiet}
  color: var(--color-text);

  svg {
    transition: transform 360ms cubic-bezier(0.34, 1.4, 0.64, 1);
  }

  &[aria-expanded='true'] svg {
    transform: rotate(180deg);
  }
`

const Drawer = styled.div<{ $open: boolean }>`
  display: grid;
  grid-template-rows: ${({ $open }) => ($open ? '1fr' : '0fr')};
  visibility: ${({ $open }) => ($open ? 'visible' : 'hidden')};
  transition:
    grid-template-rows 420ms cubic-bezier(0.16, 1, 0.3, 1),
    visibility 0s linear ${({ $open }) => ($open ? '0s' : '420ms')};

  > div {
    min-height: 0;
    overflow: hidden;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const ParamsGrid = styled.dl`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0 32px;
  margin: 0;
  padding: 4px 28px 24px;
  border-top: 1px solid var(--glass-border);

  > div {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    padding: 16px 0 14px;
    border-bottom: 1px solid var(--glass-border);
  }

  dd {
    margin: 0;
    color: var(--color-text);
    font-size: var(--fs-body);
    line-height: var(--lh-body);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }

  dd + dd {
    color: var(--color-faint);
    font-size: 12px;
    line-height: 16px;
    font-weight: 400;
  }

  @media (max-width: 860px) {
    padding: 4px 18px 18px;
  }
`

export interface RegistryParameter {
  label: string
  value?: React.ReactNode
  hint?: string
}

export interface RegistryStat {
  label: string
  value?: React.ReactNode
}

const isMissing = (value?: React.ReactNode) =>
  value === undefined || value === null || value === ''

/** Plain counts climb; anything else (durations, amounts, nodes) stays put. */
const StatValue = ({ value }: { value?: React.ReactNode }) =>
  isMissing(value) ? (
    <Missing>—</Missing>
  ) : isPlainCount(value) ? (
    <CountUpText value={value} />
  ) : (
    <>{value}</>
  )

/** What happens to the primary button's amount, per kind. */
const depositNoteFor = (kindLabel: string, itemName: string) =>
  /stake/i.test(kindLabel)
    ? `Locked, not spent: it stays locked while your ${itemName} is listed and comes back when you withdraw, unless a challenge succeeds.`
    : `A deposit, not a fee: it comes back when your ${itemName} follows the list’s policy.`

export const RegistryHeader = ({
  title,
  description,
  logoURI,
  chainId,
  address,
  verified,
  listOfLists = false,
  kindLabel,
  itemName,
  primaryLabel,
  primaryAmount,
  depositNote,
  onPrimary,
  policyURI,
  onOpenPolicy,
  policyUpdated = true,
  badgesListTo,
  stats,
  parameters,
  explainerId,
  explainerHeading,
  explainerSteps,
  loading,
  registeredCount,
  totalCount,
}: {
  title?: string
  description?: string
  logoURI?: string | null
  chainId?: number
  address: string
  /**
   * Kleros Verified: the chain's Kleros list of lists or registered on it
   * (useRegistryVerified); false is a Community list. Undefined while that
   * is loading or could not be read: no trust mark then, so the header
   * never calls a list Community without data.
   */
  verified?: boolean
  /** The registry is the chain's Kleros list of lists. */
  listOfLists?: boolean
  kindLabel: string
  itemName: string
  primaryLabel: string
  /** The exact amount the button sends; also listed in Parameters. */
  primaryAmount?: React.ReactNode
  /** The line under the button: what happens to the amount. Defaults by kind. */
  depositNote?: React.ReactNode
  onPrimary: () => void
  policyURI?: string | null
  onOpenPolicy?: () => void
  /**
   * Show when the policy last changed. Off where the history cannot be read
   * (Stake lists), so no placeholder appears and then vanishes.
   */
  policyUpdated?: boolean
  badgesListTo?: string
  stats: RegistryStat[]
  parameters: RegistryParameter[]
  explainerId: string
  explainerHeading: string
  explainerSteps: ExplainerStep[]
  loading?: boolean
  /** Entries registered right now; with `totalCount`, drawn as a ring. */
  registeredCount?: number
  /** Every entry the registered share is taken from. */
  totalCount?: number
}) => {
  const [paramsOpen, setParamsOpen] = useState(false)
  const explorer = chainId
    ? getAddressPage({ networkId: chainId, address })
    : null
  const [headline, ...rest] = stats
  // The list's window sits beside the counts; its deposit is in the button
  // and in Parameters, never printed a third time here.
  const period = parameters.find((parameter) =>
    /period$/i.test(parameter.label),
  )
  const inline: RegistryStat[] = [
    ...rest,
    ...(period ? [{ label: period.label, value: period.value }] : []),
  ]
  const showRing =
    registeredCount !== undefined &&
    totalCount !== undefined &&
    Number.isFinite(registeredCount) &&
    Number.isFinite(totalCount) &&
    totalCount > 0
  const registeredShare = showRing
    ? Math.min(1, Math.max(0, registeredCount / totalCount))
    : 0

  return (
    <Shell
      $featured
      $padding="none"
      role="region"
      aria-busy={loading}
      aria-label={title ?? 'Registry'}
    >
      <Top>
        <Identity>
          <LogoMark
            key={logoURI ?? 'none'}
            src={logoURI ? parseIpfs(logoURI) : null}
          />
          <IdText>
            <Title>
              {title ?? (loading ? 'Loading registry…' : 'Registry')}
            </Title>
            <Chips>
              {chainId && <ChainChip chainId={chainId} />}
              <Chip>{kindLabel}</Chip>
              {verified !== undefined && (
                <TrustSlot>
                  <TrustTag verified={verified} listOfLists={listOfLists} />
                </TrustSlot>
              )}
              <Address title={address}>{truncateMiddle(address, 8, 6)}</Address>
            </Chips>
            {description && <Description>{description}</Description>}
          </IdText>
        </Identity>

        <Action>
          <Button type="button" $variant="primary" $block onClick={onPrimary}>
            <CurateIcon name="submit" size={16} />
            {primaryLabel}
            {primaryAmount && <Amount>· {primaryAmount}</Amount>}
          </Button>
          <Note>{depositNote ?? depositNoteFor(kindLabel, itemName)}</Note>
        </Action>
      </Top>

      <Figures>
        <Headline>
          <Label $tone="faint">{headline?.label ?? 'Entries'}</Label>
          {isMissing(headline?.value) ? (
            loading ? (
              <SkeletonBlock $width="148px" $height="56px" aria-hidden />
            ) : (
              <Unknown title="The indexer did not return this count">
                Not available
              </Unknown>
            )
          ) : (
            <Big>
              <StatValue value={headline?.value} />
            </Big>
          )}
        </Headline>
        {inline.length > 0 && (
          <InlineStats>
            {inline.map((stat) => (
              <div key={stat.label}>
                <dt>
                  <Label $tone="faint">{stat.label}</Label>
                </dt>
                <dd>
                  <StatValue value={stat.value} />
                </dd>
              </div>
            ))}
          </InlineStats>
        )}
        {showRing && (
          <RingBlock>
            <RingGauge
              size={96}
              ratio={registeredShare}
              from="color-mix(in srgb, var(--status-registered) 35%, var(--color-raised))"
              to="var(--status-registered)"
              label={`Registered now: ${integer.format(registeredCount)} of ${integer.format(totalCount)} entries`}
            />
            <figcaption>
              <Label $tone="faint">Registered now</Label>
              <b>
                {integer.format(registeredCount)} of{' '}
                {integer.format(totalCount)}
              </b>
            </figcaption>
          </RingBlock>
        )}
      </Figures>

      <Footer>
        <ParamsToggle
          type="button"
          aria-expanded={paramsOpen}
          aria-controls="registry-parameters"
          onClick={() => setParamsOpen((open) => !open)}
        >
          <CurateIcon name="layers" size={14} />
          Parameters
          <CurateIcon name="chevron-down" size={14} />
        </ParamsToggle>
        {policyURI && onOpenPolicy && (
          <QuietButton type="button" onClick={onOpenPolicy}>
            <CurateIcon name="policy" size={14} />
            Listing policy
            {policyUpdated && <PolicyUpdatedBadge registryAddress={address} />}
          </QuietButton>
        )}
        {explorer && (
          <QuietAnchor
            href={explorer}
            target="_blank"
            rel="noopener noreferrer"
          >
            <CurateIcon name="external" size={14} />
            Contract
          </QuietAnchor>
        )}
        {badgesListTo && (
          <QuietLink to={badgesListTo}>
            <CurateIcon name="verified" size={14} />
            Badges list
          </QuietLink>
        )}
        <Explainer
          embedded
          id={explainerId}
          eyebrow="How this list works"
          heading={explainerHeading}
          steps={explainerSteps}
          footer={
            policyURI && onOpenPolicy ? (
              <ButtonAnchor
                as="button"
                type="button"
                $variant="secondary"
                $size="sm"
                onClick={onOpenPolicy}
              >
                Read the listing policy
              </ButtonAnchor>
            ) : undefined
          }
        />
      </Footer>

      <Drawer $open={paramsOpen} id="registry-parameters">
        <div>
          <ParamsGrid aria-label="Parameters">
            {parameters.map((parameter) => (
              <div key={parameter.label}>
                <dt>
                  <Label $tone="faint">{parameter.label}</Label>
                </dt>
                <dd>{parameter.value ?? '—'}</dd>
                {parameter.hint && <dd>{parameter.hint}</dd>}
              </div>
            ))}
          </ParamsGrid>
        </div>
      </Drawer>
    </Shell>
  )
}

export default RegistryHeader
