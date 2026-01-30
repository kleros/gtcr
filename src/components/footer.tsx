import React from 'react'
import styled, { css } from 'styled-components'
import { smallScreenStyle } from 'styles/small-screen-style'
import icons from './social-icons'

const StyledFooter = styled.footer`
  display: flex;
  width: 100%;
  padding: 24px 48px;
  background: ${({ theme }) => theme.footerBackground};
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  transition: background-color 0.3s ease;

  ${smallScreenStyle(
    () => css`
      flex-direction: column;
      justify-content: center;
      padding: 24px 16px;
    `
  )}
`

const SocialLinksContainer = styled.div`
  display: grid;
  gap: 16px;
  grid: 1fr / 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
  align-items: center;
  text-align: center;
`

const StyledSecuredByKleros = styled.a`
  display: flex;
  align-items: center;
  color: white !important;

  &:hover {
    color: white !important;
  }
`

const StyledSocialLink = styled.a`
  color: white;
  text-decoration: none;
`

const SOCIAL_NAV = [
  {
    icon: icons.github,
    href: 'https://github.com/kleros'
  },
  {
    icon: icons.slack,
    href: 'https://slack.kleros.io/'
  },
  {
    icon: icons.reddit,
    href: 'https://reddit.com/r/Kleros/'
  },
  {
    icon: icons.x,
    href: 'https://x.com/kleros_io?'
  },
  {
    icon: icons.blog,
    href: 'https://blog.kleros.io/'
  },
  {
    icon: icons.telegram,
    href: 'https://t.me/kleros'
  },
  {
    icon: icons.linkedin,
    href: 'https://www.linkedin.com/company/kleros/'
  }
]

const Footer = () => (
  <StyledFooter>
    <StyledSecuredByKleros href="https://kleros.io">
      {icons.securedByKleros}
    </StyledSecuredByKleros>
    <SocialLinksContainer>
      {SOCIAL_NAV.map((item, index) => (
        <SocialLink key={index} href={item.href}>
          {item.icon}
        </SocialLink>
      ))}
    </SocialLinksContainer>
  </StyledFooter>
)

export default Footer

const SocialLink: React.FC<{
  children: React.ReactNode
  href: string
}> = ({ children, href }) => (
  <StyledSocialLink href={href} rel="noopener noreferrer" target="_blank">
    {children}
  </StyledSocialLink>
)
