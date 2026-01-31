import styled, { css } from 'styled-components'
import { Layout } from 'antd'
import { smallScreenStyle } from 'styles/small-screen-style'

const StyledLayoutContent = styled(Layout.Content)`
  padding: 42px 9.375vw 42px;

  ${smallScreenStyle(
    () => css`
      padding: 24px 16px 42px;
    `
  )}
`
export default StyledLayoutContent
