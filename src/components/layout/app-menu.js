import React from 'react'
import styled, { css } from 'styled-components'
import { smallScreenStyle } from 'styles/small-screen-style'
import { NavLink } from 'react-router-dom'
import { Menu, Dropdown, Button, Icon } from 'antd'
import MenuIcon from 'assets/images/menu-icon.png'

const DesktopMenu = styled(Menu)`
  font-weight: bold;
  line-height: 64px !important;
  text-align: center;
  background-color: transparent !important;

  ${smallScreenStyle(
    () => css`
      display: none;
    `
  )}
`

const MobileDropdown = styled.div`
  display: none;

  ${smallScreenStyle(
    () => css`
      display: block;
    `
  )}
`

const StyledMenuItem = styled(Menu.Item)`
  background-color: transparent !important;
`

const StyledButton = styled(Button)`
  background-color: ${({ theme }) => theme.navbarBackground} !important;
  color: #fff !important;
  padding: 0 !important;
  border: none !important;
`

const StyledImg = styled.img`
  width: 28px;
  height: 28px;
`

const menuItems = [
  { key: 'browse', content: <NavLink to="/">Browse</NavLink>, isNavLink: true },
  {
    key: 'factory',
    content: <NavLink to="/factory">Create a List</NavLink>,
    isNavLink: true
  },
  {
    key: 'x',
    content: (
      <a href="https://x.com/KlerosCurate" target="_blank" rel="noreferrer">
        Follow Curate
      </a>
    ),
    isNavLink: false
  },
  {
    key: 'help',
    content: (
      <a href="https://t.me/KlerosCurate" target="_blank" rel="noreferrer">
        Get Help <Icon type="info-circle" />
      </a>
    ),
    isNavLink: false
  }
]

const renderMenuItems = () =>
  menuItems.map(({ key, content }) => (
    <StyledMenuItem key={key}>{content}</StyledMenuItem>
  ))

const AppMenu = () => (
  <>
    <DesktopMenu
      mode="horizontal"
      theme="dark"
      defaultSelectedKeys={['browse']}
    >
      {renderMenuItems()}
    </DesktopMenu>

    <MobileDropdown>
      <Dropdown overlay={<Menu>{renderMenuItems()}</Menu>} trigger={['click']}>
        <StyledButton>
          <StyledImg src={MenuIcon} alt="menu" />
        </StyledButton>
      </Dropdown>
    </MobileDropdown>
  </>
)

export default AppMenu
