import React, { useEffect } from 'react'
import styled, { keyframes } from 'styled-components'
import { useLocation } from 'react-router-dom'

/*
 * The stage (round 2): the page is the stage colour edge to edge, and the
 * aurora is a soft glow behind the top of the page only. Two slow pools and
 * one shallow band drift over a minute under a grain layer that kills
 * banding; the whole glow fades out before the content gets dense and
 * scrolls away with the page. The dashboard gets the full glow, inner routes
 * a shorter, dimmer one so the content leads. Drift pauses when the tab is
 * hidden and under reduced motion. The glow stays faint enough that muted
 * text over it keeps 4.5:1.
 */

const driftA = keyframes`
  to { transform: translate3d(5vmax, 2vmax, 0) scale(1.06); }
`
const driftB = keyframes`
  to { transform: translate3d(-4vmax, 3vmax, 0) scale(1.05); }
`
const driftBand = keyframes`
  from { transform: translate3d(0, 0, 0) rotate(-12deg) scale(1); }
  to { transform: translate3d(3vw, 2vh, 0) rotate(-9deg) scale(1.05); }
`

const Root = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 0;
  height: 1040px;
  overflow: hidden;
  pointer-events: none;
  -webkit-mask-image: linear-gradient(to bottom, #000 35%, transparent);
  mask-image: linear-gradient(to bottom, #000 35%, transparent);
  transition: height 900ms var(--ease-in-out);

  [data-light='underglow'] & {
    height: 680px;
  }

  /* The layers and the aurora's own pools and band (its children). */
  > *,
  > * > * {
    position: absolute;
    will-change: transform;
    transition: opacity 900ms var(--ease-in-out);
  }

  @media (prefers-reduced-motion: reduce) {
    > *,
    > * > * {
      animation: none !important;
    }
  }

  @media (max-width: 720px) {
    height: 760px;

    [data-light='underglow'] & {
      height: 520px;
    }
  }
`

const PoolA = styled.div`
  width: 80vmax;
  height: 80vmax;
  left: -30vmax;
  top: -52vmax;
  background: radial-gradient(
    closest-side,
    color-mix(in srgb, var(--aurora-b) 25%, transparent),
    color-mix(in srgb, var(--aurora-a) 11%, transparent) 48%,
    transparent 74%
  );
  animation: ${driftA} 48s var(--ease-in-out) infinite alternate;
`

const Band = styled.div`
  width: 140vw;
  height: 420px;
  left: -20vw;
  top: -250px;
  transform: rotate(-12deg);
  background: linear-gradient(
    90deg,
    transparent 6%,
    color-mix(in srgb, var(--aurora-a) 30%, transparent) 28%,
    color-mix(in srgb, var(--aurora-b) 36%, transparent) 48%,
    color-mix(in srgb, var(--aurora-c) 22%, transparent) 74%,
    transparent 94%
  );
  -webkit-mask-image: radial-gradient(
    closest-side,
    #000,
    rgba(0, 0, 0, 0.5) 55%,
    transparent
  );
  mask-image: radial-gradient(
    closest-side,
    #000,
    rgba(0, 0, 0, 0.5) 55%,
    transparent
  );
  animation: ${driftBand} 40s var(--ease-in-out) infinite alternate;
`

const PoolB = styled.div`
  width: 70vmax;
  height: 70vmax;
  right: -28vmax;
  top: -46vmax;
  background: radial-gradient(
    closest-side,
    color-mix(in srgb, var(--aurora-c) 28%, transparent),
    color-mix(in srgb, var(--aurora-a) 10%, transparent) 50%,
    transparent 75%
  );
  animation: ${driftB} 56s var(--ease-in-out) infinite alternate;
`

const Grain = styled.div`
  inset: 0;
  background-image: var(--noise);
  background-size: 180px;
  opacity: 0.05;
  mix-blend-mode: overlay;
`

const Aurora = styled.div`
  inset: 0;

  [data-light='underglow'] & {
    opacity: 0.55;
  }

  /* The pale light aurora is set lower so faint text keeps 4.5:1 over it. */
  [data-theme='light'] & {
    opacity: 0.48;
  }

  [data-theme='light'][data-light='underglow'] & {
    opacity: 0.34;
  }
`

/** Picks the lighting for the route: full glow on the home page, dimmer inside. */
export const useRouteLighting = () => {
  const { pathname } = useLocation()
  const light = pathname === '/' ? 'aurora' : 'underglow'
  useEffect(() => {
    document.body.setAttribute('data-light', light)
  }, [light])
}

const Stage = () => {
  useRouteLighting()
  useEffect(() => {
    const sync = () =>
      document.documentElement.toggleAttribute('data-paused', document.hidden)
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])
  return (
    <Root aria-hidden>
      <Aurora>
        <PoolA />
        <Band />
        <PoolB />
      </Aurora>
      <Grain />
    </Root>
  )
}

export default Stage
