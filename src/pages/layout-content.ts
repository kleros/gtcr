import styled, { css } from 'styled-components'
import Layout from 'components/ui/Layout'
import { smallScreenStyle } from 'styles/small-screen-style'

const StyledLayoutContent = styled(Layout.Content)`
  padding: 42px var(--horizontal-padding) 42px;

  ${smallScreenStyle(
    () => css`
      padding-top: 24px;
    `,
  )}
`
export default StyledLayoutContent
