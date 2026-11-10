import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { ThemeProvider as StyledThemeProvider } from 'styled-components'

/**
 * Three color themes built from one semantic palette each, so every legacy theme key the
 * app reads stays defined and consistent. See DESIGN.md for the roles and rules.
 *
 *  - light:  cool neutral canvas, one blue accent; its controls are lit white
 *            glass with a coloured edge (never an ink pill)
 *  - dark:   the glow stage: blue-tinted near-black with a single accent bloom
 *  - kleros: the production Kleros dApp palette (deep purple surfaces)
 *
 * "system" follows the OS between light and dark.
 */
export type ThemeMode = 'system' | 'light' | 'dark' | 'kleros'
export type ThemeName = 'light' | 'dark' | 'kleros'

export const THEME_STORAGE_KEY = 'kleros-curate-theme'

/**
 * The typeface switch (Urbanist + Geist, Geist, IBM Plex) is gone: the app
 * always sets Urbanist for display and Geist for text. A preference stored by
 * the old switch is removed once, so it can never restyle the page.
 */
const LEGACY_TYPEFACE_STORAGE_KEY = 'curatevision-typeface'
const forgetLegacyTypeface = () => {
  try {
    localStorage.removeItem(LEGACY_TYPEFACE_STORAGE_KEY)
  } catch {
    // Storage can be blocked; nothing reads the key any more.
  }
  if (typeof document !== 'undefined')
    document.body.removeAttribute('data-type')
}

interface Palette {
  name: ThemeName
  background: string
  surface: string
  raised: string
  text: string
  textMuted: string
  textFaint: string
  textInverted: string
  border: string
  borderStrong: string
  primary: string
  /** Button fill: may be deeper than `primary` so white text clears 4.5:1. */
  primaryFill: string
  /** Button fill on hover: keeps its on-primary label at 4.5:1 or more. */
  primaryFillHover: string
  /** Link and text hover. */
  primaryHover: string
  onPrimary: string
  primarySoft: string
  indigo: string
  indigoSoft: string
  success: string
  successSoft: string
  warning: string
  warningSoft: string
  danger: string
  dangerSoft: string
  shadow: string
  shadowHover: string
  overlayShadow: string
  glow: string
  /** Second, fainter hue at the rim of the bloom (iridescent trace). */
  glowRim: string
  /** Translucent card fill, its hairline and its top highlight. */
  glass: string
  glassBorder: string
  glassHighlight: string
  /** Outside the app frame: the aurora's base and its three hues. */
  stage: string
  auroraA: string
  auroraB: string
  auroraC: string
  /**
   * Categorical data colours (rings, legends): four distinct hues in a fixed
   * order, none of them a status colour, each 3:1 or more on the surface.
   */
  viz: [string, string, string, string]
  /**
   * Controls (DESIGN.md, Surfaces and controls): the three hues of the lit
   * 1px edge on primary buttons, switches and the connect button.
   */
  edge: [string, string, string]
  /** Width of the lit edge on primary buttons and Connect. */
  edgeWidth: string
  /** Primary button glass: top and bottom of its fill, its label, its glow. */
  ctaTop: string
  ctaBottom: string
  ctaInk: string
  ctaGlow: string
  /** The glass's top sheen and its 1px inner top highlight. */
  ctaSheen: string
  ctaHighlight: string
  /** The bright head of the light that travels the Connect edge. */
  sweepHead: string
  /** A switch while on: its track (top, bottom of the glass) and its bead. */
  trackOnTop: string
  trackOnBottom: string
  beadOn: string
  /** Recessed track (segmented controls, switches) and its inner shadow. */
  recess: string
  recessShadow: string
  /** The raised, lit thumb that sits in a recessed track. */
  thumb: string
  thumbShadow: string
  /** A switch's thumb while off. */
  beadOff: string
  /** Glass popover fill (dropdowns, select menus) and its row hover. */
  popover: string
  hoverFill: string
}

