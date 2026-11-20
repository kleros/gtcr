import React from 'react'
import styled from 'styled-components'
import EthereumLogo from 'assets/images/chains/ethereum.svg'
import GnosisLogo from 'assets/images/chains/gnosis.svg'
import { NETWORKS } from 'config/networks'

/*
 * A chain's mark on a small plate of its own hue: the plate is the surface
 * drawn faintly toward the chain's brand colour, with a hairline in that
 * colour and a top highlight, so marks of different chains read as one set
 * and each stays legible in every theme (the mark clears 3:1 against its
 * plate, measured).
 *
 * The plate is painted entirely as inset shadows (the tint is mixed into
 * the opaque surface, so it is opaque itself) and the span refuses any
 * background: a fill a page sets on it (a plate it drew itself) can neither
 * show through nor bleed as a light rim at the anti-aliased round edge, and
 * overlapped marks in a stack cover each other cleanly.
 *
 * Brand colours (not theme tokens): Gnosis green #3E6957 and Ethereum
 * #627EEA. The Gnosis owl is a dark green that sank into the dark themes
 * (2.7:1 on the old neutral plate), so there it is drawn in a lighter tint
 * of the same green (8:1 on its plate); on light it keeps its own colour
 * (5.5:1). The Ethereum mark keeps its colours everywhere: its fills carry
 * it on the dark themes (5.4:1 or more), its navy outline on light (10:1).
 */
type Mark = {
  Logo: React.ComponentType<React.SVGProps<SVGSVGElement>>
  hue: string
  /** The mark's own colour, lifted for the dark themes (single-colour marks only). */
  lifted?: string
}

const GNOSIS: Mark = { Logo: GnosisLogo, hue: '#3e6957', lifted: '#8cc4a8' }
const ETHEREUM: Mark = { Logo: EthereumLogo, hue: '#627eea' }

const Frame = styled.span<{ $size: number }>`
  --plate-tint: 22%;
  --plate-ring: 40%;

  position: relative;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  overflow: hidden;
  border-radius: var(--radius-pill);
  /* Important: the plate below is the only fill (see above). */
  background: none !important;
  box-shadow:
    inset 0 1px 0 var(--glass-highlight),
    inset 0 0 0 1px
      color-mix(in srgb, var(--chain-hue) var(--plate-ring), transparent),
    inset 0 0 0 ${({ $size }) => $size}px
      color-mix(
        in srgb,
        var(--chain-hue) var(--plate-tint),
        var(--color-surface)
      );

  body[data-theme='light'] & {
    --plate-tint: 9%;
    --plate-ring: 30%;
  }

  svg {
    width: ${({ $size }) => Math.max(12, $size - 4)}px;
    height: ${({ $size }) => Math.max(12, $size - 4)}px;
  }

  body:not([data-theme='light']) &[data-lifted] path {
    fill: var(--chain-lifted);
  }
`

const ChainLogo = ({
  chainId,
  size = 18,
}: {
  chainId: number
  size?: number
}) => {
  const { Logo, hue, lifted } = chainId === NETWORKS.gnosis ? GNOSIS : ETHEREUM

  return (
    <Frame
      $size={size}
      aria-hidden="true"
      data-lifted={lifted ? '' : undefined}
      style={
        {
          '--chain-hue': hue,
          '--chain-lifted': lifted,
        } as React.CSSProperties
      }
    >
      <Logo />
    </Frame>
  )
}

export default ChainLogo
