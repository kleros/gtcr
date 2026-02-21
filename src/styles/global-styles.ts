import { createGlobalStyle } from 'styled-components'
import { BREAKPOINT_LANDSCAPE } from 'styles/small-screen-style'

const GlobalStyle = createGlobalStyle`
  *, *::before, *::after {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    font-family: 'Roboto', sans-serif;
    transition: background-color 0.3s ease, color 0.3s ease;
    --horizontal-padding: 4.6875vw;

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

    /* Reactour (Tour/Guide modal) */
    .reactour__helper {
      background: ${({ theme }) => theme.componentBackground} !important;
      color: ${({ theme }) => theme.textPrimary} !important;
      border-radius: 12px !important;
      box-shadow: 0 4px 24px ${({ theme }) => theme.shadowColor} !important;
    }
    .reactour__helper div {
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .reactour__helper a {
      color: ${({ theme }) => theme.linkColor} !important;
    }
    .reactour__helper a:hover {
      color: ${({ theme }) => theme.primaryColorHover} !important;
    }
    .reactour__close {
      color: ${({ theme }) => theme.textSecondary} !important;
    }
    .reactour__close:hover {
      color: ${({ theme }) => theme.primaryColor} !important;
    }
    .reactour__dot {
      background: ${({ theme }) => theme.borderColor} !important;
      border: none !important;
    }
    .reactour__dot--is-active {
      background: ${({ theme }) => theme.primaryColor} !important;
    }
    [data-tour-elem="left-arrow"],
    [data-tour-elem="right-arrow"] {
      color: ${({ theme }) => theme.textSecondary} !important;
    }
    [data-tour-elem="left-arrow"]:hover,
    [data-tour-elem="right-arrow"]:hover {
      color: ${({ theme }) => theme.primaryColor} !important;
    }
    [data-tour-elem="badge"] {
      background: ${({ theme }) => theme.primaryColor} !important;
      color: ${({ theme }) => theme.textOnPrimary} !important;
    }
  }
`

export default GlobalStyle