const light: Palette = {
  name: 'light',
  background: '#fbfcfe',
  surface: '#ffffff',
  raised: '#f1f4fa',
  text: '#0b1220',
  textMuted: '#4d5a6e',
  textFaint: '#5e6a7d',
  textInverted: '#ffffff',
  border: 'rgba(16, 24, 40, 0.08)',
  borderStrong: 'rgba(16, 24, 40, 0.16)',
  primary: '#2a63f0',
  primaryFill: '#2a63f0',
  primaryFillHover: '#2459e0',
  primaryHover: '#2459e0',
  onPrimary: '#ffffff',
  primarySoft: 'rgba(42, 99, 240, 0.1)',
  indigo: '#5b61d6',
  indigoSoft: 'rgba(91, 97, 214, 0.1)',
  success: '#127d47',
  successSoft: 'rgba(20, 138, 78, 0.1)',
  warning: '#9a5b00',
  warningSoft: 'rgba(154, 91, 0, 0.1)',
  danger: '#c92a2a',
  dangerSoft: 'rgba(201, 42, 42, 0.1)',
  shadow: '0 1px 2px rgba(16, 24, 40, 0.05), 0 8px 24px rgba(16, 24, 40, 0.05)',
  shadowHover:
    '0 2px 6px rgba(16, 24, 40, 0.08), 0 16px 40px rgba(16, 24, 40, 0.08)',
  overlayShadow: '0 20px 60px rgba(16, 24, 40, 0.16)',
  glow: 'rgba(47, 107, 255, 0.08)',
  glowRim: 'rgba(124, 92, 255, 0.05)',
  glass: '#ffffff',
  glassBorder: 'rgba(16, 24, 40, 0.08)',
  glassHighlight: 'rgba(255, 255, 255, 1)',
  stage: '#f5f7fc',
  auroraA: '#9db7ff',
  auroraB: '#b8e3ff',
  auroraC: '#c9b8ff',
  viz: ['#2a63f0', '#0a87ad', '#7b4fd6', '#c43c84'],
  edge: ['#2a63f0', '#00a0dc', '#8a4dff'],
  // Lit white glass: a white pill tinted toward the bottom lip, a 1.5px
  // edge in the three hues and a blue glow pooled inside and under it.
  edgeWidth: '1.5px',
  ctaTop: '#ffffff',
  ctaBottom: '#dde7ff',
  ctaInk: '#0d1838',
  ctaGlow: 'rgba(42, 99, 240, 0.5)',
  ctaSheen: 'rgba(255, 255, 255, 0.85)',
  ctaHighlight: '#ffffff',
  sweepHead: '#2a63f0',
  trackOnTop: '#1d2742',
  trackOnBottom: '#0b1220',
  beadOn: '#ffffff',
  recess: 'rgba(16, 24, 40, 0.055)',
  recessShadow:
    'inset 0 1px 2px rgba(16, 24, 40, 0.12), inset 0 0 0 1px rgba(16, 24, 40, 0.06), 0 1px 0 #ffffff',
  // The chosen segment: white glass with a blue hairline and a blue glow
  // under it (its lamp is drawn by litThumb), not a plain white chip.
  thumb: 'linear-gradient(180deg, #ffffff, #f1f5ff)',
  thumbShadow:
    '0 0 0 1px rgba(42, 99, 240, 0.24), 0 1px 2px rgba(16, 24, 40, 0.1), 0 6px 14px -6px rgba(42, 99, 240, 0.45)',
  beadOff: 'linear-gradient(180deg, #ffffff, #e9edf5)',
  popover: 'rgba(255, 255, 255, 0.92)',
  hoverFill: 'rgba(16, 24, 40, 0.06)',
}

