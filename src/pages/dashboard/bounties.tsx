import React, { useId } from 'react'
import styled from 'styled-components'
import ChainLogo from 'components/chain-logo'
import { Label, SkeletonBlock, Small } from 'components/curate/primitives'
import { AnimatedNumber } from 'components/curate/motion/animated-number'
import { RingGauge } from 'components/curate/motion/ring-gauge'
import { reveal } from 'components/curate/motion/reveal'
import { chainInfo, type BountyCoin, type scopedBounties } from './view'

/*
 * Bounties won (round 2, items 14 and 15): what challengers have taken, all
 * time, in the page's chain scope. A challenger who spots an entry that
 * breaks its list's rules and wins in court gets their own deposit back and
 * takes the requester's deposit (Light, Classic) or the entry's stake
 * (Stake). One figure per coin, never added across coins; under each, the
 * chain and how many bounties it paid; then how many different challengers
 * won them. The ring is the share of every ruling the court has issued that
 * went to the challenger. A chain whose ledger did not load is named, never
 * counted as zero.
 */

type Bounties = ReturnType<typeof scopedBounties>

const integer = new Intl.NumberFormat('en-US')
const formatInt = (value: number) => integer.format(value)
const amountFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 4,
})

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
  min-width: 0;
`

const Head = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 16px;

  h3 {
    margin: 0;
  }
`

/* Phones: one coin per row, the amount on the left, where and how many on the right. */
const phoneCoins = `
  @media (max-width: 520px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;

    > li {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      column-gap: 12px;
      row-gap: 2px;
      padding: 10px 0;
      border-left: 0;
      border-top: 1px solid var(--glass-border);
    }

    > li > b {
      grid-row: span 2;
      margin: 0;
    }

    > li > span {
      justify-self: end;
    }
  }
`

const Coins = styled.ul`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 14px 24px;
  margin: 0;
  padding: 0;
  list-style: none;
  ${phoneCoins}
`

const Coin = styled.li`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding-left: 14px;
  border-left: 1px solid var(--glass-border);
  ${reveal}

  b {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0 6px;
    color: var(--color-text);
    font-family: var(--font-figure);
    font-size: clamp(22px, 0.8vw + 14px, 28px);
    line-height: 1.1;
    font-weight: 500;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
    margin-bottom: 4px;
  }

  b small {
    color: var(--color-muted);
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 0;
  }
`

const CoinMeta = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  white-space: nowrap;

  > span {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`

const Won = styled.span`
  color: var(--color-faint);
  font-family: var(--font-figure);
  font-size: 12px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
`

/** "Ethereum and Gnosis" */
const chainNames = (chains: number[]) =>
  chains
    .map((chainId) => chainInfo(chainId)?.name ?? `Chain ${chainId}`)
    .join(' and ')

const coinPlace = (coin: BountyCoin) => {
  const chain = chainInfo(coin.chainId)?.name ?? `Chain ${coin.chainId}`
  return coin.token ? `Stake · ${chain}` : chain
}

/** The ring: the share of every ruling that went to the challenger. */
export const BountiesRing = ({
  bounties,
  ringKey,
}: {
  bounties?: Bounties
  ringKey: string
}) => {
  if (!bounties)
    return (
      <SkeletonBlock
        $width="148px"
        $height="148px"
        style={{ borderRadius: '50%' }}
      />
    )
  const plus = bounties.capped ? '+' : ''
  const unknown = bounties.rulings === 0 && bounties.missing.length > 0
  // A chain whose ledger did not load: the share covers the others, by name.
  const partial = bounties.missing.length > 0 && bounties.loaded.length > 0
  const where = partial ? ` on ${chainNames(bounties.loaded)}` : ''
  return (
    <RingGauge
      key={ringKey}
      size={168}
      ratio={bounties.rulings ? bounties.won / bounties.rulings : 0}
      value={bounties.rulings ? undefined : '—'}
      from="var(--edge-3)"
      to="var(--edge-2)"
      label={
        bounties.rulings
          ? `Challengers won ${formatInt(bounties.won)}${plus} of ${formatInt(bounties.rulings)}${plus} rulings${where}, all time.`
          : unknown
            ? 'The rulings did not load.'
            : 'No rulings yet.'
      }
      caption={
        bounties.rulings
          ? `of rulings${where} went to the challenger`
          : unknown
            ? 'did not load'
            : 'no rulings yet'
      }
    />
  )
}

/** The title, one figure per coin, and what a bounty is. */
export const BountiesBody = ({ bounties }: { bounties?: Bounties }) => {
  const titleId = useId()
  const plus = bounties?.capped ? '+' : ''
  const missingChains = bounties?.missing ?? []
  const missing = missingChains.length > 0 ? chainNames(missingChains) : ''
  const winners = bounties?.winners ?? 0
  const unknown = !!bounties && bounties.rulings === 0 && !!missing
  return (
    <Body>
      <Head>
        <h3 id={titleId}>Bounties won</h3>
        <Label $tone="faint">All time</Label>
      </Head>
      {!bounties ? (
        <SkeletonBlock $height="58px" />
      ) : unknown ? null : bounties.coins.length === 0 ? (
        <Small $muted as="p" style={{ margin: 0 }}>
          {bounties.rulings
            ? bounties.rulings === 1 && !plus
              ? 'No bounty yet: the one ruling did not go to a challenger.'
              : `No bounty yet: none of the ${formatInt(bounties.rulings)}${plus} rulings went to a challenger.`
            : 'No dispute has been ruled on yet.'}
        </Small>
      ) : (
        <Coins aria-labelledby={titleId}>
          {bounties.coins.map((coin, index) => (
            <Coin key={coin.key} style={{ ['--i' as string]: index }}>
              <b>
                {coin.value !== undefined ? (
                  <span>
                    <AnimatedNumber
                      value={coin.value}
                      format={(value) => amountFormat.format(value)}
                    />
                  </span>
                ) : (
                  <span aria-hidden>—</span>
                )}
                <small>{coin.symbol}</small>
              </b>
              <CoinMeta title={coin.display}>
                <ChainLogo chainId={coin.chainId} size={14} />
                <span>{coinPlace(coin)}</span>
              </CoinMeta>
              <Won>
                {formatInt(coin.won)}
                {plus} {coin.won === 1 ? 'bounty' : 'bounties'}
              </Won>
            </Coin>
          ))}
        </Coins>
      )}
      <Small $faint as="p" style={{ margin: 0 }}>
        {missing
          ? `The rulings on ${missing} did not load: ${missingChains.length > 1 ? 'their' : 'its'} bounties are not counted here.`
          : winners > 0
            ? `Won by ${formatInt(winners)}${plus} ${winners === 1 ? 'challenger who' : 'different challengers who'} spotted a mistake, on top of their own deposit back.`
            : 'Won by challengers who spot a mistake, on top of their own deposit back.'}
      </Small>
    </Body>
  )
}
