import { css } from 'styled-components'

export const BREAKPOINT_LANDSCAPE = 900

export const smallScreenStyle = styleFn => css`
  @media (max-width: ${BREAKPOINT_LANDSCAPE}px) {
    ${() => styleFn()}
  }
`