const dark: Palette = {
  name: 'dark',
  background: '#060912',
  surface: '#0c111d',
  raised: 'rgba(255, 255, 255, 0.045)',
  text: '#f4f6fb',
  textMuted: '#a1abc0',
  textFaint: '#7a849e',
  textInverted: '#04101f',
  border: 'rgba(255, 255, 255, 0.07)',
  borderStrong: 'rgba(255, 255, 255, 0.16)',
  primary: '#3d7bff',
  primaryFill: '#2962ff',
  primaryFillHover: '#1f56f5',
  primaryHover: '#5a8fff',
  onPrimary: '#ffffff',
  primarySoft: 'rgba(61, 123, 255, 0.16)',
  indigo: '#8b93ff',
  indigoSoft: 'rgba(139, 147, 255, 0.14)',
  success: '#34d399',
  successSoft: 'rgba(52, 211, 153, 0.14)',
  warning: '#f5b04a',
  warningSoft: 'rgba(245, 176, 74, 0.14)',
  danger: '#ff6b7a',
  dangerSoft: 'rgba(255, 107, 122, 0.14)',
  shadow: 'none',
  shadowHover: '0 12px 40px rgba(0, 0, 0, 0.35)',
  overlayShadow: '0 24px 80px rgba(0, 0, 0, 0.6)',
  glow: 'rgba(61, 123, 255, 0.16)',
  glowRim: 'rgba(120, 90, 255, 0.10)',
  glass: 'rgba(255, 255, 255, 0.03)',
  glassBorder: 'rgba(255, 255, 255, 0.07)',
  glassHighlight: 'rgba(255, 255, 255, 0.06)',
  stage: '#02040b',
  auroraA: '#1b2fff',
  auroraB: '#0a7cff',
  auroraC: '#5b2bff',
  viz: ['#3d7bff', '#1aa3c4', '#a274ff', '#d9558f'],
  edge: ['#7aa7ff', '#45d4ff', '#9b7bff'],
  edgeWidth: '1px',
  ctaTop: '#15264f',
  ctaBottom: '#0a1226',
  ctaInk: '#f4f6fb',
  ctaGlow: 'rgba(61, 123, 255, 0.55)',
  ctaSheen: 'rgba(244, 246, 251, 0.09)',
  ctaHighlight: 'rgba(244, 246, 251, 0.16)',
  sweepHead: '#ffffff',
  trackOnTop: '#15264f',
  trackOnBottom: '#0a1226',
  beadOn: '#f4f6fb',
  recess: 'rgba(0, 0, 0, 0.32)',
  recessShadow:
    'inset 0 1px 2px rgba(0, 0, 0, 0.55), inset 0 0 0 1px rgba(255, 255, 255, 0.05), 0 1px 0 rgba(255, 255, 255, 0.04)',
  thumb:
    'linear-gradient(180deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.05))',
  thumbShadow:
    'inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 0 0 1px rgba(255, 255, 255, 0.07), 0 2px 6px rgba(0, 0, 0, 0.5)',
  beadOff: 'linear-gradient(180deg, #9aa3b8, #5f6880)',
  popover: 'rgba(14, 19, 32, 0.94)',
  hoverFill: 'rgba(255, 255, 255, 0.07)',
}

