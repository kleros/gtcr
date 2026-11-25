import React from 'react'
import styled from 'styled-components'
import { joinClassNames } from './kit-styles'

/* Page shell: content sits on the page background (the body paints the bloom). */
const LayoutWrapper = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: transparent;
`

interface LayoutProps {
  style?: React.CSSProperties
  className?: string
  children?: React.ReactNode
}

const Layout = ({ style, className, children }: LayoutProps) => (
  <LayoutWrapper
    style={style}
    className={joinClassNames('ui-layout', className)}
  >
    {children}
  </LayoutWrapper>
)

export default Layout
