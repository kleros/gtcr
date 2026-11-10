import React, { useLayoutEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { Link, useLocation } from 'react-router-dom'
import ChainLogo from 'components/chain-logo'
import { Label } from 'components/curate/primitives'
import { litThumb, recessTrack } from 'components/ui/kit-styles'
import { NETWORKS_INFO } from 'config/networks'

/*
 * The chain the new list will be deployed on, as real links to
 * /launch/:chainId (so each chain has its own URL), in the selector
 * language of the app bar nav and Browse's segments: a recessed track whose
 * raised, lit thumb slides to the current chain. It is labelled, because it
 * is not the app bar's chain selector: it only picks the factory the chosen
 * card opens. The query string rides along, so a chosen list type survives
 * the switch.
 */

const Wrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px 12px;
  max-width: 100%;

  @media (max-width: 720px) {
    justify-content: flex-start;
  }
`

const Track = styled.nav`
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  max-width: 100%;
  padding: 3px;
  border-radius: var(--radius-pill);
  ${recessTrack}
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
`

const Pill = styled.span`
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 0;
  z-index: -1;
  border-radius: var(--radius-pill);
  ${litThumb}
  transition:
    transform var(--dur-control) var(--ease-spring),
    width var(--dur-control) var(--ease-spring);

  /* First paint, resizes and the webfont swap: jump, do not slide. */
  &[data-instant] {
    transition: none;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const Item = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 14px 0 10px;
  border-radius: var(--radius-pill);
  color: var(--color-muted);
  font-size: 13px;
  line-height: 16px;
  font-weight: 500;
  white-space: nowrap;
  text-decoration: none;
  transition: color var(--motion);

  &:hover,
  &[aria-current='page'] {
    color: var(--color-text);
  }

  /* The track clips, so the focus ring sits inside the link. */
  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }

  small {
    color: var(--color-faint);
    font-size: 11px;
    font-weight: 400;
  }
`

type PillBox = { left: number; width: number; instant: boolean }

export const ChainSwitch = ({
  chainId,
  chains,
  testnets,
  className,
  style,
}: {
  chainId: number
  chains: number[]
  testnets: number[]
  className?: string
  style?: React.CSSProperties
}) => {
  const track = useRef<HTMLElement>(null)
  const [pill, setPill] = useState<PillBox>()
  const { search } = useLocation()

  // Slide to the current chain when it changes.
  useLayoutEffect(() => {
    const node = track.current?.querySelector<HTMLAnchorElement>(
      '[aria-current="page"]',
    )
    if (node)
      setPill((previous) => ({
        left: node.offsetLeft,
        width: node.offsetWidth,
        instant: !previous,
      }))
  }, [chainId, chains.length])

  // Re-measure without sliding when the track resizes or the webfont lands.
  useLayoutEffect(() => {
    const node = track.current
    if (!node) return
    const remeasure = () => {
      const current = node.querySelector<HTMLAnchorElement>(
        '[aria-current="page"]',
      )
      if (!current) return
      setPill((previous) =>
        previous &&
        previous.left === current.offsetLeft &&
        previous.width === current.offsetWidth
          ? previous
          : {
              left: current.offsetLeft,
              width: current.offsetWidth,
              instant: true,
            },
      )
    }
    let live = true
    document.fonts?.ready.then(() => live && remeasure())
    if (typeof ResizeObserver === 'undefined')
      return () => {
        live = false
      }
    const observer = new ResizeObserver(remeasure)
    observer.observe(node)
    return () => {
      live = false
      observer.disconnect()
    }
  }, [])

  return (
    <Wrap className={className} style={style}>
      <Label $tone="faint" id="launch-chain-label">
        Deploy on
      </Label>
      <Track ref={track} aria-labelledby="launch-chain-label">
        {pill && (
          <Pill
            aria-hidden
            data-instant={pill.instant ? '' : undefined}
            style={{
              transform: `translateX(${pill.left}px)`,
              width: pill.width,
            }}
          />
        )}
        {chains.map((id) => {
          const name =
            NETWORKS_INFO[id as keyof typeof NETWORKS_INFO]?.name ??
            `Chain ${id}`
          const test = testnets.includes(id)
          return (
            <Item
              key={id}
              to={{ pathname: `/launch/${id}`, search }}
              aria-current={id === chainId ? 'page' : undefined}
              title={test ? `${name} (test network)` : name}
            >
              <ChainLogo chainId={id} size={16} />
              {name}
              {test && <small>test</small>}
            </Item>
          )
        })}
      </Track>
    </Wrap>
  )
}

export default ChainSwitch