// Values from @kleros/ui-components-library theme.css (dark set), see DESIGN.md.
const kleros: Palette = {
  name: 'kleros',
  background: '#10022a',
  surface: '#1a073d',
  raised: 'rgba(255, 255, 255, 0.05)',
  text: '#eaf4ff',
  textMuted: '#b9c6e0',
  textFaint: '#8f87bd',
  textInverted: '#14002f',
  border: 'rgba(255, 255, 255, 0.1)',
  borderStrong: 'rgba(255, 255, 255, 0.2)',
  primary: '#6cc5ff',
  primaryFill: '#6cc5ff',
  primaryFillHover: '#a5dbff',
  primaryHover: '#a5dbff',
  onPrimary: '#14002f',
  primarySoft: 'rgba(108, 197, 255, 0.16)',
  indigo: '#b45fff',
  indigoSoft: 'rgba(180, 95, 255, 0.16)',
  success: '#65dc7f',
  successSoft: 'rgba(101, 220, 127, 0.14)',
  warning: '#ffc46b',
  warningSoft: 'rgba(255, 196, 107, 0.14)',
  danger: '#ff5a78',
  dangerSoft: 'rgba(255, 90, 120, 0.14)',
  shadow: 'none',
  shadowHover: '0 12px 40px rgba(0, 0, 0, 0.4)',
  overlayShadow: '0 24px 80px rgba(0, 0, 0, 0.6)',
  glow: 'rgba(144, 19, 254, 0.18)',
  glowRim: 'rgba(108, 197, 255, 0.10)',
  glass: 'rgba(255, 255, 255, 0.035)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  glassHighlight: 'rgba(255, 255, 255, 0.1)',
  stage: '#07001a',
  auroraA: '#7e1bd4',
  auroraB: '#4d00b4',
  auroraC: '#27cdfe',
  viz: ['#3d7bff', '#1aa3c4', '#a274ff', '#d9558f'],
  edge: ['#c084ff', '#27cdfe', '#6cc5ff'],
  edgeWidth: '1px',
  ctaTop: '#2c1266',
  ctaBottom: '#150437',
  ctaInk: '#eaf4ff',
  ctaGlow: 'rgba(180, 95, 255, 0.5)',
  ctaSheen: 'rgba(234, 244, 255, 0.09)',
  ctaHighlight: 'rgba(234, 244, 255, 0.16)',
  sweepHead: '#ffffff',
  trackOnTop: '#2c1266',
  trackOnBottom: '#150437',
  beadOn: '#eaf4ff',
  recess: 'rgba(0, 0, 0, 0.3)',
  recessShadow:
    'inset 0 1px 2px rgba(0, 0, 0, 0.55), inset 0 0 0 1px rgba(255, 255, 255, 0.06), 0 1px 0 rgba(255, 255, 255, 0.05)',
  thumb:
    'linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.06))',
  thumbShadow:
    'inset 0 1px 0 rgba(255, 255, 255, 0.22), inset 0 0 0 1px rgba(255, 255, 255, 0.08), 0 2px 6px rgba(0, 0, 0, 0.5)',
  beadOff: 'linear-gradient(180deg, #b3acd6, #6f679b)',
  popover: 'rgba(30, 10, 66, 0.94)',
  hoverFill: 'rgba(255, 255, 255, 0.08)',
}

