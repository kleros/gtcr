import React, {
  useState,
  useCallback,
  useContext,
  useMemo,
  useEffect,
} from 'react'
import styled, { css } from 'styled-components'
import { smallScreenStyle, MAX_WIDTH_CONTENT } from 'styles/small-screen-style'
import { useWeb3Context } from 'hooks/use-web3-context'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Button, Dropdown } from 'components/ui'
import { useAppKit } from '@reown/appkit/react'
import { ThemeContext } from 'contexts/theme-context'
import { NETWORKS_INFO } from 'config/networks'
import { SUPPORTED_CHAINS } from 'config/chains'
import Identicon from 'components/identicon'
import Logo from 'assets/images/logo.svg?react'
import StakeCurateLogoRaw from 'assets/images/logo-stake-curate.svg?react'
import SunIcon from 'assets/icons/sun.svg?react'
import MoonIcon from 'assets/icons/moon.svg?react'
import HelpIcon from 'assets/icons/help.svg?react'
import MenuIcon from 'assets/icons/menu.svg?react'
import { SAVED_NETWORK_KEY } from 'utils/string'
import AppMenu from 'components/layout/app-menu'
import Help from 'components/layout/help'
import { defaultTcrAddresses, type validChains } from 'config/tcr-addresses'
import { StakeContext } from 'contexts/stake-context'
import { preloadFactory } from 'bootstrap/app-router'

const Container = styled.div`
  padding: 0;
  background-color: ${({ theme }) => theme.navbarBackground};
  transition: background-color 0.3s ease;
`

const ThemeToggleButton = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 6px;
  border-radius: 50%;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  svg {
    width: 20px;
    height: 20px;
    fill: #fff;
    transition: transform 0.3s ease;
  }

  &:hover svg {
    transform: rotate(15deg);
  }
`

const LeftGroup = styled.div`
  display: flex;
  align-items: center;
  flex: 1;

  ${smallScreenStyle(
    () => css`
      flex: 0 0 auto;
    `,
  )}
`

const MobileMenuWrapper = styled.div`
  display: none;

  ${smallScreenStyle(
    () => css`
      display: block;
      margin-right: 12px;
    `,
  )}
`

const HamburgerButton = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    opacity: 0.7;
  }

  svg {
    width: 22px;
    height: 22px;
    color: #fff;
  }
`

const RightGroup = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: 1;

  ${smallScreenStyle(
    () => css`
      flex: 0 0 auto;
      justify-content: flex-start;
    `,
  )}
`

const MobileNavMenu = styled.div`
  padding: 4px 0;
  min-width: 160px;
`

const MobileMenuLink = styled(Link)<{ $active?: boolean }>`
  display: block;
  padding: 10px 16px;
  color: ${({ $active }) => ($active ? '#fff' : 'rgba(255, 255, 255, 0.5)')};
  text-decoration: none;
  font-size: var(--font-size-base);
  transition: all 0.2s;
  white-space: nowrap;
  font-weight: ${({ $active }) => ($active ? '500' : '400')};

  &:hover {
    color: #fff;
    background: ${({ theme }) => theme.dropdownHoverBg};
  }
`

const StyledRouterLink = styled(Link)`
  color: #fff;
  display: flex;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.7;
  }
`

const StyledConnectButton = styled(Button)`
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border-color: rgba(255, 255, 255, 0.3);

  &:hover:not(:disabled),
  &:focus:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border-color: rgba(255, 255, 255, 0.5);
  }
  margin-left: 8px;
`

const StyledIdenticonWrapper = styled.div`
  margin-left: 8px;
  border-radius: 50%;
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: rgba(255, 255, 255, 0.15);
  }
`

const StyledAppBarRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--horizontal-padding);
  min-height: 67px;
  max-width: ${MAX_WIDTH_CONTENT};
  margin: 0 auto;
  width: 100%;

  ${smallScreenStyle(
    () => css`
      padding-top: 8px;
      padding-bottom: 8px;
      flex-wrap: wrap;
      row-gap: 8px;
    `,
  )}
`

const ChainSelectorButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: ${({ theme }) =>
    theme.name === 'dark'
      ? 'rgba(255, 255, 255, 0.08)'
      : 'rgba(255, 255, 255, 0.15)'};
  border: 1px solid
    ${({ theme }) =>
      theme.name === 'dark'
        ? 'rgba(255, 255, 255, 0.12)'
        : 'rgba(255, 255, 255, 0.25)'};
  border-radius: 32px;
  padding: 0 15px;
  height: 32px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  white-space: nowrap;

  &:hover {
    background: ${({ theme }) =>
      theme.name === 'dark'
        ? 'rgba(255, 255, 255, 0.15)'
        : 'rgba(255, 255, 255, 0.3)'};
  }
`

const ChainDot = styled.span<{ $color: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  flex-shrink: 0;
`

const ChainMenu = styled.div`
  padding: 4px 0;
`

const ChainMenuItem = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 16px;
  border: none;
  background: ${({ $active, theme }) =>
    $active
      ? theme.dropdownSelectedBg || 'rgba(0, 0, 0, 0.06)'
      : 'transparent'};
  color: ${({ theme }) => theme.textPrimary};
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;

  &:hover {
    background: ${({ theme }) =>
      theme.dropdownHoverBg || 'rgba(0, 0, 0, 0.04)'};
  }
`

const HelpButton = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: -2px;
  border-radius: 50%;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  svg {
    width: 20px;
    height: 20px;
    fill: #fff;
    transition: transform 0.3s ease;
  }

  &:hover svg {
    transform: rotate(15deg);
  }
`

const StakeCurateLogo = styled(StakeCurateLogoRaw)`
  /* Dark mode: change stake tag background and text colors */
  ${({ theme }) =>
    theme.name === 'dark' &&
    `
    /* Stake tag background (path with fill="#EBD4FF") */
    path[fill="#EBD4FF"] {
      fill: ${theme.stakeTagBg};
    }
    /* Stake tag text (path with fill="#220050") */
    path[fill="#220050"] {
      fill: ${theme.stakeTagText};
    }
  `}
`

