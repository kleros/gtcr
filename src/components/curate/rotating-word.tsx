import React, { useEffect, useState } from 'react'
import styled, { keyframes } from 'styled-components'

/*
 * One word of a headline that runs through a few examples, once, then rests
 * on the last: "Verify tokens, … contracts, … anything,". It never loops, so
 * nothing on the page keeps moving (WCAG 2.2.2 asks for a pause control only
 * for motion that goes on past five seconds and repeats). Under reduced
 * motion it shows the first word and stays there. It runs only while the
 * page is visible, so a background tab does not finish it unseen.
 *
 * The word is decoration for sighted readers: the headline carries the
 * whole sentence for screen readers (the caller's VisuallyHidden text), and
 * this element is aria-hidden, so a reader never hears it change.
 */

const enter = keyframes`
  from {
    opacity: 0;
    transform: translateY(0.3em);
    filter: blur(4px);
  }
  to {
    opacity: 1;
    transform: none;
    filter: none;
  }
`

const Word = styled.span`
  display: inline-block;
  animation: ${enter} 0.5s cubic-bezier(0.2, 0.7, 0.2, 1);

  /* The first word paints with the page: only a change animates. */
  &[data-first] {
    animation: none;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const RotatingWord = ({
  words,
  interval = 1600,
  suffix = '',
}: {
  /** In order; the last one is where it rests. */
  words: readonly string[]
  /** Milliseconds each word stays. */
  interval?: number
  /** Text kept with each word, e.g. its comma. */
  suffix?: string
}) => {
  const [index, setIndex] = useState(0)
  const last = words.length - 1

  useEffect(() => {
    if (index >= last || reducedMotion()) return undefined
    let timer: number | undefined
    const schedule = () => {
      window.clearTimeout(timer)
      if (document.visibilityState === 'visible')
        timer = window.setTimeout(
          () => setIndex((i) => Math.min(i + 1, last)),
          interval,
        )
    }
    schedule()
    document.addEventListener('visibilitychange', schedule)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', schedule)
    }
  }, [index, last, interval])

  return (
    <Word key={index} data-first={index === 0 ? '' : undefined} aria-hidden>
      {words[index]}
      {suffix}
    </Word>
  )
}

export default RotatingWord
