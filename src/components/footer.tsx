import React from 'react'
import styled, { css } from 'styled-components'
import { smallScreenStyle, MAX_WIDTH_CONTENT } from 'styles/small-screen-style'
import icons from './social-icons'

const Container = styled.footer`
  width: 100%;
  background-color: ${({ theme }) => theme.footerBackground};
  margin-top: auto;
`

const FooterInner = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 0 var(--horizontal-padding);
  height: 64px;
  gap: 16px;
  max-width: ${MAX_WIDTH_CONTENT};
  margin: 0 auto;
  width: 100%;

  ${smallScreenStyle(
    () => css`
      height: 114px;
      flex-direction: column;
      justify-content: center;
      padding-top: 8px;
      padding-bottom: 8px;
    `,
  )}
`

const StyledSecuredByKleros = styled.a`
  display: flex;
  align-items: center;
  flex-shrink: 0;
  transition: 0.1s;
  min-height: 24px;

  svg path {
    fill: ${({ theme }) => theme.white ?? '#ffffff'}BF;
    transition: 0.1s;
  }

  &:hover svg path {
    fill: ${({ theme }) => theme.white ?? '#ffffff'};
  }
`

const StyledSocialMedia = styled.div`
  display: flex;
`

const StyledSocialButton = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: transparent;
  padding: 8px;
  border-radius: 7px;
  transition: 0.1s;
  text-decoration: none;

  svg path {
    fill: ${({ theme }) => theme.white ?? '#ffffff'}BF;
    transition: 0.1s;
  }

  &:hover {
    background-color: #ffffff26;

    svg path {
      fill: ${({ theme }) => theme.white ?? '#ffffff'};
    }
  }
`

const SOCIAL_NAV = [
  {
    icon: icons.telegram,
    href: 'https://t.me/KlerosCurate',
  },
  {
    icon: icons.x,
    href: 'https://x.com/KlerosCurate',
  },
  {
    icon: icons.discord,
    href: 'https://discord.com/invite/MhXQGCyHd9',
  },
  {
    icon: icons.youtube,
    href: 'https://youtube.com/@kleros_io',
  },
  {
    icon: icons.github,
    href: 'https://github.com/kleros/gtcr',
  },
  {
    icon: icons.linkedin,
    href: 'https://www.linkedin.com/company/kleros/',
  },
]

const Footer: React.FC = () => (
  <Container>
    <FooterInner>
      <StyledSecuredByKleros
        href="https://kleros.io"
        target="_blank"
        rel="noopener noreferrer"
      >
        {icons.securedByKleros}
      </StyledSecuredByKleros>
      <StyledSocialMedia>
        {SOCIAL_NAV.map((item, index) => (
          <StyledSocialButton
            key={index}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {item.icon}
          </StyledSocialButton>
        ))}
      </StyledSocialMedia>
    </FooterInner>
  </Container>
)

export default Footer
