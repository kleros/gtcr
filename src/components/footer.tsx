import React from 'react'
import styled from 'styled-components'
import { Link } from 'react-router-dom'
import KlerosSymbol from 'assets/images/kleros-symbol.svg'
import icons from './social-icons'
import { NotificationStyles } from './notifications'

/*
 * Footer: one slim line at the bottom of the frame. "Secured by Kleros" set
 * as text with the Kleros symbol, the two in-app links, and the community
 * channels as ghost pills that lift on hover. On phones it stacks and
 * centres. It also mounts the notification (toast) styles, since it is
 * rendered once on every page.
 */

const Container = styled.footer`
  width: 100%;
  margin-top: auto;
  border-top: 1px solid var(--glass-border);
`

const FooterInner = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px 24px;
  width: 100%;
  max-width: var(--page-max-width);
  min-height: 64px;
  margin: 0 auto;
  padding: 12px var(--horizontal-padding);

  @media (max-width: 720px) {
    flex-direction: column;
    justify-content: center;
    gap: 14px;
    padding-top: 20px;
    padding-bottom: 24px;
  }
`

const Brand = styled.a`
  && {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 32px;
    color: var(--color-muted);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
    text-decoration: none;
    transition: color var(--motion);
  }

  svg {
    width: 16px;
    height: auto;
    color: var(--color-faint);
    transition: color var(--motion);
  }

  b {
    color: var(--color-text);
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  &&:hover {
    color: var(--color-text);
  }

  &:hover svg {
    color: var(--color-primary);
  }
`

const End = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 20px;

  @media (max-width: 720px) {
    flex-direction: column;
    gap: 12px;
  }
`

const FooterNav = styled.nav`
  display: flex;
  align-items: center;
  gap: 4px;
`

const FooterLink = styled(Link)`
  && {
    display: inline-flex;
    align-items: center;
    min-height: 32px;
    padding: 0 10px;
    border-radius: var(--radius-pill);
    color: var(--color-muted);
    font-size: var(--fs-small);
    line-height: var(--lh-small);
    font-weight: 500;
    text-decoration: none;
    transition:
      color var(--motion),
      background var(--motion);
  }

  &&:hover {
    color: var(--color-text);
    background: var(--color-raised);
  }
`

const Social = styled.ul`
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
`

const SocialPill = styled.a`
  && {
    display: inline-grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-muted);
    text-decoration: none;
    transition:
      color var(--motion),
      background var(--motion),
      border-color var(--motion),
      transform var(--motion);
  }

  && svg {
    width: 15px;
    height: 15px;
  }

  && svg path,
  && svg rect {
    fill: currentColor;
  }

  &&:hover,
  &&:focus-visible {
    color: var(--color-text);
    border-color: var(--color-border-strong);
    background: var(--color-raised);
    transform: translateY(-2px);
  }
`

const SOCIAL_NAV = [
  {
    label: 'Telegram',
    icon: icons.telegram,
    href: 'https://t.me/KlerosCurate',
  },
  {
    label: 'X',
    icon: icons.x,
    href: 'https://x.com/KlerosCurate',
  },
  {
    label: 'Discord',
    icon: icons.discord,
    href: 'https://discord.com/invite/MhXQGCyHd9',
  },
  {
    label: 'YouTube',
    icon: icons.youtube,
    href: 'https://youtube.com/@kleros_io',
  },
  {
    label: 'GitHub',
    icon: icons.github,
    href: 'https://github.com/kleros/gtcr',
  },
  {
    label: 'LinkedIn',
    icon: icons.linkedin,
    href: 'https://www.linkedin.com/company/kleros/',
  },
]

const Footer: React.FC = () => (
  <Container>
    <NotificationStyles />
    <FooterInner>
      <Brand href="https://kleros.io" target="_blank" rel="noopener noreferrer">
        <KlerosSymbol aria-hidden="true" />
        <span>
          Secured by <b>Kleros</b>
        </span>
      </Brand>
      <End>
        <FooterNav aria-label="More from Curate">
          <FooterLink to="/guide">Guide & Skills</FooterLink>
          <FooterLink to="/pro">Curate Pro</FooterLink>
        </FooterNav>
        <Social aria-label="Kleros Curate community">
          {SOCIAL_NAV.map((item) => (
            <li key={item.href}>
              <SocialPill
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={item.label}
                title={item.label}
              >
                {item.icon}
              </SocialPill>
            </li>
          ))}
        </Social>
      </End>
    </FooterInner>
  </Container>
)

export default Footer
