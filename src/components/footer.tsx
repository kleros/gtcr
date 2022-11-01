import React from 'react'
import styled from 'styled-components'
import icons from './social-icons'

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
    icon: icons.twitter,
    href: 'https://twitter.com/kleros_io?'
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
    <a
      href="https://kleros.io"
      className="g-kleros_footer__anchor"
      style={{ display: 'flex', alignItems: 'center' }}
    >
      {icons.securedByKleros}
    </a>
    <div className="g-kleros_footer__help">
      <SocialLink href="https://t.me/kleros">
        I need help {icons.help}
      </SocialLink>
    </div>
    <div className="g-kleros_footer__social">
      {SOCIAL_NAV.map((item, index) => (
        <SocialLink key={index} href={item.href}>
          {item.icon}
        </SocialLink>
      ))}
    </div>
  </StyledFooter>
)

export default Footer

const SocialLink: React.FC<{
  children: React.ReactNode
  href: string
}> = ({ children, href }) => (
  <a
    className="g-kleros_footer__anchor"
    href={href}
    rel="noopener noreferrer"
    target="_blank"
  >
    {children}
  </a>
)

const StyledFooter = styled.footer`
  font-family: Roboto, sans-serif;
  font-size: 1rem;
  width: 100%;
  height: 4rem;
  display: grid;
  background: #4d00b4;
  grid: 1fr / [footer-start] 1fr [banner] 18fr [help] 12fr 1fr [footer-end];
  align-items: center;
  justify-items: center;

  .g-kleros_footer__anchor {
    color: white;
    text-decoration: none;
    margin-left: 1rem;
  }

  .g-kleros_footer__help {
    display: grid;
    grid-column: help;
    justify-self: end;
    color: white;
  }

  .g-kleros_footer__social {
    display: none;
    grid: 1fr / 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
    grid-column: social;
    justify-self: stretch;
    align-items: center;
    text-align: center;
  }
  @media (min-width: 992px) {
    .g-kleros_footer {
      grid: 1fr / [footer-start] 1fr [banner] 20fr [title] 20fr [help] 8fr 2fr [social] 10fr 1fr [footer-end];
    }

    .g-kleros_footer__title {
      display: initial;
    }

    .g-kleros_footer__social {
      display: grid;
      margin-right: 1.8rem;
    }
  }
`
