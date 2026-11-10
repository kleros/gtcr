import { createGlobalStyle } from 'styled-components'
import { BREAKPOINT_LANDSCAPE } from 'styles/small-screen-style'

const GlobalStyle = createGlobalStyle`
  *, *::before, *::after {
    box-sizing: border-box;
  }

  button, input, select, textarea {
    font-family: inherit;
    font-size: inherit;
  }

  body {
    margin: 0;
    font-family: var(--font-sans);
    font-size: 14px;
    line-height: 20px;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    transition: background-color 0.2s ease, color 0.2s ease;

    /* Type: Urbanist for display, Geist for text and every animated figure,
       Geist Mono for addresses and hashes only (DESIGN.md, Typography). */
    --font-sans: "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    --font-mono: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    --font-display: "Urbanist", "Geist", -apple-system, BlinkMacSystemFont, sans-serif;
    /* Numbers that animate or align must use a face with tabular figures. */
    --font-figure: "Geist", -apple-system, BlinkMacSystemFont, sans-serif;
    --font-serif: var(--font-display);
    --fs-hero: clamp(44px, 5.2vw + 12px, 84px);
    --lh-hero: 0.98;
    --fs-display: clamp(32px, 2.6vw + 16px, 48px);
    --lh-display: 1.04;
    --fs-heading: 22px;
    --lh-heading: 28px;
    --fs-subheading: 16px;
    --lh-subheading: 22px;
    --fs-body-lg: 15px;
    --lh-body-lg: 22px;
    --fs-body: 14px;
    --lh-body: 20px;
    --fs-small: 13px;
    --lh-small: 18px;
    --fs-data: 13px;
    --lh-data: 18px;
    --fs-label: 11px;
    --lh-label: 16px;
    --fs-micro: 10px;
    --fs-meta: 12px;
    --lh-meta: 16px;
    --fs-title-sm: 20px;
    --lh-title-sm: 26px;
    --fs-title-md: 24px;
    --lh-title-md: 30px;
    --fs-title-lg: 26px;
    --lh-title-lg: 32px;
    --fs-figure: clamp(28px, 1.6vw + 18px, 40px);
    --lh-figure: 1.05;
    --tracking-label: 0.06em;
    --font-label: var(--font-sans);
    --tracking-tight: -0.03em;
    --tracking-display: -0.045em;

    /* Legacy scale names still read by older pages, mapped onto the new scale */
    --font-size-page-title: 32px;
    --font-size-section-title: var(--fs-heading);
    --font-size-title: var(--fs-subheading);
    --font-size-large: var(--fs-body-lg);
    --font-size-base: var(--fs-body);
    --font-size-small: var(--fs-small);
    --font-size-xs: 12px;

    /* Shape and space */
    --radius-xs: 6px;
    --radius-sm: 8px;
    --radius-control: 10px;
    --radius: 12px;
    --radius-well: 14px;
    --radius-lg: 18px;
    --radius-xl: 24px;
    --radius-pill: 999px;
    --horizontal-padding: min(4.6875vw, 56px);
    /* With the frame gone the page runs edge to edge; this keeps the
       content as wide as it was inside the frame at 1440. */
    --page-max-width: 1344px;
    --app-bar-height: 64px;
    --motion: 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
    --blur: 18px;
    --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
    --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
    --ease-spring: cubic-bezier(0.34, 1.3, 0.64, 1);
    --ease-exit: cubic-bezier(0.4, 0, 1, 1);
    --dur-press: 90ms;
    --dur-hover: 180ms;
    --dur-control: 320ms;
    --dur-panel: 480ms;
    --dur-figure: 900ms;
    --dur-draw: 1400ms;
    --stagger: 70ms;
    --stagger-row: 24ms;
    --noise: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .6 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");

    /* Semantic color roles (from the theme) */
    --color-bg: ${({ theme }) => theme.curateBg};
    --color-surface: ${({ theme }) => theme.componentBackground};
    --color-raised: ${({ theme }) => theme.elevatedBackground};
    --color-text: ${({ theme }) => theme.textPrimary};
    --color-muted: ${({ theme }) => theme.textSecondary};
    --color-faint: ${({ theme }) => theme.textTertiary};
    --color-border: ${({ theme }) => theme.borderColor};
    --color-border-strong: ${({ theme }) => theme.curateBorderStrong};
    --color-primary: ${({ theme }) => theme.primaryColor};
    --color-primary-hover: ${({ theme }) => theme.primaryColorHover};
    --color-primary-fill: ${({ theme }) => theme.primaryFill};
    --color-primary-fill-hover: ${({ theme }) => theme.primaryFillHover};
    --color-on-primary: ${({ theme }) => theme.textOnPrimary};
    --color-primary-soft: ${({ theme }) => theme.curateLiveSoft};
    /* Primary text on a primary-soft fill or a featured tint (4.5:1+ in every theme). */
    --color-primary-on-soft: color-mix(
      in srgb,
      var(--color-primary) 70%,
      var(--color-text)
    );
    --color-indigo: ${({ theme }) => theme.secondaryColor};
    --color-indigo-soft: ${({ theme }) => theme.curateVioletSoft};
    --color-success: ${({ theme }) => theme.successColor};
    --color-success-soft: ${({ theme }) => theme.curateSuccessSoft};
    --color-warning: ${({ theme }) => theme.warningColor};
    --color-warning-soft: ${({ theme }) => theme.curateWarningSoft};
    --color-danger: ${({ theme }) => theme.errorColor};
    --color-danger-soft: ${({ theme }) => theme.curateDangerSoft};
    --shadow-card: ${({ theme }) => theme.cardShadow};
    --shadow-card-hover: ${({ theme }) => theme.curateShadowHover};
    --shadow-overlay: ${({ theme }) => theme.modalShadow};
    --glow: ${({ theme }) => theme.curateGlowA};
    --glow-rim: ${({ theme }) => theme.curateGlowB};
    --glass: ${({ theme }) => theme.glass};
    --stage: ${({ theme }) => theme.stage};
    --aurora-a: ${({ theme }) => theme.auroraA};
    --aurora-b: ${({ theme }) => theme.auroraB};
    --aurora-c: ${({ theme }) => theme.auroraC};
    /* Categorical data colours, in fixed order (rings and their legends). */
    --viz-1: ${({ theme }) => theme.viz[0]};
    --viz-2: ${({ theme }) => theme.viz[1]};
    --viz-3: ${({ theme }) => theme.viz[2]};
    --viz-4: ${({ theme }) => theme.viz[3]};
    --glass-border: ${({ theme }) => theme.glassBorder};
    --glass-highlight: ${({ theme }) => theme.glassHighlight};

    /* Controls (DESIGN.md, Surfaces and controls): the lit edge, the
       primary glass, recessed tracks with lit thumbs, glass popovers. */
    --edge-1: ${({ theme }) => theme.edge[0]};
    --edge-2: ${({ theme }) => theme.edge[1]};
    --edge-3: ${({ theme }) => theme.edge[2]};
    --edge-width: ${({ theme }) => theme.edgeWidth};
    --cta-top: ${({ theme }) => theme.ctaTop};
    --cta-bottom: ${({ theme }) => theme.ctaBottom};
    --cta-ink: ${({ theme }) => theme.ctaInk};
    --cta-glow: ${({ theme }) => theme.ctaGlow};
    --cta-sheen: ${({ theme }) => theme.ctaSheen};
    --cta-highlight: ${({ theme }) => theme.ctaHighlight};
    --sweep-head: ${({ theme }) => theme.sweepHead};
    --track-on-top: ${({ theme }) => theme.trackOnTop};
    --track-on-bottom: ${({ theme }) => theme.trackOnBottom};
    --bead-on: ${({ theme }) => theme.beadOn};
    --recess: ${({ theme }) => theme.recess};
    --recess-shadow: ${({ theme }) => theme.recessShadow};
    --thumb: ${({ theme }) => theme.thumb};
    --thumb-shadow: ${({ theme }) => theme.thumbShadow};
    --bead-off: ${({ theme }) => theme.beadOff};
    --popover: ${({ theme }) => theme.popover};
    --hover-fill: ${({ theme }) => theme.hoverFill};
    --grid-line: ${({ theme }) =>
      theme.name === 'light'
        ? 'rgba(16, 24, 40, 0.045)'
        : 'rgba(255, 255, 255, 0.035)'};

    /* Status roles: one meaning each (DESIGN.md, Colors) */
    --status-registered: var(--color-success);
    --status-registered-soft: var(--color-success-soft);
    --status-window: var(--color-primary);
    --status-window-soft: var(--color-primary-soft);
    --status-contested: var(--color-warning);
    --status-contested-soft: var(--color-warning-soft);
    --status-off: var(--color-danger);
    --status-off-soft: var(--color-danger-soft);
    --status-neutral: var(--color-faint);
    --status-neutral-soft: var(--color-raised);

    /* Names older components read; same values as the roles above */
    --v2-bg: var(--color-bg);
    --v2-bg-soft: var(--color-surface);
    --v2-card: var(--color-surface);
    --v2-soft: var(--color-raised);
    --v2-text: var(--color-text);
    --v2-muted: var(--color-muted);
    --v2-faint: var(--color-faint);
    --v2-stroke: var(--color-border);
    --v2-stroke-strong: var(--color-border-strong);
    --v2-purple: var(--color-indigo);
    --v2-purple-soft: var(--color-indigo-soft);
    --v2-blue: var(--color-primary);
    --v2-blue-hover: var(--color-primary-hover);
    --v2-blue-soft: var(--color-primary-soft);
    --v2-success: var(--color-success);
    --v2-success-soft: var(--color-success-soft);
    --v2-warning: var(--color-warning);
    --v2-warning-soft: var(--color-warning-soft);
    --v2-error: var(--color-danger);
    --v2-error-soft: var(--color-danger-soft);
    --v2-shadow: var(--shadow-card);
    --v2-shadow-hover: var(--shadow-card-hover);
    --curate-bg: var(--color-bg);
    --curate-bg-soft: var(--color-surface);
    --curate-surface: var(--color-surface);
    --curate-surface-strong: var(--color-surface);
    --curate-border: var(--color-border);
    --curate-border-strong: var(--color-border-strong);
    --curate-text: var(--color-text);
    --curate-muted: var(--color-muted);
    --curate-faint: var(--color-faint);
    --curate-live: var(--color-primary);
    --curate-violet: var(--color-indigo);
    --curate-success: var(--color-success);
    --curate-warning: var(--color-warning);
    --curate-danger: var(--color-danger);
    --curate-shadow: var(--shadow-card);
    --curate-shadow-hover: var(--shadow-card-hover);
    --curate-panel: var(--color-surface);
    --curate-card: var(--color-surface);
    --curate-stat: var(--color-surface);
    --curate-button: var(--color-primary);
    --curate-button-soft: var(--color-raised);
    --curate-chip-bg: var(--color-raised);
    --curate-field: var(--color-surface);
    --curate-icon-bg: var(--color-raised);
    --curate-icon-shadow: none;
    --curate-under-glow: transparent;
    --curate-radius: var(--radius);
    --curate-radius-sm: var(--radius-sm);

    /* @kleros/ui-components-library variables, mapped onto the active theme */
    --klerosUIComponentsWhiteBackground: var(--color-surface);
    --klerosUIComponentsLightBackground: var(--color-bg);
    --klerosUIComponentsLightBlue: var(--color-bg);
    --klerosUIComponentsMediumBlue: var(--color-primary-soft);
    --klerosUIComponentsPrimaryBlue: var(--color-primary);
    --klerosUIComponentsSecondaryBlue: var(--color-primary-hover);
    --klerosUIComponentsPrimaryPurple: var(--color-indigo);
    --klerosUIComponentsSecondaryPurple: var(--color-indigo);
    --klerosUIComponentsMediumPurple: var(--color-indigo-soft);
    --klerosUIComponentsPrimaryText: var(--color-text);
    --klerosUIComponentsSecondaryText: var(--color-muted);
    --klerosUIComponentsStroke: var(--color-border);
    --klerosUIComponentsLightGrey: var(--color-raised);
    --klerosUIComponentsSuccess: var(--color-success);
    --klerosUIComponentsSuccessLight: var(--color-success-soft);
    --klerosUIComponentsError: var(--color-danger);
    --klerosUIComponentsErrorLight: var(--color-danger-soft);
    --klerosUIComponentsWarning: var(--color-warning);
    --klerosUIComponentsWarningLight: var(--color-warning-soft);
    --klerosUIComponentsBaseRadius: var(--radius-sm);
    --klerosUIComponentsTransitionSpeed: 150ms;

    color: var(--color-text);
    font-feature-settings: "ss01", "cv11";
    /* The stage colour; the aurora layers live in bootstrap/app.tsx (Stage). */
    background: var(--stage);

    @media (max-width: ${BREAKPOINT_LANDSCAPE}px) {
      --horizontal-padding: 16px;
    }

    /* react-toastify */
    --toastify-color-light: var(--color-surface);
    --toastify-text-color-light: var(--color-text);
    --toastify-color-dark: var(--color-raised);
    --toastify-text-color-dark: var(--color-text);
    --toastify-color-info: var(--color-primary);
    --toastify-color-success: var(--color-success);
    --toastify-color-warning: var(--color-warning);
    --toastify-color-error: var(--color-danger);
    --toastify-color-progress-light: var(--color-primary);
    --toastify-color-progress-dark: var(--color-primary);
    --toastify-font-family: var(--font-sans);
    --toastify-toast-bd-radius: var(--radius);
  }

  body::after {
    content: none;
  }

  /* Glass popovers need the blur behind them; without it they turn solid. */
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    body {
      --popover: var(--color-surface);
    }
  }

  @keyframes curate-sheen {
    0%, 74% { transform: translateX(-120%); }
    100% { transform: translateX(120%); }
  }

  #root {
    position: relative;
    z-index: 1;
  }

  .Toastify__toast-container--top-center {
    top: calc(var(--app-bar-height) + 8px);
  }

  body:not([data-theme="light"]) {
    background-color: ${({ theme }) => theme.stage} !important;
    color: ${({ theme }) => theme.textPrimary} !important;
  }

  body,
  #root {
    min-height: 100vh;
  }

  ::selection {
    color: var(--color-on-primary);
    background: var(--color-primary);
  }

  * {
    scrollbar-width: thin;
    scrollbar-color: var(--color-border-strong) transparent;
  }

  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    border-radius: var(--radius-pill);
    background: var(--color-border-strong);
  }

  h1,
  h2,
  h3,
  h4 {
    letter-spacing: 0;
  }

  svg {
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  button {
    color: inherit;
  }

  button,
  [role="button"],
  a,
  input,
  textarea,
  select {
    -webkit-tap-highlight-color: transparent;
  }

  button:focus-visible,
  a:focus-visible,
  input:focus-visible,
  textarea:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  input,
  textarea,
  select {
    color: var(--v2-text);
  }

  input::placeholder,
  textarea::placeholder {
    color: var(--v2-faint);
  }

  .ant-modal-content,
  .ant-dropdown,
  .ant-dropdown-menu,
  .ant-select-dropdown,
  .Toastify__toast {
    border: 1px solid var(--color-border-strong) !important;
    border-radius: var(--radius) !important;
    background: var(--color-surface) !important;
    box-shadow: var(--shadow-overlay) !important;
  }

  .ant-modal-header,
  .ant-modal-footer {
    border-color: var(--v2-stroke) !important;
    background: transparent !important;
  }

  .ant-input,
  .ant-input-affix-wrapper,
  .ant-select-selector,
  .ant-picker,
  input[type="text"],
  input[type="number"],
  input[type="search"],
  textarea {
    border-color: var(--color-border) !important;
    border-radius: var(--radius) !important;
    background: var(--color-surface) !important;
    color: var(--color-text) !important;
    box-shadow: none !important;
  }

  .ant-input:hover,
  .ant-input-affix-wrapper:hover,
  .ant-select-selector:hover,
  .ant-picker:hover,
  input[type="text"]:hover,
  input[type="number"]:hover,
  input[type="search"]:hover,
  textarea:hover {
    border-color: var(--v2-blue) !important;
  }

  .ant-tag,
  .ant-badge-status-text {
    font-family: var(--font-mono) !important;
    font-weight: 500 !important;
  }

  /* Global link styles */
  a {
    color: ${({ theme }) => theme.linkColor};
    transition: color var(--motion);
  }
  a:hover {
    color: ${({ theme }) => theme.primaryColorHover};
  }

  /* Theme color class overrides for the dark and kleros themes */
  body:not([data-theme="light"]) {
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


  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }

  /* A single comet of light travels the featured panel's rim on load. */
  @property --cv-comet {
    syntax: '<angle>';
    inherits: false;
    initial-value: 0deg;
  }

  @keyframes cv-comet {
    0% { --cv-comet: 0deg; opacity: 0; }
    10% { opacity: 1; }
    85% { opacity: 1; }
    100% { --cv-comet: 360deg; opacity: 0; }
  }

  /*
   * The lit edge's angle (primary buttons, switches): registered so it can
   * turn on hover. The connect button's travelling light uses --cv-sweep.
   */
  @property --edge-angle {
    syntax: '<angle>';
    inherits: false;
    initial-value: 210deg;
  }

  @property --cv-sweep {
    syntax: '<angle>';
    inherits: false;
    initial-value: 0deg;
  }

  @keyframes cv-sweep {
    to { --cv-sweep: 360deg; }
  }

  /* Looping animations pause while the tab is hidden (set in bootstrap/app.tsx). */
  [data-paused] * {
    animation-play-state: paused !important;
  }
`

export default GlobalStyle
