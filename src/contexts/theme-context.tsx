import React, { createContext, useState, useEffect, useCallback } from 'react'
import { ThemeProvider as StyledThemeProvider } from 'styled-components'

const THEME_STORAGE_KEY = 'kleros-curate-theme'

export const lightTheme = {
  name: 'light',
  bodyBackground: '#f2e3fe',
  componentBackground: '#ffffff',
  cardBackground: '#ffffff',
  elevatedBackground: '#faf5ff',
  textPrimary: '#4d00b4',
  textSecondary: '#6b4d8a',
  textTertiary: '#8a7199',
  textInverted: '#ffffff',
  textOnPrimary: '#ffffff',
  primaryColor: '#009aff',
  primaryColorHover: '#33b1ff',
  secondaryColor: '#1e075f',
  tertiaryColor: '#4d00b4',
  quaternaryColor: '#ead6fe',
  gradientStart: '#4d00b4',
  gradientEnd: '#6500b4',
  gradientMid: '#6500b4',
  navbarBackground: '#1e075f',
  footerBackground: '#1e075f',
  borderColor: '#d09cff',
  shadowColor: 'rgba(188, 156, 255, 0.3)',
  successColor: '#52c41a',
  errorColor: '#f5222d',
  warningColor: '#faad14',
  infoColor: '#009aff',
  linkColor: '#009aff',
  antdBackground: '#ffffff',
  antdBorderColor: '#d09cff',
  antdTextColor: '#4d00b4',
  antdDisabledColor: 'rgba(0, 0, 0, 0.25)',
  bannerGradient: 'linear-gradient(270deg, #f2e3ff 22.92%, #ffffff 76.25%)',
  bannerTextColor: '#4d00b4',
  bannerTitleColor: '#4d00b4',
  bannerDescriptionColor: '#b88cdc',
  bannerLinkColor: '#4d00b473',
  bannerLinkHoverColor: '#4d00b4',
  bannerPolicyLinkColor: '#b88cdc',
  bannerPolicyLinkHoverColor: '#9b6bc3',
  buttonPrimaryBg: '#009aff',
  buttonPrimaryText: '#ffffff',
  buttonPrimaryHoverBg: '#33b1ff',
  buttonSecondaryBg: '#6826bf',
  buttonSecondaryText: '#ffffff',
  switchOffBg: 'rgba(0, 0, 0, 0.25)',
  switchHoverBg: '#7c3aed',
  switchHandleBg: '#ffffff',
  focusBorderColor: 'rgba(104, 38, 191, 0.4)',
  focusShadowColor: 'rgba(104, 38, 191, 0.2)',
  cardHeaderGradient:
    'linear-gradient(111.6deg, #4d00b4 46.25%, #6500b4 96.25%)',
  cardHeaderLinkColor: '#82d1ff',
  cardHeaderLinkHoverColor: '#b8e4ff',
  evidenceCardBorder: '#e0d4f0',
  cardShadow: 'rgba(188, 156, 255, 0.3)',
  cardNsfwText: '#ffffff',
  dropdownShadow: 'rgba(188, 156, 255, 0.3)',
  dropdownHoverBg: 'rgba(104, 38, 191, 0.1)',
  dropdownSelectedBg: 'rgba(104, 38, 191, 0.15)',
  modalBackground: '#ffffff',
  modalShadow: 'rgba(188, 156, 255, 0.3)',
  modalCloseColor: '#6826bf',
  notificationPending: '#ccc',
  notificationAccepted: '#009aff',
  notificationChallenged: '#fa8d39',
  notificationAppealable: '#722ed1',
  notificationFinalRuling: '#f95638',
  statusCrowdfundingWinner: '#9d52d6',
  loadingIconColor: '#009aff',
  skeletonBase: '#e8e0f0',
  skeletonHighlight: '#f3ecfc',
  countdownTextColor: '#ffffffa0',
  filterBorderColor: '#9b7fcf',
  filterTextColor: '#4d00b4',
  tourAccentColor: '#4004a3',
  explorerGradientStart: '#863fe5d9',
  explorerGradientEnd: '#4d00b4d9',
  explorerTextColor: '#4d00b473',
  welcomeModalShadow: 'rgba(188, 156, 255, 0.3)',
  betaWarningBg: '#fffbe6',
  badgeFallbackColor: '#ccc',
  stakeTagBg: '#5a3490',
  stakeTagText: '#e8dff5',
  itemDetailsTitleColor: '#4d00b4',
  itemDetailsSubtitleColor: 'rgba(77, 0, 180, 0.45)',
  crowdfundingCardText: '#ffffff',
  richAddressWarningColor: '#787800',
  seerBorderColor: '#e0e0e0',
  seerLinkColor: '#009aff',
  seerTextPrimary: '#333',
  seerTextSecondary: '#666',
  seerBackgroundAlt: '#f9f9f9',
  seerShadow: 'rgba(0, 0, 0, 0.1)',
  tooltipBg: '#4d00b4',
  tooltipText: '#ffffff',
  tooltipBorder: '#4d00b4',
  tooltipShadow: 'rgba(77, 0, 180, 0.25)',
}

