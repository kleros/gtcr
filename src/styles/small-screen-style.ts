import { css, FlattenSimpleInterpolation } from 'styled-components'

export const MAX_WIDTH_CONTENT = '1400px'
export const BREAKPOINT_LANDSCAPE = 900

export const smallScreenStyle = (
  styleFn: () => FlattenSimpleInterpolation,
): FlattenSimpleInterpolation => css`
  @media (max-width: ${BREAKPOINT_LANDSCAPE}px) {
    ${() => styleFn()}
  }
`
