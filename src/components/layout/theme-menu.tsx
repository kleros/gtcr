import React, { useContext } from 'react'
import {
  ThemeContext,
  type ThemeMode,
  THEME_MODES,
} from 'contexts/theme-context'
import type { CurateIconName } from 'components/curate/icons'
import { SelectMenu } from 'components/curate/primitives'

/*
 * Icosahedron, seen down a three-fold axis: the hexagon outline, the front
 * face as a triangle and the nine edges joining them (ten faces in view).
 * Drawn for this menu; it stands for the Kleros theme.
 */
const HEX = [
  [12, 2.5],
  [20.2, 7.25],
  [20.2, 16.75],
  [12, 21.5],
  [3.8, 16.75],
  [3.8, 7.25],
]
const FACE = [
  [12, 7],
  [16.4, 14.6],
  [7.6, 14.6],
]
// Each corner of the front face joins its three nearest outline corners.
const SPOKES: [number, number][] = [
  [0, 0],
  [0, 1],
  [0, 5],
  [1, 1],
  [1, 2],
  [1, 3],
  [2, 3],
  [2, 4],
  [2, 5],
]

export const IcosahedronIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <g
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={`M${HEX.map((point) => point.join(' ')).join(' L')} Z`} />
      <path d={`M${FACE.map((point) => point.join(' ')).join(' L')} Z`} />
      {SPOKES.map(([face, corner]) => (
        <path
          key={`${face}-${corner}`}
          d={`M${FACE[face].join(' ')} L${HEX[corner].join(' ')}`}
          strokeWidth="1.1"
          opacity="0.8"
        />
      ))}
    </g>
  </svg>
)

const MODE_ICON: Record<ThemeMode, CurateIconName | React.ReactElement> = {
  system: 'monitor',
  light: 'sun',
  dark: 'moon',
  kleros: <IcosahedronIcon size={18} />,
}

/**
 * App-bar theme switcher: System, Light, Dark, Kleros (DESIGN.md, Themes).
 * A round icon button showing the chosen mode; the glass menu names each
 * mode with a hint and checks the chosen one.
 */
const ThemeMenu = () => {
  const themeContext = useContext(ThemeContext)
  if (!themeContext) return null
  const { mode, setMode } = themeContext

  return (
    <SelectMenu<ThemeMode>
      label="Theme"
      heading="Theme"
      appearance="icon"
      align="end"
      menuWidth={244}
      title="Theme"
      value={mode}
      onChange={setMode}
      options={THEME_MODES.map((option) => ({
        value: option.value,
        label: option.label,
        hint: option.hint,
        icon: MODE_ICON[option.value],
      }))}
    />
  )
}

export default ThemeMenu
