import React, { useLayoutEffect, useRef } from 'react'
import styled from 'styled-components'

/*
 * Count-up for figures that arrive as formatted text ("9,141", "51.6 xDAI",
 * "1000.0 PNK + 0.03 xDAI"): on the first reveal every number in the string
 * climbs from zero while the words stay still; later changes (a total that
 * follows what the user types) show at once, so the figure never lags the
 * button beside it. Frames are written to the DOM through a ref, not React
 * state. The last frame is the original string, character for character, so
 * long decimals stay exact. Anything that is not a string renders as is.
 * Reduced motion: no climb.
 */

const NUMBER = /\d[\d,]*(?:\.\d+)?/g

const SrOnly = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t))

interface Token {
  value: number
  decimals: number
  grouped: boolean
}

const parse = (text: string): Token[] =>
  (text.match(NUMBER) ?? []).map((raw) => {
    const [, fraction = ''] = raw.split('.')
    return {
      value: Number(raw.replace(/,/g, '')),
      decimals: Math.min(fraction.length, 6),
      grouped: raw.includes(','),
    }
  })

const formatToken = (token: Token, value: number) =>
  token.grouped
    ? new Intl.NumberFormat('en-US', {
        minimumFractionDigits: token.decimals,
        maximumFractionDigits: token.decimals,
      }).format(value)
    : value.toFixed(token.decimals)

/** True when the text is a plain count such as "9,141". */
export const isPlainCount = (value: unknown): value is string =>
  typeof value === 'string' && /^\d[\d,]*$/.test(value.trim())

/** The text with every number at `progress` (0..1) of its way up from zero. */
const frameText = (text: string, targets: Token[], progress: number) => {
  let index = 0
  return text.replace(NUMBER, () => {
    const target = targets[index]
    index += 1
    return target ? formatToken(target, target.value * progress) : ''
  })
}

export const CountUpText = ({
  value,
  duration = 1400,
}: {
  value: React.ReactNode
  duration?: number
}) => {
  const text = typeof value === 'string' ? value : undefined
  const node = useRef<HTMLSpanElement>(null)
  // Set once a figure with numbers has been shown; later values jump.
  const revealed = useRef(false)

  // Layout effect: the first frame is written before paint, so the final
  // figure never flashes first. React never renders this span's text.
  useLayoutEffect(() => {
    const el = node.current
    if (!el || text === undefined) return
    const targets = parse(text)
    if (revealed.current || targets.length === 0 || prefersReducedMotion()) {
      el.textContent = text
      if (targets.length > 0) revealed.current = true
      return
    }
    revealed.current = true
    el.textContent = frameText(text, targets, 0)
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      el.textContent = t < 1 ? frameText(text, targets, easeOutExpo(t)) : text
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(frame)
      el.textContent = text
    }
  }, [text, duration])

  if (text === undefined) return <>{value}</>
  return (
    <>
      <SrOnly>{text}</SrOnly>
      <span ref={node} aria-hidden />
    </>
  )
}

export default CountUpText
