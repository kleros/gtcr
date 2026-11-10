import React, {
  useState,
  useCallback,
  useContext,
  useMemo,
  useEffect,
} from 'react'
import styled, { css } from 'styled-components'
import { smallScreenStyle } from 'styles/small-screen-style'
import { useWeb3Context } from 'hooks/use-web3-context'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Dropdown } from 'components/ui'
import { useAppKit } from '@reown/appkit/react'
import { NETWORKS_INFO } from 'config/networks'
import { SUPPORTED_CHAINS } from 'config/chains'
import Identicon from 'components/identicon'
import CurateWordmark from 'assets/images/curate-v2-wordmark.svg'
import { SAVED_NETWORK_KEY } from 'utils/string'
import AppMenu from 'components/layout/app-menu'
import Help from 'components/layout/help'
import ThemeMenu from 'components/layout/theme-menu'
import {
  BarAccountAddress,
  BarAccountPill,
  BarConnectButton,
  BarIconButton,
} from 'components/layout/app-bar-controls'
import { defaultTcrAddresses, type validChains } from 'config/tcr-addresses'
import { StakeContext } from 'contexts/stake-context'
import useUrlChainId from 'hooks/use-url-chain-id'
import { preloadFactory } from 'bootstrap/app-router'
import { CurateIcon } from 'components/curate/icons'
import ChainLogo from 'components/chain-logo'
import {
  ChainStack,
  SelectMenu,
  type SelectMenuOption,
  truncateMiddle,
} from 'components/curate/primitives'
import { MAINNET_CHAIN_IDS, TESTNET_CHAIN_IDS } from 'pages/dashboard/view'
import { useLaunchChainId } from './launch-chain'

/*
 * App bar (DESIGN.md, Frame and stage; round 2): a full-width sticky bar.
 * Transparent over the aurora at the top of the page; once the page scrolls
 * it takes a blurred, translucent stage fill and a hairline bottom edge. It
 * never floats or turns into a pill. Logo, primary navigation, chain chip,
 * Connect (or the account pill), theme menu, help. On phones the navigation
 * moves under the menu button.
 */
const Container = styled.header`
  position: sticky;
  top: 0;
  z-index: 50;
  width: 100%;
  border-bottom: 1px solid transparent;
  background: transparent;
  transition:
    background-color 240ms var(--ease-in-out),
    border-color 240ms var(--ease-in-out);

  &[data-scrolled='true'] {
    border-bottom-color: var(--glass-border);
    background: color-mix(in srgb, var(--stage) 72%, transparent);
    -webkit-backdrop-filter: blur(16px) saturate(160%);
    backdrop-filter: blur(16px) saturate(160%);
  }
`

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  height: var(--app-bar-height);
  max-width: var(--page-max-width);
  margin: 0 auto;
  padding: 0 var(--horizontal-padding);

  ${smallScreenStyle(
    () => css`
      gap: 8px;
    `,
  )}
`

const LeftGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;

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
    `,
  )}
`

const RightGroup = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex: 1;
  /* never narrower than its controls: the nav moves aside instead of
     sliding under them */
  min-width: max-content;
`

const MobileNavMenu = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 220px;
  padding: 6px;
`

/* Phone menu rows: glass rows; the current section is lit like a thumb. */
const MobileMenuLink = styled(Link)<{ $active?: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  min-height: 40px;
  padding: 0 12px;
  border-radius: 10px;
  color: ${({ $active }) =>
    $active ? 'var(--color-text)' : 'var(--color-muted)'};
  background: ${({ $active }) => ($active ? 'var(--thumb)' : 'transparent')};
  box-shadow: ${({ $active }) => ($active ? 'var(--thumb-shadow)' : 'none')};
  text-decoration: none;
  font-size: var(--fs-body);
  font-weight: 500;
  white-space: nowrap;
  transition:
    background var(--motion),
    color var(--motion);

  &:hover {
    color: var(--color-text);
    background: ${({ $active }) =>
      $active ? 'var(--thumb)' : 'var(--hover-fill)'};
  }
`

const LogoLink = styled(Link)`
  display: flex;
  align-items: center;
  color: var(--color-text);
  transition: opacity var(--motion);

  &:hover {
    opacity: 0.8;
  }

  svg {
    display: block;
    height: 26px;
    width: auto;
  }

  /* Phones: keep only the hexagon mark (the first ~37 of 130 units). */
  @media (max-width: 600px) {
    width: 24px;
    overflow: hidden;

    svg {
      flex: 0 0 auto;
      width: 84px;
      max-width: none;
    }
  }
`

const StakeTag = styled.span`
  margin-left: 8px;
  padding: 2px 8px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-pill);
  color: var(--color-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
`

/*
 * Connect keeps its label everywhere but phones, where it is a 38px
 * circle (the label stays for screen readers).
 */
const ConnectLabel = styled.span`
  @media (max-width: 600px) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
`

