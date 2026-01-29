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
  antdDisabledColor: 'rgba(0, 0, 0, 0.25)'
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
  // Navbar and Footer - darker
  navbarBackground: '#0d0a14',
  footerBackground: '#0d0a14',
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
  antdDisabledColor: 'rgba(255, 255, 255, 0.35)'
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
