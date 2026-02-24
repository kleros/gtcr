import React from 'react'
import styled from 'styled-components'

const LayoutWrapper = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: ${({ theme }) => theme.bodyBackground};
`

const ContentWrapper = styled.div`
  flex: 1;
`

const HeaderWrapper = styled.div`
  background: ${({ theme }) => theme.navbarBackground};
  padding: 0 24px;
  height: 64px;
  display: flex;
  align-items: center;
  color: ${({ theme }) => theme.textInverted || '#fff'};
  flex-shrink: 0;
`

const FooterWrapper = styled.div`
  background: ${({ theme }) => theme.footerBackground};
  padding: 24px 50px;
  text-align: center;
  color: ${({ theme }) => theme.textInverted || '#fff'};
  flex-shrink: 0;
`

const SiderWrapper = styled.div<{ $width?: string }>`
  width: ${({ $width }) => $width || '200px'};
  background: ${({ theme }) => theme.componentBackground};
  flex-shrink: 0;
  border-right: 1px solid ${({ theme }) => theme.borderColor};
  overflow: auto;
`

interface LayoutChildProps {
  style?: React.CSSProperties
  className?: string
  children?: React.ReactNode
}

interface SiderProps extends LayoutChildProps {
  width?: number | string
}

interface LayoutComponent extends React.FC<LayoutChildProps> {
  Content: React.FC<LayoutChildProps>
  Header: React.FC<LayoutChildProps>
  Footer: React.FC<LayoutChildProps>
  Sider: React.FC<SiderProps>
}

const Layout: LayoutComponent = ({ style, className, children }) => (
  <LayoutWrapper
    style={style}
    className={`ui-layout${className ? ` ${className}` : ''}`}
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
    className={`ui-layout-content${className ? ` ${className}` : ''}`}
  >
    {children}
  </ContentWrapper>
)

Content.displayName = 'Layout.Content'

const Header: React.FC<LayoutChildProps> = ({ style, className, children }) => (
  <HeaderWrapper
    style={style}
    className={`ui-layout-header${className ? ` ${className}` : ''}`}
  >
    {children}
  </HeaderWrapper>
)

Header.displayName = 'Layout.Header'

const Footer: React.FC<LayoutChildProps> = ({ style, className, children }) => (
  <FooterWrapper
    style={style}
    className={`ui-layout-footer${className ? ` ${className}` : ''}`}
  >
    {children}
  </FooterWrapper>
)

Footer.displayName = 'Layout.Footer'

const Sider: React.FC<SiderProps> = ({ style, className, children, width }) => (
  <SiderWrapper
    $width={typeof width === 'number' ? `${width}px` : width}
    style={style}
    className={`ui-layout-sider${className ? ` ${className}` : ''}`}
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