const AppBar = () => {
  const web3Context = useWeb3Context()
  const { open } = useAppKit()
  const { isPermanent } = useContext(StakeContext)
  const { isDarkMode, toggleTheme } = useContext(ThemeContext)
  const navigate = useNavigate()
  const location = useLocation()
  const { networkId, account } = web3Context

  // Parse the viewing chain from the URL (source of truth)
  const urlChainId = useMemo(() => {
    const match = location.pathname.match(
      /\/(?:tcr|factory(?:-classic|-permanent)?)\/(\d+)/,
    )
    return match ? Number(match[1]) : null
  }, [location.pathname])

  // Persist URL chain so non-chain-aware pages can restore it
  useEffect(() => {
    if (urlChainId)
      localStorage.setItem(SAVED_NETWORK_KEY, urlChainId.toString())
  }, [urlChainId])

  const savedChainId = useMemo(() => {
    const saved = localStorage.getItem(SAVED_NETWORK_KEY)
    return saved ? Number(saved) : null
    // Re-read on every navigation so it stays current
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  const displayedChainId = urlChainId ?? savedChainId ?? networkId
  const [chainDropdownOpen, setChainDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [helpDropdownOpen, setHelpDropdownOpen] = useState(false)
  const isHome =
    location.pathname.startsWith('/tcr/') || location.pathname === '/'

  const currentChainInfo =
    NETWORKS_INFO[displayedChainId as keyof typeof NETWORKS_INFO]

  const handleChainSelect = useCallback(
    (chainId: number) => {
      if (chainId === displayedChainId) {
        setChainDropdownOpen(false)
        return
      }
      const nextTcr = defaultTcrAddresses[chainId as validChains]
      if (!nextTcr) return
      localStorage.setItem(SAVED_NETWORK_KEY, chainId.toString())

      // Only navigate — useTcrNetwork handles the wallet switch when the
      // new page mounts, avoiding a double switchChain prompt.
      const factoryMatch = location.pathname.match(
        /^\/(factory(?:-classic|-permanent)?)\//,
      )
      if (factoryMatch) navigate(`/${factoryMatch[1]}/${chainId}`)
      else navigate(`/tcr/${chainId}/${nextTcr}`)

      setChainDropdownOpen(false)
    },
    [navigate, displayedChainId, location.pathname],
  )

  const mobileMenuOverlay = (
    <MobileNavMenu>
      <MobileMenuLink
        to="/"
        $active={isHome}
        onClick={() => setMobileMenuOpen(false)}
      >
        Home
      </MobileMenuLink>
      <MobileMenuLink
        to={`/factory/${displayedChainId}`}
        $active={location.pathname.startsWith('/factory')}
        onClick={() => setMobileMenuOpen(false)}
        onMouseEnter={() => preloadFactory()}
      >
        Create a List
      </MobileMenuLink>
    </MobileNavMenu>
  )

  return (
    <Container>
      <StyledAppBarRow>
        <LeftGroup>
          <MobileMenuWrapper>
            <Dropdown
              overlay={mobileMenuOverlay}
              trigger={['click']}
              placement="bottomLeft"
              visible={mobileMenuOpen}
              onVisibleChange={setMobileMenuOpen}
            >
              <HamburgerButton type="button" aria-label="Open menu">
                <MenuIcon />
              </HamburgerButton>
            </Dropdown>
          </MobileMenuWrapper>
          <StyledRouterLink to="/">
            {isPermanent ? (
              <StakeCurateLogo
                style={{ maxHeight: '50px', maxWidth: '120px' }}
              />
            ) : (
              <Logo style={{ maxHeight: '50px', maxWidth: '120px' }} />
            )}
          </StyledRouterLink>
        </LeftGroup>
        <AppMenu />
        <RightGroup>
          <Dropdown
            trigger={['click']}
            visible={chainDropdownOpen}
            onVisibleChange={setChainDropdownOpen}
            placement="bottomRight"
            overlay={
              <ChainMenu>
                {SUPPORTED_CHAINS.map((chain) => {
                  const info =
                    NETWORKS_INFO[chain.id as keyof typeof NETWORKS_INFO]
                  if (!info) return null
                  return (
                    <ChainMenuItem
                      key={chain.id}
                      $active={chain.id === displayedChainId}
                      onClick={() => handleChainSelect(Number(chain.id))}
                    >
                      <ChainDot $color={info.color} />
                      {info.name}
                    </ChainMenuItem>
                  )
                })}
              </ChainMenu>
            }
          >
            <ChainSelectorButton>
              <ChainDot $color={currentChainInfo?.color || '#ccc'} />
              {currentChainInfo?.name || 'Select Chain'}
            </ChainSelectorButton>
          </Dropdown>
          {web3Context.active && web3Context.account ? (
            <StyledIdenticonWrapper>
              <Identicon />
            </StyledIdenticonWrapper>
          ) : (
            <StyledConnectButton
              ghost
              shape="round"
              onClick={() => open({ view: 'Connect' })}
            >
              Connect
            </StyledConnectButton>
          )}
          <ThemeToggleButton
            onClick={toggleTheme}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? <SunIcon /> : <MoonIcon />}
          </ThemeToggleButton>
          <Dropdown
            trigger={['click']}
            visible={helpDropdownOpen}
            onVisibleChange={setHelpDropdownOpen}
            placement="bottomRight"
            overlay={<Help />}
          >
            <HelpButton type="button" title="Help">
              <HelpIcon />
            </HelpButton>
          </Dropdown>
        </RightGroup>
      </StyledAppBarRow>
    </Container>
  )
}

export default AppBar
