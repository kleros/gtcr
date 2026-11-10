import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import { VisuallyHidden } from '../primitives'

/*
 * Odometer: each digit rolls on its own column to its value (the Energy
 * dashboard's number roll). Separators stay still. Reduced motion: no roll.
 */

const Wrap = styled.span`
  display: inline-flex;
  align-items: baseline;
  font-variant-numeric: tabular-nums;
  line-height: 1;
`

const Column = styled.span`
  position: relative;
  display: inline-block;
  height: 1em;
  overflow: hidden;
  /* Fade the digits in and out at the column's edges while they roll. */
  mask-image: linear-gradient(transparent, black 18%, black 82%, transparent);
  -webkit-mask-image: linear-gradient(
    transparent,
    black 18%,
    black 82%,
    transparent
  );
`

const Stack = styled.span<{ $digit: number; $delay: number }>`
  display: flex;
  flex-direction: column;
  transform: translateY(${({ $digit }) => -$digit}em);
  transition: transform 1600ms cubic-bezier(0.16, 1, 0.3, 1);
  transition-delay: ${({ $delay }) => $delay}ms;

  span {
    display: block;
    height: 1em;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const formatter = new Intl.NumberFormat('en-US')

export const Odometer = ({ value }: { value?: number }) => {
  const target =
    value === undefined ? undefined : formatter.format(Math.round(value))
  // Render zeros first, then roll to the value on the next frame.
  const [shown, setShown] = useState<string | undefined>(
    target?.replace(/\d/g, '0'),
  )
  // Once the roll ends, swap the columns for plain text so the figure keeps
  // the font's own spacing and tracking.
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    if (target === undefined) return
    setSettled(false)
    setShown(target.replace(/\d/g, '0'))
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => setShown(target)),
    )
    const done = window.setTimeout(
      () => setSettled(true),
      1600 + target.length * 60 + 120,
    )
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(done)
    }
  }, [target])

  if (target === undefined || shown === undefined) return <>—</>
  if (settled) return <span>{target}</span>
  const chars = shown.split('')
  return (
    <Wrap>
      <VisuallyHidden>{target}</VisuallyHidden>
      {chars.map((char, index) =>
        /\d/.test(char) ? (
          <Column key={`${index}-${chars.length}`} aria-hidden>
            <Stack $digit={Number(char)} $delay={(chars.length - index) * 60}>
              {Array.from({ length: 10 }, (_, d) => (
                <span key={d}>{d}</span>
              ))}
            </Stack>
          </Column>
        ) : (
          <span key={`${index}-${chars.length}`} aria-hidden>
            {char}
          </span>
        ),
      )}
    </Wrap>
  )
}

export default Odometer
