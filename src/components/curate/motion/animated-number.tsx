import React from 'react'
import useCountUp from 'hooks/use-count-up'
import { NumberSkeleton, VisuallyHidden } from '../primitives'
import { groupThousands } from '../item-standard-format'

const formatter = new Intl.NumberFormat('en-US')

/**
 * A `format` for counting up to an exact decimal amount ("0.0309"): the
 * rolling values at the amount's precision (up to six places), then the
 * exact string itself, both grouped in thousands.
 */
export const amountFormat = (exact: string) => {
  const decimals = Math.min(6, (exact.split('.')[1] ?? '').length)
  const target = Number(exact)
  const rolling = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return (n: number) =>
    n === target ? groupThousands(exact) : rolling.format(n)
}

/**
 * A count-up number; a shimmer while `loading`, an em dash while the value
 * is otherwise unknown (a read failed). Screen
 * readers get the final value as text (aria-label on a plain span is not
 * announced), the rolling digits stay hidden from them.
 */
export const AnimatedNumber = ({
  value,
  duration,
  format = (n: number) => formatter.format(Math.round(n)),
  loading = false,
}: {
  value?: number
  duration?: number
  format?: (n: number) => string
  loading?: boolean
}) => {
  const current = useCountUp(loading ? undefined : value, duration)
  if (loading) return <NumberSkeleton />
  if (value === undefined) return <>—</>
  return (
    <>
      <VisuallyHidden>{format(value)}</VisuallyHidden>
      <span aria-hidden>{format(current)}</span>
    </>
  )
}

export default AnimatedNumber
