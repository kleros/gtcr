import React from 'react'
import styled from 'styled-components/macro'
import PropTypes from 'prop-types'
import { Menu, Icon } from 'antd'
import { NavLink } from 'react-router-dom'

const StyledMenu = styled(Menu)`
  font-weight: bold;
  line-height: 64px !important;
  text-align: center;
  background-color: transparent !important;
`

const StyledMenuItem = styled(Menu.Item)`
  background-color: transparent !important;
`
const AppMenu = ({ mode }) => {
  const isHorizontal = mode === 'horizontal'
  const MenuWrapper = isHorizontal ? StyledMenu : Menu

  return (
    <MenuWrapper
      mode={mode}
      theme="dark"
      defaultSelectedKeys={[isHorizontal ? 'browse' : 'home']}
    >
      {isHorizontal ? null : (
        <Menu.Item style={{ height: '70px' }} key="home">
          <NavLink to="/">K L E R O S</NavLink>
        </Menu.Item>
      )}
      <StyledMenuItem key="browse">
        <NavLink to="/">Browse</NavLink>
      </StyledMenuItem>
      <StyledMenuItem key="factory">
        <NavLink to="/factory">Create a List</NavLink>
      </StyledMenuItem>
      <StyledMenuItem>
        <a href="https://twitter.com/KlerosCurate">
          Follow Curate <Icon type="twitter" />
        </a>
      </StyledMenuItem>
      <StyledMenuItem>
        <a href="https://t.me/KlerosCurate">
          Get Help <Icon type="info-circle" />
        </a>
      </StyledMenuItem>
    </MenuWrapper>
  )
}

AppMenu.propTypes = {
  mode: PropTypes.string.isRequired
}

export default AppMenu
