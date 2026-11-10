import React, { useContext, useEffect, useState } from 'react'
import styled from 'styled-components'
import { BigNumber } from 'ethers'
import {
  PARTY,
  SUBGRAPH_RULING,
  CONTRACT_STATUS,
  itemToStatusCode,
  STATUS_CODE,
} from 'utils/item-status'
import { TCRViewContext } from 'contexts/tcr-view-context'
import useRequiredFees from 'hooks/required-fees'
import useNativeCurrency from 'hooks/native-currency'
import {
  Chip,
  Label,
  Small,
  Stack,
  Surface,
} from 'components/curate/primitives'
import { formatAmount, formatEther } from 'components/curate/item-light-format'

/*
 * Appeal funding: for each side, how much of its appeal fee is raised. The
 * bar is the share funded (filled) against what is still needed (hatched),
 * with the exact amounts under it and what backers can win. Rendered only
 * while the dispute can be appealed.
 */

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
const Fill = styled.span<{ $tone: string }>`
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: var(--radius-pill);
  background: ${({ $tone }) => $tone};
  box-shadow: 0 0 14px
    color-mix(in srgb, ${({ $tone }) => $tone} 55%, transparent);
  transition:
    width 900ms var(--ease-out),
    min-width 900ms var(--ease-out);

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

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
      : paid.mul(10000).div(required).toNumber() / 10000
  const tone = funded ? 'var(--status-registered)' : 'var(--status-contested)'
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
      aria-label={`${name}: ${Math.round(share * 100)}% of the appeal fee raised, ${formatEther(
        paid,
      )} of ${formatAmount(required, currency)}`}
    >
      <SideHead>
        <Name>
          {name}
          {role && <Chip>{role}</Chip>}
        </Name>
        <Share>{Math.round(share * 100)}%</Share>
      </SideHead>
      <Track aria-hidden>
        <Fill
          $tone={tone}
          style={{
            width: shown ? `${width}%` : '0%',
            minWidth: shown && width > 0 ? 10 : 0,
          }}
        />
      </Track>
      <Small $muted>
        {funded
          ? `Fully funded · ${formatAmount(required, currency)}`
          : `${formatEther(paid)} of ${formatAmount(
              required,
              currency,
            )} raised · backers can win up to ${formatAmount(reward, currency)}`}
      </Small>
    </Stack>
  )
}

interface CrowdfundingCardProps {
  item: SubgraphItem
  timestamp?: BigNumber
  appealCost?: BigNumber
}

const CrowdfundingCard = ({
  item,
  timestamp,
  appealCost,
}: CrowdfundingCardProps) => {
  const {
    challengePeriodDuration,
    sharedStakeMultiplier,
    winnerStakeMultiplier,
    loserStakeMultiplier,
    MULTIPLIER_DIVISOR,
  } = useContext(TCRViewContext) ?? {}
  const nativeCurrency = useNativeCurrency()

  const requesterFees = useRequiredFees({
    side: PARTY.REQUESTER,
    sharedStakeMultiplier,
    winnerStakeMultiplier,
    loserStakeMultiplier,
    item,
    MULTIPLIER_DIVISOR,
    appealCost,
  })
  const challengerFees = useRequiredFees({
    side: PARTY.CHALLENGER,
    sharedStakeMultiplier,
    winnerStakeMultiplier,
    loserStakeMultiplier,
    item,
    MULTIPLIER_DIVISOR,
    appealCost,
  })

  if (!item || !challengePeriodDuration || !MULTIPLIER_DIVISOR) return null
  const round = item.requests?.[0]?.rounds?.[0]
  if (!round) return null
  const { hasPaidRequester, hasPaidChallenger, ruling: currentRuling } = round

  const amountPaidRequester = BigNumber.from(round.amountPaidRequester)
  const amountPaidChallenger = BigNumber.from(round.amountPaidChallenger)

  if (
    !requesterFees ||
    !challengerFees ||
    !challengerFees.requiredForSide ||
    !challengerFees.potentialReward ||
    !requesterFees.requiredForSide ||
    !requesterFees.potentialReward ||
    !appealCost
  )
    return null

  const statusCode = itemToStatusCode(item, timestamp, challengePeriodDuration)

  if (
    !(
      statusCode === STATUS_CODE.CROWDFUNDING ||
      statusCode === STATUS_CODE.CROWDFUNDING_WINNER
    )
  )
    return null

  const isRegistration = item.status === CONTRACT_STATUS.REGISTRATION_REQUESTED
  const requesterName = isRegistration ? 'Submitter' : 'Requester'
  const decisive = currentRuling !== SUBGRAPH_RULING.NONE
  const requesterWins = currentRuling === SUBGRAPH_RULING.ACCEPT
  const winner = requesterWins ? requesterName.toLowerCase() : 'challenger'
  const loser = requesterWins ? 'challenger' : requesterName.toLowerCase()

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
        name={requesterName}
        paid={amountPaidRequester}
        required={requesterFees.requiredForSide}
        funded={!!hasPaidRequester}
        reward={requesterFees.potentialReward}
        role={decisive ? (requesterWins ? 'winning' : 'losing') : undefined}
        currency={nativeCurrency}
      />
      <Side
        name="Challenger"
        paid={amountPaidChallenger}
        required={challengerFees.requiredForSide}
        funded={!!hasPaidChallenger}
        reward={challengerFees.potentialReward}
        role={decisive ? (requesterWins ? 'losing' : 'winning') : undefined}
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

export default CrowdfundingCard
