import React from 'react'
import useCountUp from 'hooks/use-count-up'
import { VisuallyHidden } from '../primitives'

const formatter = new Intl.NumberFormat('en-US')

/**
 * A count-up number; renders an em dash until the value is known. Screen
 * readers get the final value as text (aria-label on a plain span is not
 * announced), the rolling digits stay hidden from them.
 */
export const AnimatedNumber = ({
  value,
  duration,
  format = (n: number) => formatter.format(Math.round(n)),
}: {
  value?: number
  duration?: number
  format?: (n: number) => string
}) => {
  const current = useCountUp(value, duration)
  if (value === undefined) return <>—</>
  return (
    <>
      <VisuallyHidden>{format(value)}</VisuallyHidden>
      <span aria-hidden>{format(current)}</span>
    </>
  )
}

export default AnimatedNumber