/*
 * The chain chip gives way first: on phones and between 901 and 1099px
 * (the nav is back but the bar is narrow) it shows only its mark, the
 * chosen chain's logo or, for "All chains", the Ethereum and Gnosis marks
 * together, next to its chevron. Its name stays the accessible name and
 * the tooltip.
 */
const ChainSlot = styled.span`
  display: contents;

  @media (max-width: 600px), (min-width: 901px) and (max-width: 1099px) {
    [data-part='value'] {
      display: none;
    }
  }
`

/** The scope value for "All chains" (no `chain` param). */
const ALL_SCOPE = 'all'
const ALL_CHAINS = 'All chains'

const AppBar = () => {
  const web3Context = useWeb3Context()
  const { open } = useAppKit()
  const isPermanent = useContext(StakeContext)?.isPermanent
  const navigate = useNavigate()
  const location = useLocation()
  const { networkId } = web3Context

  const urlChainId = useUrlChainId()

  // Persist URL chain so non-chain-aware pages can restore it
  useEffect(() => {
    if (urlChainId)
      localStorage.setItem(SAVED_NETWORK_KEY, urlChainId.toString())
  }, [urlChainId])

  const savedChainId = useMemo(() => {
    try {
      const saved = localStorage.getItem(SAVED_NETWORK_KEY)
      return saved ? Number(saved) : null
    } catch {
      return null
    }
    // Re-read on every navigation (location.key) so it stays current
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key])

  const displayedChainId = urlChainId ?? savedChainId ?? networkId
  const launchChainId = useLaunchChainId()
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [helpDropdownOpen, setHelpDropdownOpen] = useState(false)

  /*
   * Browse is a scoped page: the chip shows and sets its `?chain=` scope, so
   * the bar and the page never disagree. "All chains" (no `chain` param)
   * means Ethereum and Gnosis; Sepolia is a testnet, listed apart and picked
   * on its own (DESIGN.md, Data rules). The dashboard sets the same scope
   * with its own control, next to the figures it scopes, so the bar does not
   * repeat it there.
   */
  const isDashboard = location.pathname === '/'
  const isBrowse = location.pathname === '/browse'
  const isScoped = isBrowse
  const showChainMenu = !isDashboard
  const scopeChainIds = useMemo(
    () =>
      new URLSearchParams(location.search)
        .get('chain')
        ?.split(',')
        .map(Number)
        .filter((chainId) =>
          SUPPORTED_CHAINS.some((chain) => Number(chain.id) === chainId),
        ) ?? [],
    [location.search],
  )
  const scopeChainId = scopeChainIds.length === 1 ? scopeChainIds[0] : null
  const currentChainInfo =
    NETWORKS_INFO[
      (isScoped ? scopeChainId : displayedChainId) as keyof typeof NETWORKS_INFO
    ]
  const scopeLabel =
    scopeChainIds.length === 0
      ? ALL_CHAINS
      : scopeChainIds.length === 1
        ? currentChainInfo?.name || 'Select chain'
        : `${scopeChainIds.length} chains`

  const handleScopeSelect = useCallback(
    (chainId: number | null) => {
      const next = new URLSearchParams(location.search)
      if (chainId) next.set('chain', String(chainId))
      else next.delete('chain')
      next.delete('page')
      const search = next.toString()
      // Browse keeps each filter step in the history.
      navigate(`${location.pathname}${search ? `?${search}` : ''}`)
    },
    [location.search, location.pathname, navigate],
  )

  const handleChainSelect = useCallback(
    (chainId: number) => {
      if (isScoped) {
        handleScopeSelect(chainId)
        return
      }
      if (chainId === displayedChainId) return
      const nextTcr = defaultTcrAddresses[chainId as validChains]
      if (!nextTcr) return
      localStorage.setItem(SAVED_NETWORK_KEY, chainId.toString())

      // Only navigate — useTcrNetwork handles the wallet switch when the
      // new page mounts, avoiding a double switchChain prompt.
      const factoryMatch = location.pathname.match(
        /^\/(factory(?:-permanent)?|launch)\//,
      )
      if (factoryMatch) navigate(`/${factoryMatch[1]}/${chainId}`)
      else navigate(`/tcr/${chainId}/${nextTcr}`)
    },
    [
      navigate,
      displayedChainId,
      handleScopeSelect,
      isScoped,
      location.pathname,
    ],
  )

  const chainOptions = useMemo(() => {
    const chains: SelectMenuOption<string>[] = SUPPORTED_CHAINS.flatMap(
      (chain) => {
        const info = NETWORKS_INFO[chain.id as keyof typeof NETWORKS_INFO]
        if (!info) return []
        const testnet = TESTNET_CHAIN_IDS.includes(Number(chain.id))
        return [
          {
            value: String(chain.id),
            label: info.name,
            icon: <ChainLogo chainId={Number(chain.id)} size={18} />,
            tag: testnet ? 'testnet' : undefined,
          },
        ]
      },
    )
    // Testnets close the list, under a hairline.
    const mainnets = chains.filter((option) => !option.tag)
    const testnets = chains
      .filter((option) => option.tag)
      .map((option, index) => ({ ...option, divider: index === 0 }))
    const all: SelectMenuOption<string>[] = isScoped
      ? [
          {
            value: ALL_SCOPE,
            label: ALL_CHAINS,
            hint: mainnets.map((option) => option.label).join(' and '),
            icon: <ChainStack chainIds={MAINNET_CHAIN_IDS} size={18} />,
          },
        ]
      : []
    return [...all, ...mainnets, ...testnets]
  }, [isScoped])

  const chainValue = isScoped
    ? scopeChainIds.length === 0
      ? ALL_SCOPE
      : scopeChainIds.length === 1
        ? String(scopeChainIds[0])
        : ''
    : String(displayedChainId ?? '')

  const chainMenuLabel = isBrowse ? 'Filter registries by chain' : 'Chain'

  const account =
    web3Context.active && web3Context.account ? web3Context.account : null

  const mobileMenuOverlay = (
    <MobileNavMenu aria-label="Main">
      <MobileMenuLink
        to="/"
        $active={location.pathname === '/'}
        onClick={() => setMobileMenuOpen(false)}
      >
        Dashboard
      </MobileMenuLink>
      <MobileMenuLink
        to="/browse"
        $active={
          location.pathname === '/browse' ||
          location.pathname.startsWith('/tcr/')
        }
        onClick={() => setMobileMenuOpen(false)}
      >
        Browse
      </MobileMenuLink>
      <MobileMenuLink
        to={`/launch/${launchChainId}`}
        $active={
          location.pathname.startsWith('/launch') ||
          location.pathname.startsWith('/factory')
        }
        onClick={() => setMobileMenuOpen(false)}
        onMouseEnter={() => preloadFactory()}
      >
        Launch a list
      </MobileMenuLink>
      <MobileMenuLink
        to="/guide"
        $active={location.pathname === '/guide'}
        onClick={() => setMobileMenuOpen(false)}
      >
        Guide
      </MobileMenuLink>
      <MobileMenuLink
        to="/pro"
        $active={location.pathname === '/pro'}
        onClick={() => setMobileMenuOpen(false)}
      >
        Curate Pro
      </MobileMenuLink>
      {account && (
        <MobileMenuLink
          to={`/address/${account}`}
          $active={location.pathname.startsWith('/address/')}
          onClick={() => setMobileMenuOpen(false)}
        >
          Your profile
        </MobileMenuLink>
      )}
    </MobileNavMenu>
  )

  return (
    <Container data-scrolled={scrolled}>
      <Row>
        <LeftGroup>
          <MobileMenuWrapper>
            <Dropdown
              overlay={mobileMenuOverlay}
              trigger={['click']}
              placement="bottomLeft"
              visible={mobileMenuOpen}
              onVisibleChange={setMobileMenuOpen}
            >
              <BarIconButton
                type="button"
                aria-label="Open menu"
                aria-expanded={mobileMenuOpen}
              >
                <CurateIcon name="menu" size={20} />
              </BarIconButton>
            </Dropdown>
          </MobileMenuWrapper>
          <LogoLink to="/" aria-label="Kleros Curate, dashboard">
            <CurateWordmark aria-hidden />
            {isPermanent && <StakeTag>Stake</StakeTag>}
          </LogoLink>
        </LeftGroup>
        <AppMenu />
        <RightGroup>
          {showChainMenu && (
            <ChainSlot>
              <SelectMenu<string>
                appearance="chip"
                align="end"
                label={chainMenuLabel}
                title={chainMenuLabel}
                heading={isScoped ? 'Chains' : 'Chain'}
                value={chainValue}
                placeholder={isScoped ? scopeLabel : 'Select chain'}
                options={chainOptions}
                menuWidth={232}
                renderValue={(option) => option?.label ?? scopeLabel}
                onChange={(next) =>
                  isScoped && next === ALL_SCOPE
                    ? handleScopeSelect(null)
                    : handleChainSelect(Number(next))
                }
              />
            </ChainSlot>
          )}
          {account ? (
            <BarAccountPill>
              <Identicon />
              <BarAccountAddress
                to={`/address/${account}`}
                title="Open profile"
              >
                {truncateMiddle(account)}
              </BarAccountAddress>
            </BarAccountPill>
          ) : (
            <BarConnectButton
              type="button"
              onClick={() => open({ view: 'Connect' })}
            >
              <CurateIcon name="wallet" size={16} />
              <ConnectLabel>Connect</ConnectLabel>
            </BarConnectButton>
          )}
          <ThemeMenu />
          <Dropdown
            trigger={['click']}
            visible={helpDropdownOpen}
            onVisibleChange={setHelpDropdownOpen}
            placement="bottomRight"
            overlay={<Help />}
          >
            <BarIconButton
              type="button"
              aria-label="Help"
              aria-haspopup="menu"
              aria-expanded={helpDropdownOpen}
              title="Help"
            >
              <CurateIcon name="help" size={19} />
            </BarIconButton>
          </Dropdown>
        </RightGroup>
      </Row>
    </Container>
  )
}

export default AppBar
