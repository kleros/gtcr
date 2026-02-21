import React from 'react'
import styled, { css } from 'styled-components'
import { smallScreenStyle } from 'styles/small-screen-style'
import { NavLink, Link, useLocation } from 'react-router-dom'

const DesktopNav = styled.nav`
  display: flex;
  align-items: center;
  gap: 24px;
  font-weight: 400;
  line-height: 64px;

  ${smallScreenStyle(
    () => css`
      display: none;
    `
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
  const isHome = pathname.startsWith('/tcr/') || pathname === '/'

  return (
    <DesktopNav>
      <StyledLink to="/" $active={isHome}>Home</StyledLink>
      <StyledNavLink to="/factory">Create a List</StyledNavLink>
    </DesktopNav>
  )
}

export default AppMenu
