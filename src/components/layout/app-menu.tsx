import React, { useMemo } from 'react'
import styled, { css } from 'styled-components'
import { smallScreenStyle } from 'styles/small-screen-style'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { useWeb3Context } from 'hooks/use-web3-context'
import { SAVED_NETWORK_KEY } from 'utils/string'
import { preloadFactory } from 'bootstrap/app-router'

const DesktopNav = styled.nav`
  display: flex;
  align-items: center;
  gap: 24px;
  font-size: var(--font-size-large);
  font-weight: 400;
  line-height: 64px;

  ${smallScreenStyle(
    () => css`
      display: none;
    `,
  )}
`

const StyledNavLink = styled(NavLink)`
  color: rgba(255, 255, 255, 0.5);
  text-decoration: none;
  transition: color 0.2s ease;

  &:hover {
    color: #fff;
  }

  &.active {
    color: #fff;
  }
`

const StyledLink = styled(Link)<{ $active?: boolean }>`
  color: ${({ $active }) => ($active ? '#fff' : 'rgba(255, 255, 255, 0.5)')};
  text-decoration: none;
  transition: color 0.2s ease;

  &:hover {
    color: #fff;
  }
`

const AppMenu = () => {
  const { pathname } = useLocation()
  const { networkId } = useWeb3Context()
  const isHome = pathname.startsWith('/tcr/') || pathname === '/'

  const currentChainId = useMemo(() => {
    const match = pathname.match(
      /\/(?:tcr|factory(?:-classic|-permanent)?)\/(\d+)/,
    )
    if (match) return Number(match[1])
    const saved = localStorage.getItem(SAVED_NETWORK_KEY)
    return saved ? Number(saved) : networkId
  }, [pathname, networkId])

  return (
    <DesktopNav>
      <StyledLink to="/" $active={isHome}>
        Home
      </StyledLink>
      <StyledNavLink
        to={`/factory/${currentChainId}`}
        onMouseEnter={() => preloadFactory()}
      >
        Create a List
      </StyledNavLink>
    </DesktopNav>
  )
}

export default AppMenu