/** Expands a palette into the full set of keys the app's styled components read. */
const buildTheme = (p: Palette) => ({
  name: p.name,
  bodyBackground: p.background,
  componentBackground: p.surface,
  cardBackground: p.surface,
  elevatedBackground: p.raised,
  textPrimary: p.text,
  textSecondary: p.textMuted,
  textTertiary: p.textFaint,
  textInverted: p.textInverted,
  textOnPrimary: p.onPrimary,
  primaryColor: p.primary,
  primaryColorHover: p.primaryHover,
  secondaryColor: p.indigo,
  tertiaryColor: p.indigo,
  quaternaryColor: p.raised,
  gradientStart: p.surface,
  gradientEnd: p.background,
  gradientMid: p.raised,
  navbarBackground: p.surface,
  footerBackground: p.surface,
  borderColor: p.border,
  shadowColor:
    p.name === 'light' ? 'rgba(16, 24, 40, 0.08)' : 'rgba(0, 0, 0, 0.5)',
  successColor: p.success,
  errorColor: p.danger,
  warningColor: p.warning,
  infoColor: p.primary,
  linkColor: p.primary,
  disabledColor:
    p.name === 'light' ? 'rgba(15, 20, 25, 0.3)' : 'rgba(233, 238, 245, 0.35)',
  bannerGradient: p.raised,
  bannerTextColor: p.text,
  bannerTitleColor: p.text,
  bannerDescriptionColor: p.textMuted,
  bannerLinkColor: p.primary,
  bannerLinkHoverColor: p.primaryHover,
  bannerPolicyLinkColor: p.primary,
  bannerPolicyLinkHoverColor: p.primaryHover,
  buttonPrimaryBg: p.primaryFill,
  primaryFill: p.primaryFill,
  buttonPrimaryText: p.onPrimary,
  buttonPrimaryHoverBg: p.primaryFillHover,
  primaryFillHover: p.primaryFillHover,
  buttonSecondaryBg: p.surface,
  buttonSecondaryText: p.text,
  switchOffBg: p.borderStrong,
  switchHoverBg: p.primaryHover,
  switchHandleBg: '#ffffff',
  focusBorderColor: p.primary,
  focusShadowColor: p.primarySoft,
  cardHeaderGradient: p.surface,
  cardHeaderLinkColor: p.primary,
  cardHeaderLinkHoverColor: p.primaryHover,
  evidenceCardBorder: p.border,
  timelineDotColor: p.borderStrong,
  cardShadow: p.shadow,
  cardNsfwText: p.text,
  dropdownShadow: p.overlayShadow,
  dropdownHoverBg: p.raised,
  dropdownSelectedBg: p.primarySoft,
  modalBackground: p.surface,
  modalShadow: p.overlayShadow,
  modalCloseColor: p.textMuted,
  notificationPending: p.textFaint,
  notificationAccepted: p.success,
  notificationChallenged: p.warning,
  notificationAppealable: p.warning,
  notificationFinalRuling: p.danger,
  statusCrowdfundingWinner: p.warning,
  loadingIconColor: p.primary,
  skeletonBase: p.raised,
  skeletonHighlight: p.surface,
  countdownTextColor: p.textMuted,
  filterBorderColor: p.border,
  filterTextColor: p.text,
  tourAccentColor: p.primary,
  explorerGradientStart: p.raised,
  explorerGradientEnd: p.raised,
  explorerTextColor: p.textMuted,
  welcomeModalShadow: p.overlayShadow,
  betaWarningBg: p.warningSoft,
  badgeFallbackColor: p.borderStrong,
  stakeTagBg: p.indigoSoft,
  stakeTagText: p.indigo,
  itemDetailsTitleColor: p.text,
  itemDetailsSubtitleColor: p.textMuted,
  crowdfundingCardText: p.text,
  richAddressWarningColor: p.warning,
  seerBorderColor: p.border,
  seerLinkColor: p.primary,
  seerTextPrimary: p.text,
  seerTextSecondary: p.textMuted,
  seerBackgroundAlt: p.raised,
  seerShadow: p.shadow,
  tooltipBg: p.name === 'light' ? '#0f1419' : p.raised,
  tooltipText: p.name === 'light' ? '#ffffff' : p.text,
  tooltipBorder: p.name === 'light' ? '#0f1419' : p.borderStrong,
  tooltipShadow: p.overlayShadow,
  curateBg: p.background,
  curateBgSoft: p.surface,
  curateSurface: p.surface,
  curateSurfaceStrong: p.surface,
  curateBorder: p.border,
  curateBorderStrong: p.borderStrong,
  curateText: p.text,
  curateMuted: p.textMuted,
  curateFaint: p.textFaint,
  curateLive: p.primary,
  curateLiveSoft: p.primarySoft,
  curateViolet: p.indigo,
  curateVioletSoft: p.indigoSoft,
  curateSuccess: p.success,
  curateSuccessSoft: p.successSoft,
  curateWarning: p.warning,
  curateWarningSoft: p.warningSoft,
  curateDanger: p.danger,
  curateDangerSoft: p.dangerSoft,
  curateShadow: p.shadow,
  curateShadowHover: p.shadowHover,
  curateGlowA: p.glow,
  curateGlowB: p.glowRim,
  glass: p.glass,
  glassBorder: p.glassBorder,
  glassHighlight: p.glassHighlight,
  stage: p.stage,
  auroraA: p.auroraA,
  auroraB: p.auroraB,
  auroraC: p.auroraC,
  viz: p.viz,
  edge: p.edge,
  edgeWidth: p.edgeWidth,
  ctaTop: p.ctaTop,
  ctaBottom: p.ctaBottom,
  ctaInk: p.ctaInk,
  ctaGlow: p.ctaGlow,
  ctaSheen: p.ctaSheen,
  ctaHighlight: p.ctaHighlight,
  sweepHead: p.sweepHead,
  trackOnTop: p.trackOnTop,
  trackOnBottom: p.trackOnBottom,
  beadOn: p.beadOn,
  recess: p.recess,
  recessShadow: p.recessShadow,
  thumb: p.thumb,
  thumbShadow: p.thumbShadow,
  beadOff: p.beadOff,
  popover: p.popover,
  hoverFill: p.hoverFill,
})

