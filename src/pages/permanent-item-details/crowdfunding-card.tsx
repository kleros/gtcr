import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import { BigNumber } from 'ethers'
import useNativeCurrency from 'hooks/native-currency'
import useRequiredFees from 'hooks/required-fees'
import {
  PARTY,
  STATUS_CODE,
  SUBGRAPH_RULING,
} from 'utils/permanent-item-status'
import {
  Chip,
  Label,
  Small,
  Stack,
  Surface,
} from 'components/curate/primitives'
import { nativeText, formatTokenAmount } from './modals/shell'
import { stakeStatusCode } from './facts'

/*
 * Appeal funding: for each side, how much of its appeal fee is raised. The
 * bar is the share funded (filled) against what is still needed (hatched),
 * with the exact amounts under it and what backers can win. Rendered only
 * while the dispute can be appealed.
 */

const MULTIPLIER_DIVISOR = BigNumber.from(10_000)

const Card = styled(Surface)`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

const SideHead = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
`

const Name = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  font-weight: 500;
`

const Share = styled.span`
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: 26px;
  line-height: 1;
  font-weight: 500;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
`

const Track = styled.div`
  position: relative;
  height: 10px;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: repeating-linear-gradient(
    135deg,
    var(--color-raised) 0 3px,
    transparent 3px 7px
  );
  box-shadow: inset 0 0 0 1px var(--glass-border);
`

/* Grows by width from nothing (scaleX would squash the round ends). */
const Fill = styled.span<{ $funded: boolean }>`
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: var(--radius-pill);
  background: ${({ $funded }) =>
    $funded ? 'var(--status-registered)' : 'var(--status-contested)'};
  box-shadow: 0 0 14px
    color-mix(
      in srgb,
      ${({ $funded }) =>
          $funded ? 'var(--status-registered)' : 'var(--status-contested)'}
        55%,
      transparent
    );
  transition:
    width 900ms var(--ease-out),
    min-width 900ms var(--ease-out);

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const toBigNumber = (value: unknown): BigNumber | undefined =>
  value === null || value === undefined
    ? undefined
    : BigNumber.from(String(value))

const Side = ({
  name,
  paid,
  required,
  funded,
  reward,
  role,
  currency,
}: {
  name: string
  paid: BigNumber
  required: BigNumber
  funded: boolean
  reward: BigNumber
  role?: 'winning' | 'losing'
  currency: string
}) => {
  const share = funded
    ? 1
    : required.isZero()
      ? 0
      : paid.mul(MULTIPLIER_DIVISOR).div(required).toNumber() / 10_000
  const width = Math.round(Math.min(1, Math.max(0, share)) * 100)
  // Start at zero, then grow to the share on the next frame.
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  return (
    <Stack
      $gap={8}
      role="group"
      aria-label={`${name}: ${width}% of the appeal fee raised, ${nativeText(
        paid,
        currency,
      )} of ${nativeText(required, currency)}`}
    >
      <SideHead>
        <Name>
          {name}
          {role && <Chip>{role}</Chip>}
        </Name>
        <Share>{width}%</Share>
      </SideHead>
      <Track aria-hidden>
        <Fill
          $funded={funded}
          style={{
            width: shown ? `${width}%` : '0%',
            minWidth: shown && width > 0 ? 10 : 0,
          }}
        />
      </Track>
      <Small $muted>
        {funded
          ? `Fully funded · ${nativeText(required, currency)}`
          : `${formatTokenAmount(paid.toString(), 18, 5)} of ${nativeText(
              required,
              currency,
            )} raised · backers can win up to ${nativeText(reward, currency)}`}
      </Small>
    </Stack>
  )
}

interface AppealFundingCardProps {
  item: SubgraphItem
  registry: SubgraphRegistry
  timestamp?: BigNumber
  appealCost?: BigNumber
}

const AppealFundingCard = ({
  item,
  registry,
  timestamp,
  appealCost,
}: AppealFundingCardProps) => {
  const nativeCurrency = useNativeCurrency()
  const { sharedStakeMultiplier, winnerStakeMultiplier, loserStakeMultiplier } =
    registry || {}
  const multipliers = {
    sharedStakeMultiplier: toBigNumber(sharedStakeMultiplier),
    winnerStakeMultiplier: toBigNumber(winnerStakeMultiplier),
    loserStakeMultiplier: toBigNumber(loserStakeMultiplier),
    item,
    MULTIPLIER_DIVISOR,
    appealCost,
  }
  const requesterFees = useRequiredFees({
    side: PARTY.REQUESTER,
    ...multipliers,
  })
  const challengerFees = useRequiredFees({
    side: PARTY.CHALLENGER,
    ...multipliers,
  })

  if (
    !item ||
    !registry ||
    !timestamp ||
    !item.challenges ||
    item.challenges.length === 0 ||
    !appealCost
  )
    return null

  const statusCode = stakeStatusCode(item, timestamp, registry)
  if (
    statusCode !== STATUS_CODE.CROWDFUNDING &&
    statusCode !== STATUS_CODE.CROWDFUNDING_WINNER
  )
    return null

  const round = item.challenges[0].rounds[0]
  if (
    !requesterFees.requiredForSide ||
    !requesterFees.potentialReward ||
    !challengerFees.requiredForSide ||
    !challengerFees.potentialReward
  )
    return null

  const decisive = round.ruling !== SUBGRAPH_RULING.NONE
  const submitterWins = round.ruling === SUBGRAPH_RULING.ACCEPT
  const winner = submitterWins ? 'submitter' : 'challenger'
  const loser = submitterWins ? 'challenger' : 'submitter'

  return (
    <Card $padding="standard" role="region" aria-label="Appeal funding">
      <Stack $gap={4}>
        <Label $tone="faint">Appeal funding</Label>
        <Small $muted>
          Share of each side&apos;s appeal fee raised so far. Hatched: still
          needed.
        </Small>
      </Stack>
      <Side
        name="Submitter"
        paid={BigNumber.from(String(round.amountPaidRequester))}
        required={requesterFees.requiredForSide}
        funded={!!round.hasPaidRequester}
        reward={requesterFees.potentialReward}
        role={decisive ? (submitterWins ? 'winning' : 'losing') : undefined}
        currency={nativeCurrency}
      />
      <Side
        name="Challenger"
        paid={BigNumber.from(String(round.amountPaidChallenger))}
        required={challengerFees.requiredForSide}
        funded={!!round.hasPaidChallenger}
        reward={challengerFees.potentialReward}
        role={decisive ? (submitterWins ? 'losing' : 'winning') : undefined}
        currency={nativeCurrency}
      />
      <Small $faint>
        {decisive
          ? `The ${loser} must be fully funded in the first half of the period; then the ${winner} must fund too, or the ${loser} wins.`
          : 'If one side is fully funded, the other must fund too or loses the dispute.'}
      </Small>
    </Card>
  )
}

export default AppealFundingCard
