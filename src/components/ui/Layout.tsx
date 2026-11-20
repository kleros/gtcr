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

const ContentWrapper = styled.div`
  flex: 1;
  min-width: 0;
`

/* Header, footer and sider sit on the frame: transparent, split by hairlines. */
const HeaderWrapper = styled.div`
  display: flex;
  align-items: center;
  flex-shrink: 0;
  height: var(--app-bar-height);
  padding: 0 var(--horizontal-padding);
  border-bottom: 1px solid var(--glass-border);
  background: transparent;
  color: var(--color-text);
`

const FooterWrapper = styled.div`
  flex-shrink: 0;
  padding: 24px var(--horizontal-padding);
  border-top: 1px solid var(--glass-border);
  color: var(--color-muted);
  font-size: var(--fs-small);
  line-height: var(--lh-small);
  text-align: center;
`

const SiderWrapper = styled.div<{ $width?: string }>`
  flex-shrink: 0;
  width: ${({ $width }) => $width || '240px'};
  overflow: auto;
  border-right: 1px solid var(--glass-border);
  background: transparent;
`

interface LayoutChildProps {
  style?: React.CSSProperties
  className?: string
  children?: React.ReactNode
}

interface SiderProps extends LayoutChildProps {
  width?: number | string
}

interface LayoutComponent {
  (props: LayoutChildProps): React.ReactElement | null
  displayName?: string
  Content: React.FC<LayoutChildProps>
  Header: React.FC<LayoutChildProps>
  Footer: React.FC<LayoutChildProps>
  Sider: React.FC<SiderProps>
}

const Layout: LayoutComponent = ({ style, className, children }) => (
  <LayoutWrapper
    style={style}
    className={joinClassNames('ui-layout', className)}
  >
    {children}
  </LayoutWrapper>
)

const Content: React.FC<LayoutChildProps> = ({
  style,
  className,
  children,
}) => (
  <ContentWrapper
    style={style}
    className={joinClassNames('ui-layout-content', className)}
  >
    {children}
  </ContentWrapper>
)

Content.displayName = 'Layout.Content'

const Header: React.FC<LayoutChildProps> = ({ style, className, children }) => (
  <HeaderWrapper
    style={style}
    className={joinClassNames('ui-layout-header', className)}
  >
    {children}
  </HeaderWrapper>
)

Header.displayName = 'Layout.Header'

const Footer: React.FC<LayoutChildProps> = ({ style, className, children }) => (
  <FooterWrapper
    style={style}
    className={joinClassNames('ui-layout-footer', className)}
  >
    {children}
  </FooterWrapper>
)

Footer.displayName = 'Layout.Footer'

const Sider: React.FC<SiderProps> = ({ style, className, children, width }) => (
  <SiderWrapper
    $width={typeof width === 'number' ? `${width}px` : width}
    style={style}
    className={joinClassNames('ui-layout-sider', className)}
  >
    {children}
  </SiderWrapper>
)

Sider.displayName = 'Layout.Sider'

Layout.Content = Content
Layout.Header = Header
Layout.Footer = Footer
Layout.Sider = Sider

export default Layout
