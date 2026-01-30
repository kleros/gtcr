import React, { createContext, useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { ThemeProvider as StyledThemeProvider } from 'styled-components'

const THEME_STORAGE_KEY = 'kleros-curate-theme'

export const lightTheme = {
  name: 'light',
  // Backgrounds
  bodyBackground: '#f2e3fe',
  componentBackground: '#ffffff',
  cardBackground: '#ffffff',
  elevatedBackground: '#faf5ff',
  // Text colors
  textPrimary: '#4d00b4',
  textSecondary: '#6b4d8a',
  textTertiary: '#8a7199',
  textInverted: '#ffffff',
  // Brand colors
  primaryColor: '#009aff',
  secondaryColor: '#1e075f',
  tertiaryColor: '#4d00b4',
  quaternaryColor: '#ead6fe',
  // Gradient colors (for card headers, NSFW warnings, etc.)
  gradientStart: '#4d00b4',
  gradientEnd: '#6500b4',
  gradientMid: '#6500b4',
  // Navbar and Footer
  navbarBackground: '#1e075f',
  footerBackground: '#4d00b4',
  // Borders and shadows
  borderColor: '#d09cff',
  shadowColor: 'rgba(188, 156, 255, 0.3)',
  // Status colors
  successColor: '#52c41a',
  errorColor: '#f5222d',
  warningColor: '#faad14',
  infoColor: '#1890ff',
  // Link color
  linkColor: '#009aff',
  // Ant Design overrides
  antdBackground: '#ffffff',
  antdBorderColor: '#d09cff',
  antdTextColor: '#4d00b4',
  antdDisabledColor: 'rgba(0, 0, 0, 0.25)',

  // Banner specific
  bannerGradient: 'linear-gradient(270deg, #f2e3ff 22.92%, #ffffff 76.25%)',
  bannerTextColor: '#4d00b4',
  bannerTitleColor: '#4d00b4',
  bannerDescriptionColor: '#b88cdc',
  bannerLinkColor: '#4d00b473',
  bannerLinkHoverColor: '#4d00b4',
  bannerPolicyLinkColor: '#b88cdc',
  bannerPolicyLinkHoverColor: '#9b6bc3',

  // Button colors
  buttonPrimaryBg: '#009aff',
  buttonPrimaryText: '#1a1a2e',
  buttonPrimaryHoverBg: '#33b1ff',
  buttonSecondaryBg: '#6826bf',
  buttonSecondaryText: '#ffffff',

  // Switch colors
  switchOffBg: 'rgba(0, 0, 0, 0.25)',
  switchHoverBg: '#7c3aed',
  switchHandleBg: '#ffffff',

  // Focus/outline colors (for inputs, selects, etc.)
  focusBorderColor: 'rgba(104, 38, 191, 0.4)',
  focusShadowColor: 'rgba(104, 38, 191, 0.2)',

  // Card specific
  cardHeaderGradient:
    'linear-gradient(111.6deg, #4d00b4 46.25%, #6500b4 96.25%)',
  cardShadow: 'rgba(188, 156, 255, 0.3)',
  cardNsfwText: '#ffffff',

  // Dropdown/Select colors
  dropdownShadow: 'rgba(188, 156, 255, 0.3)',
  dropdownHoverBg: 'rgba(104, 38, 191, 0.1)',
  dropdownSelectedBg: 'rgba(104, 38, 191, 0.15)',

  // Modal colors
  modalBackground: '#ffffff',
  modalShadow: 'rgba(188, 156, 255, 0.3)',
  modalCloseColor: '#6826bf',

  // Notification/status specific colors
  notificationPending: '#ccc',
  notificationAccepted: '#208efa',
  notificationChallenged: '#fa8d39',
  notificationAppealable: '#722ed1',
  notificationFinalRuling: '#f95638',
  statusCrowdfundingWinner: '#9d52d6',

  // Loading icon color
  loadingIconColor: '#108ee9',

  // Skeleton/shimmer colors
  skeletonBase: 'rgba(0, 0, 0, 0.06)',
  skeletonHighlight: 'rgba(0, 0, 0, 0.1)',

  // Countdown text color
  countdownTextColor: '#ffffff5c',

  // Filter/sort component colors
  filterBorderColor: '#9b7fcf',
  filterTextColor: '#4d00b4',

  // Tour highlight color
  tourAccentColor: '#4004a3',

  // Contract explorer colors
  explorerGradientStart: '#863fe5d9',
  explorerGradientEnd: '#4d00b4d9',
  explorerTextColor: '#4d00b473',

  // Welcome modal
  welcomeModalShadow: 'rgba(188, 156, 255, 0.3)',

  // Beta warning
  betaWarningBg: '#fffbe6',

  // Badge fallback color
  badgeFallbackColor: '#ccc',

  // Stake tag colors (SVG fills)
  stakeTagBg: '#5a3490',
  stakeTagText: '#e8dff5',

  // Item details title color
  itemDetailsTitleColor: '#4d00b4',
  itemDetailsSubtitleColor: 'rgba(77, 0, 180, 0.45)',

  // Crowdfunding card
  crowdfundingCardText: '#ffffff',

  // Rich address warning
  richAddressWarningColor: '#787800',

  // Custom registry (Seer) colors
  seerBorderColor: '#e0e0e0',
  seerLinkColor: '#007bff',
  seerTextPrimary: '#333',
  seerTextSecondary: '#666',
  seerBackgroundAlt: '#f9f9f9',
  seerShadow: 'rgba(0, 0, 0, 0.1)'
}

export const darkTheme = {
  name: 'dark',
  // Backgrounds - darker purple tinted
  bodyBackground: '#13101a',
  componentBackground: '#1e1a28',
  cardBackground: '#252032',
  elevatedBackground: '#2d2840',
  // Text colors - brighter for better contrast
  textPrimary: '#ffffff',
  textSecondary: '#d4c8e8',
  textTertiary: '#a89cc0',
  textInverted: '#13101a',
  textOnPrimary: '#0d0a14', // Dark text for primary color backgrounds (buttons, switches, etc.)
  primaryColorHover: '#7cc4e8', // Lighter primary for hover states
  // Brand colors - brighter purples for dark mode
  primaryColor: '#5faddb',
  secondaryColor: '#6c4dc4',
  tertiaryColor: '#9b5fff',
  quaternaryColor: '#3d2a55',
  // Gradient colors (for card headers, NSFW warnings, etc.)
  gradientStart: '#9b5fff',
  gradientEnd: '#6c4dc4',
  gradientMid: '#352d4d',
  // Navbar and Footer - dark purple with visible tint
  navbarBackground: '#1a1625',
  footerBackground: '#1a1625',
  // Borders and shadows - visible but subtle
  borderColor: '#3d3550',
  shadowColor: 'rgba(0, 0, 0, 0.5)',
  // Status colors - slightly brighter
  successColor: '#73d13d',
  errorColor: '#ff6b6b',
  warningColor: '#ffc53d',
  infoColor: '#5faddb',
  // Link color
  linkColor: '#5faddb',
  // Ant Design overrides
  antdBackground: '#1e1a28',
  antdBorderColor: '#3d3550',
  antdTextColor: '#ffffff',
  antdDisabledColor: 'rgba(255, 255, 255, 0.35)',

  // Banner specific
  bannerGradient:
    'linear-gradient(270deg, #1e1a28 22.92%, #2d2840 50%, #1e1a28 76.25%)',
  bannerTextColor: '#d4c8e8',
  bannerTitleColor: '#a78bfa',
  bannerDescriptionColor: 'rgba(255, 255, 255, 0.6)',
  bannerLinkColor: '#5faddb',
  bannerLinkHoverColor: '#7cc4e8',
  bannerPolicyLinkColor: '#5faddb',
  bannerPolicyLinkHoverColor: '#7cc4e8',

  // Button colors
  buttonPrimaryBg: '#009aff',
  buttonPrimaryText: '#1a1a2e',
  buttonPrimaryHoverBg: '#33b1ff',
  buttonSecondaryBg: '#5faddb',
  buttonSecondaryText: '#0d0a14',

  // Switch colors
  switchOffBg: '#2d2840',
  switchHoverBg: '#7cc4e8',
  switchHandleBg: '#ffffff',

  // Focus/outline colors (for inputs, selects, etc.)
  focusBorderColor: 'rgba(95, 173, 219, 0.5)',
  focusShadowColor: 'rgba(95, 173, 219, 0.2)',

  // Card specific
  cardHeaderGradient:
    'linear-gradient(135deg, #2d2840 0%, #352d4d 50%, #2d2840 100%)',
  cardShadow: 'rgba(0, 0, 0, 0.5)',
  cardNsfwText: '#ffffff',

  // Dropdown/Select colors
  dropdownShadow: 'rgba(0, 0, 0, 0.5)',
  dropdownHoverBg: 'rgba(95, 173, 219, 0.1)',
  dropdownSelectedBg: 'rgba(95, 173, 219, 0.15)',

  // Modal colors
  modalBackground: '#1e1a28',
  modalShadow: 'rgba(0, 0, 0, 0.5)',
  modalCloseColor: '#5faddb',

  // Notification/status specific colors
  notificationPending: '#ccc',
  notificationAccepted: '#208efa',
  notificationChallenged: '#fa8d39',
  notificationAppealable: '#722ed1',
  notificationFinalRuling: '#f95638',
  statusCrowdfundingWinner: '#9d52d6',

  // Loading icon color
  loadingIconColor: '#5faddb',

  // Skeleton/shimmer colors
  skeletonBase: 'rgba(255, 255, 255, 0.06)',
  skeletonHighlight: 'rgba(255, 255, 255, 0.12)',

  // Countdown text color
  countdownTextColor: '#ffffff5c',

  // Filter/sort component colors
  filterBorderColor: '#3d3550',
  filterTextColor: '#d4c8e8',

  // Tour highlight color
  tourAccentColor: '#9b5fff',

  // Contract explorer colors
  explorerGradientStart: '#9b5fffd9',
  explorerGradientEnd: '#6c4dc4d9',
  explorerTextColor: '#d4c8e8',

  // Welcome modal
  welcomeModalShadow: 'rgba(0, 0, 0, 0.5)',

  // Beta warning
  betaWarningBg: '#3d2a55',

  // Badge fallback color
  badgeFallbackColor: '#ccc',

  // Stake tag colors (SVG fills)
  stakeTagBg: '#5a3490',
  stakeTagText: '#e8dff5',

  // Item details title color
  itemDetailsTitleColor: '#a78bfa',
  itemDetailsSubtitleColor: 'rgba(255, 255, 255, 0.6)',

  // Crowdfunding card
  crowdfundingCardText: '#ffffff',

  // Rich address warning
  richAddressWarningColor: '#ffc53d',

  // Custom registry (Seer) colors
  seerBorderColor: '#3d3550',
  seerLinkColor: '#5faddb',
  seerTextPrimary: '#ffffff',
  seerTextSecondary: '#a89cc0',
  seerBackgroundAlt: '#252032',
  seerShadow: 'rgba(0, 0, 0, 0.3)'
}

const ThemeContext = createContext()

const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved !== null) return saved === 'dark'

    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  const theme = isDarkMode ? darkTheme : lightTheme

  const toggleTheme = useCallback(() => {
    setIsDarkMode(prev => !prev)
  }, [])

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, isDarkMode ? 'dark' : 'light')
    document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, theme }}>
      <StyledThemeProvider theme={theme}>{children}</StyledThemeProvider>
    </ThemeContext.Provider>
  )
}

ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired
}

export { ThemeContext, ThemeProvider }