export const darkTheme = {
  name: 'dark',
  bodyBackground: '#13101a',
  componentBackground: '#1e1a28',
  cardBackground: '#252032',
  elevatedBackground: '#2d2840',
  textPrimary: '#ffffff',
  textSecondary: '#d4c8e8',
  textTertiary: '#a89cc0',
  textInverted: '#13101a',
  textOnPrimary: '#0d0a14',
  primaryColorHover: '#7cc4e8',
  primaryColor: '#5faddb',
  secondaryColor: '#6c4dc4',
  tertiaryColor: '#9b5fff',
  quaternaryColor: '#3d2a55',
  gradientStart: '#4a3575',
  gradientEnd: '#362860',
  gradientMid: '#352d4d',
  navbarBackground: '#1a1625',
  footerBackground: '#1a1625',
  borderColor: '#3d3550',
  shadowColor: 'rgba(0, 0, 0, 0.5)',
  successColor: '#73d13d',
  errorColor: '#ff6b6b',
  warningColor: '#ffc53d',
  infoColor: '#5faddb',
  linkColor: '#5faddb',
  antdBackground: '#1e1a28',
  antdBorderColor: '#3d3550',
  antdTextColor: '#ffffff',
  antdDisabledColor: 'rgba(255, 255, 255, 0.35)',
  bannerGradient:
    'linear-gradient(270deg, #1e1a28 22.92%, #2d2840 50%, #1e1a28 76.25%)',
  bannerTextColor: '#d4c8e8',
  bannerTitleColor: '#a78bfa',
  bannerDescriptionColor: 'rgba(255, 255, 255, 0.6)',
  bannerLinkColor: '#5faddb',
  bannerLinkHoverColor: '#7cc4e8',
  bannerPolicyLinkColor: '#5faddb',
  bannerPolicyLinkHoverColor: '#7cc4e8',
  buttonPrimaryBg: '#5faddb',
  buttonPrimaryText: '#0d0a14',
  buttonPrimaryHoverBg: '#7cc4e8',
  buttonSecondaryBg: '#5faddb',
  buttonSecondaryText: '#0d0a14',
  switchOffBg: '#2d2840',
  switchHoverBg: '#7cc4e8',
  switchHandleBg: '#ffffff',
  focusBorderColor: 'rgba(95, 173, 219, 0.5)',
  focusShadowColor: 'rgba(95, 173, 219, 0.2)',
  cardHeaderGradient:
    'linear-gradient(135deg, #2d2840 0%, #352d4d 50%, #2d2840 100%)',
  cardHeaderLinkColor: '#7cc4e8',
  cardHeaderLinkHoverColor: '#a8daf0',
  evidenceCardBorder: '#3d3550',
  cardShadow: 'rgba(0, 0, 0, 0.5)',
  cardNsfwText: '#ffffff',
  dropdownShadow: 'rgba(0, 0, 0, 0.5)',
  dropdownHoverBg: 'rgba(95, 173, 219, 0.1)',
  dropdownSelectedBg: 'rgba(95, 173, 219, 0.15)',
  modalBackground: '#1e1a28',
  modalShadow: 'rgba(0, 0, 0, 0.5)',
  modalCloseColor: '#5faddb',
  notificationPending: '#ccc',
  notificationAccepted: '#5faddb',
  notificationChallenged: '#fa8d39',
  notificationAppealable: '#722ed1',
  notificationFinalRuling: '#f95638',
  statusCrowdfundingWinner: '#9d52d6',
  loadingIconColor: '#5faddb',
  skeletonBase: '#2d2840',
  skeletonHighlight: '#3d3550',
  countdownTextColor: '#ffffff5c',
  filterBorderColor: '#3d3550',
  filterTextColor: '#d4c8e8',
  tourAccentColor: '#9b5fff',
  explorerGradientStart: '#9b5fffd9',
  explorerGradientEnd: '#6c4dc4d9',
  explorerTextColor: '#d4c8e8',
  welcomeModalShadow: 'rgba(0, 0, 0, 0.5)',
  betaWarningBg: '#3d2a55',
  badgeFallbackColor: '#ccc',
  stakeTagBg: '#7c4dbd',
  stakeTagText: '#f3ecff',
  itemDetailsTitleColor: '#a78bfa',
  itemDetailsSubtitleColor: 'rgba(255, 255, 255, 0.6)',
  crowdfundingCardText: '#ffffff',
  richAddressWarningColor: '#ffc53d',
  seerBorderColor: '#3d3550',
  seerLinkColor: '#5faddb',
  seerTextPrimary: '#ffffff',
  seerTextSecondary: '#a89cc0',
  seerBackgroundAlt: '#252032',
  seerShadow: 'rgba(0, 0, 0, 0.3)',
  tooltipBg: '#3d3550',
  tooltipText: '#ffffff',
  tooltipBorder: '#4a3f65',
  tooltipShadow: 'rgba(0, 0, 0, 0.6)',
}

export type Theme = typeof lightTheme

interface ThemeContextValue {
  isDarkMode: boolean
  toggleTheme: () => void
  theme: Theme
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved !== null) return saved === 'dark'

    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  const theme = isDarkMode ? darkTheme : lightTheme

  const toggleTheme = useCallback(() => {
    setIsDarkMode((prev) => !prev)
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

export { ThemeContext, ThemeProvider }
