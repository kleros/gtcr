import { createGlobalStyle } from 'styled-components'
import { BREAKPOINT_LANDSCAPE } from 'styles/small-screen-style'

const GlobalStyle = createGlobalStyle`
  *, *::before, *::after {
    box-sizing: border-box;
  }

  button, input, select, textarea {
    font-family: inherit;
  }

  body {
    margin: 0;
    font-family: 'Roboto', sans-serif;
    font-size: 14px;
    transition: background-color 0.3s ease, color 0.3s ease;
    --horizontal-padding: min(4.6875vw, 66px);

    /* Font size scale */
    --font-size-page-title: 36px;
    --font-size-section-title: 24px;
    --font-size-title: 18px;
    --font-size-large: 16px;
    --font-size-base: 14px;
    --font-size-small: 13px;
    --font-size-xs: 12px;

    @media (max-width: ${BREAKPOINT_LANDSCAPE}px) {
      --horizontal-padding: 16px;
    }

    /* React-Toastify theme overrides */
    --toastify-color-light: ${({ theme }) => theme.componentBackground};
    --toastify-text-color-light: ${({ theme }) => theme.textPrimary};
    --toastify-color-dark: ${({ theme }) => theme.elevatedBackground};
    --toastify-text-color-dark: ${({ theme }) => theme.textPrimary};
    --toastify-color-info: ${({ theme }) => theme.primaryColor};
    --toastify-color-success: ${({ theme }) => theme.successColor};
    --toastify-color-warning: ${({ theme }) => theme.warningColor};
    --toastify-color-error: ${({ theme }) => theme.errorColor};
    --toastify-color-progress-light: ${({ theme }) => theme.primaryColor};
    --toastify-color-progress-dark: ${({ theme }) => theme.primaryColor};
    --toastify-font-family: 'Roboto', sans-serif;
  }

  .Toastify__toast-container--top-center {
    top: 48px;
  }

  body[data-theme="dark"] {
    background-color: ${({ theme }) => theme.bodyBackground} !important;
    color: ${({ theme }) => theme.textPrimary} !important;
  }

  /* Global link styles */
  a {
    color: ${({ theme }) => theme.linkColor};
    transition: color 0.2s ease;
  }
  a:hover {
    color: ${({ theme }) => theme.primaryColorHover};
  }

  /* Theme color class overrides for dark mode */
  body[data-theme="dark"] {
    .quaternary-background.theme-background,
    .quaternary-background .theme-background {
      background: ${({ theme }) => theme.elevatedBackground} !important;
    }
    .quaternary-color.theme-color,
    .quaternary-color .theme-color {
      color: ${({ theme }) => theme.textSecondary} !important;
    }
    .ternary-color.theme-color,
    .ternary-color .theme-color {
      color: ${({ theme }) => theme.textSecondary} !important;
    }
    .secondary-color.theme-color,
    .secondary-color .theme-color {
      color: ${({ theme }) => theme.textTertiary} !important;
    }
    .primary-color.theme-color,
    .primary-color .theme-color {
      color: ${({ theme }) => theme.primaryColor} !important;
    }

  }
`

export default GlobalStyle
