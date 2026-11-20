import { css, keyframes } from 'styled-components'

const rise = keyframes`
  from { opacity: 0; transform: translateY(14px); filter: blur(4px); }
  to { opacity: 1; transform: none; filter: none; }
`

/** Staggered entrance: give each element `style={{ '--i': n }}`. */
export const reveal = css`
  animation: ${rise} 700ms cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--i, 0) * 70ms);

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`
