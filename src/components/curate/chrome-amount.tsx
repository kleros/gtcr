import styled, { keyframes } from 'styled-components'

/*
 * Chrome: the place an amount takes while it loads. An inline shimmer the
 * width of a short figure, sitting on the text baseline, so the line around
 * it does not jump when the number lands.
 */

const shimmer = keyframes`
  from { background-position: 100% 0; }
  to { background-position: -100% 0; }
`

export const AmountPending = styled.span.attrs({
  role: 'status',
  'aria-label': 'Loading amount',
})`
  display: inline-block;
  width: 3.2em;
  height: 0.9em;
  border-radius: var(--radius-pill);
  background:
    linear-gradient(
        90deg,
        transparent,
        color-mix(in srgb, var(--color-text) 14%, transparent),
        transparent
      )
      0 0 / 200% 100%,
    var(--color-raised);
  vertical-align: -0.1em;
  animation: ${shimmer} 1.4s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

export default AmountPending