export const lightTheme = buildTheme(light)
export const darkTheme = buildTheme(dark)
export const klerosTheme = buildTheme(kleros)

export type Theme = typeof lightTheme

const THEMES: Record<ThemeName, Theme> = {
  light: lightTheme,
  dark: darkTheme,
  kleros: klerosTheme,
}

// Only System needs a hint: the others are named by their label and icon.
export const THEME_MODES: { value: ThemeMode; label: string; hint?: string }[] =
  [
    { value: 'system', label: 'System', hint: 'Matches your device' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'kleros', label: 'Kleros' },
  ]

const isThemeMode = (value: unknown): value is ThemeMode =>
  value === 'system' ||
  value === 'light' ||
  value === 'dark' ||
  value === 'kleros'

const systemPrefersDark = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches

const resolveMode = (mode: ThemeMode, prefersDark: boolean): ThemeName =>
  mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode

/**
 * Default mode for visitors who never picked one: follow the operating system
 * (DESIGN.md). Must match DEFAULT_MODE in index.html, which applies the saved
 * mode before React mounts.
 */
export const DEFAULT_THEME_MODE: ThemeMode = 'system'

/** ?cv-theme=light|dark|kleros previews a theme for one visit without saving it. */
const forcedMode = (): ThemeMode | null => {
  if (typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get('cv-theme')
  return value === 'light' || value === 'dark' || value === 'kleros'
    ? value
    : null
}

const readSavedMode = (): ThemeMode => {
  const forced = forcedMode()
  if (forced) return forced
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (isThemeMode(saved)) return saved
  } catch {
    // Storage can be blocked; fall through to the default.
  }
  return DEFAULT_THEME_MODE
}

interface ThemeContextValue {
  /** True for dark and kleros; kept for components written against the old toggle. */
  isDarkMode: boolean
  /** Switches between light and dark; kept for the old toggle button. */
  toggleTheme: () => void
  theme: Theme
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  resolved: ThemeName
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [mode, setModeState] = useState<ThemeMode>(readSavedMode)
  const [prefersDark, setPrefersDark] = useState<boolean>(systemPrefersDark)

  useEffect(forgetLegacyTypeface, [])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) =>
      setPrefersDark(event.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const resolved = resolveMode(mode, prefersDark)
  const theme = THEMES[resolved]
  const isDarkMode = resolved !== 'light'

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Storage can be blocked; the choice then lasts for the session.
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setMode(resolved === 'light' ? 'dark' : 'light')
  }, [resolved, setMode])

  useEffect(() => {
    document.body.setAttribute('data-theme', resolved)
    document.body.style.backgroundColor = theme.stage
    document.body.style.colorScheme = isDarkMode ? 'dark' : 'light'
    // Shared @kleros/ui-components-library components (e.g. FileViewer) read
    // their CSS variables from `:root.dark`, so keep that class in sync.
    document.documentElement.classList.toggle('dark', isDarkMode)
  }, [resolved, isDarkMode, theme.stage])

  const value = useMemo(
    () => ({
      isDarkMode,
      toggleTheme,
      theme,
      mode,
      setMode,
      resolved,
    }),
    [isDarkMode, toggleTheme, theme, mode, setMode, resolved],
  )

  return (
    <ThemeContext.Provider value={value}>
      <StyledThemeProvider theme={theme}>{children}</StyledThemeProvider>
    </ThemeContext.Provider>
  )
}

export { ThemeContext, ThemeProvider }
