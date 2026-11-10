import React from 'react'

type IconProps = React.SVGProps<SVGSVGElement> & {
  size?: number
  title?: string
}

export type CurateIconName =
  | 'activity'
  | 'bounty'
  | 'chain'
  | 'challenge'
  | 'check'
  | 'chevron-down'
  | 'close'
  | 'copy'
  | 'court'
  | 'dispute'
  | 'external'
  | 'factory'
  | 'filter'
  | 'grid'
  | 'help'
  | 'layers'
  | 'list'
  | 'menu'
  | 'monitor'
  | 'moon'
  | 'policy'
  | 'registry'
  | 'remove'
  | 'search'
  | 'shield'
  | 'spark'
  | 'submit'
  | 'sun'
  | 'user'
  | 'verified'
  | 'wallet'

const StrokeIcon = ({ size = 20, title, children, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden={title ? undefined : true}
    role={title ? 'img' : undefined}
    {...props}
  >
    {title && <title>{title}</title>}
    <g
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </g>
  </svg>
)

const icons: Record<CurateIconName, (props: IconProps) => JSX.Element> = {
  activity: (props) => (
    <StrokeIcon {...props}>
      <path d="M4 14.5h3.2l2-7 4.2 10.5 2-5.2H20" />
      <path d="M4 20h16" />
    </StrokeIcon>
  ),
  bounty: (props) => (
    <StrokeIcon {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5v9" />
      <path d="M15.2 9.2c-.8-.7-1.8-1-3.1-1-1.5 0-2.7.7-2.7 1.9 0 1.1.9 1.6 2.9 2 2 .4 2.9.9 2.9 2.1 0 1.3-1.2 2-2.9 2-1.4 0-2.5-.4-3.5-1.2" />
    </StrokeIcon>
  ),
  chain: (props) => (
    <StrokeIcon {...props}>
      <path d="M9.5 7.5 8.2 6.2a3.1 3.1 0 0 0-4.4 4.4l2.4 2.4a3.1 3.1 0 0 0 4.4 0" />
      <path d="m14.5 16.5 1.3 1.3a3.1 3.1 0 0 0 4.4-4.4l-2.4-2.4a3.1 3.1 0 0 0-4.4 0" />
      <path d="m8.8 15.2 6.4-6.4" />
    </StrokeIcon>
  ),
  challenge: (props) => (
    <StrokeIcon {...props}>
      <path d="M12 3 4.5 6.2v5.9c0 4.3 3 7.5 7.5 8.9 4.5-1.4 7.5-4.6 7.5-8.9V6.2L12 3Z" />
      <path d="m8.5 12 2.3 2.3 4.7-5" />
    </StrokeIcon>
  ),
  'chevron-down': (props) => (
    <StrokeIcon {...props}>
      <path d="m7 9 5 5 5-5" />
    </StrokeIcon>
  ),
  close: (props) => (
    <StrokeIcon {...props}>
      <path d="M6.5 6.5 17.5 17.5" />
      <path d="M17.5 6.5 6.5 17.5" />
    </StrokeIcon>
  ),
  court: (props) => (
    <StrokeIcon {...props}>
      <path d="M4 20h16" />
      <path d="M6 17h12" />
      <path d="M7 17V9h10v8" />
      <path d="M5 9h14L12 4 5 9Z" />
      <path d="M10 17V9" />
      <path d="M14 17V9" />
    </StrokeIcon>
  ),
  copy: (props) => (
    <StrokeIcon {...props}>
      <rect x="8" y="8" width="10" height="10" rx="2" />
      <path d="M6 14H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" />
    </StrokeIcon>
  ),
  dispute: (props) => (
    <StrokeIcon {...props}>
      <path d="m12 3 8 14H4l8-14Z" />
      <path d="M12 8v4" />
      <path d="M12 15.8h.01" />
    </StrokeIcon>
  ),
  external: (props) => (
    <StrokeIcon {...props}>
      <path d="M9 5H5v14h14v-4" />
      <path d="M14 5h5v5" />
      <path d="m11 13 8-8" />
    </StrokeIcon>
  ),
  factory: (props) => (
    <StrokeIcon {...props}>
      <path d="M4 20V9.5l5 3V9.5l5 3V6l6-2v16H4Z" />
      <path d="M8 17h1.5" />
      <path d="M13 17h1.5" />
      <path d="M17.5 17H19" />
    </StrokeIcon>
  ),
  filter: (props) => (
    <StrokeIcon {...props}>
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </StrokeIcon>
  ),
  grid: (props) => (
    <StrokeIcon {...props}>
      <path d="M4 4h6v6H4z" />
      <path d="M14 4h6v6h-6z" />
      <path d="M4 14h6v6H4z" />
      <path d="M14 14h6v6h-6z" />
    </StrokeIcon>
  ),
  help: (props) => (
    <StrokeIcon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.2a2.7 2.7 0 0 1 2.6-1.8c1.7 0 2.9 1 2.9 2.5 0 1.3-.8 2-1.9 2.7-.8.5-1.2 1-1.2 2" />
      <path d="M12 17.1h.01" />
    </StrokeIcon>
  ),
  list: (props) => (
    <StrokeIcon {...props}>
      <path d="M8 6h12" />
      <path d="M8 12h12" />
      <path d="M8 18h12" />
      <path d="M4 6h.01" />
      <path d="M4 12h.01" />
      <path d="M4 18h.01" />
    </StrokeIcon>
  ),
  menu: (props) => (
    <StrokeIcon {...props}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </StrokeIcon>
  ),
  moon: (props) => (
    <StrokeIcon {...props}>
      <path d="M18.7 14.8A7.7 7.7 0 0 1 9.2 5.3 7.7 7.7 0 1 0 18.7 14.8Z" />
    </StrokeIcon>
  ),
  policy: (props) => (
    <StrokeIcon {...props}>
      <path d="M7 3.5h7l3 3V20.5H7z" />
      <path d="M14 3.5V7h3.5" />
      <path d="M9.5 11h5" />
      <path d="M9.5 15h5" />
    </StrokeIcon>
  ),
  registry: (props) => (
    <StrokeIcon {...props}>
      <path d="M5 5.5h14v4H5z" />
      <path d="M5 14.5h14v4H5z" />
      <path d="M8 9.5v5" />
      <path d="M16 9.5v5" />
    </StrokeIcon>
  ),
  remove: (props) => (
    <StrokeIcon {...props}>
      <path d="M5 6h14" />
      <path d="M9 6V4h6v2" />
      <path d="M7 6.5 8 20h8l1-13.5" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </StrokeIcon>
  ),
  check: (props) => (
    <StrokeIcon {...props}>
      <path d="m5 12.5 4.2 4.2L19 7" />
    </StrokeIcon>
  ),
  layers: (props) => (
    <StrokeIcon {...props}>
      <path d="m12 4 8 4.2-8 4.2-8-4.2L12 4Z" />
      <path d="m4 12.4 8 4.2 8-4.2" />
      <path d="m4 16.4 8 4.2 8-4.2" />
    </StrokeIcon>
  ),
  monitor: (props) => (
    <StrokeIcon {...props}>
      <rect x="3" y="4.5" width="18" height="12" rx="1.5" />
      <path d="M8.5 20h7" />
      <path d="M12 16.5V20" />
    </StrokeIcon>
  ),
  search: (props) => (
    <StrokeIcon {...props}>
      <circle cx="10.5" cy="10.5" r="5.8" />
      <path d="m15 15 5 5" />
    </StrokeIcon>
  ),
  shield: (props) => (
    <StrokeIcon {...props}>
      <path d="M12 3 5 6v5.8c0 4.1 2.8 7 7 8.2 4.2-1.2 7-4.1 7-8.2V6l-7-3Z" />
      <path d="M9 12.2 11.1 14l4-4.4" />
    </StrokeIcon>
  ),
  spark: (props) => (
    <StrokeIcon {...props}>
      <path d="M12 3.5 13.8 9l5.7 1.5-5.7 1.7L12 18l-1.8-5.8-5.7-1.7L10.2 9 12 3.5Z" />
      <path d="M18.5 16.5 19.2 19l2.3.7-2.3.7-.7 2.1-.7-2.1-2.3-.7 2.3-.7.7-2.5Z" />
    </StrokeIcon>
  ),
  submit: (props) => (
    <StrokeIcon {...props}>
      <path d="M4 12h11" />
      <path d="m11 8 4 4-4 4" />
      <path d="M18 5v14" />
    </StrokeIcon>
  ),
  sun: (props) => (
    <StrokeIcon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.8v2" />
      <path d="M12 19.2v2" />
      <path d="M4.9 4.9 6.3 6.3" />
      <path d="m17.7 17.7 1.4 1.4" />
      <path d="M2.8 12h2" />
      <path d="M19.2 12h2" />
      <path d="m4.9 19.1 1.4-1.4" />
      <path d="m17.7 6.3 1.4-1.4" />
    </StrokeIcon>
  ),
  user: (props) => (
    <StrokeIcon {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.8 20c1.2-3.4 3.6-5 7.2-5s6 1.6 7.2 5" />
    </StrokeIcon>
  ),
  verified: (props) => (
    <StrokeIcon {...props}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="m8.5 12.2 2.4 2.4 4.9-5.2" />
    </StrokeIcon>
  ),
  wallet: (props) => (
    <StrokeIcon {...props}>
      <path d="M4 7.5h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4.5a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 4.5 7.5H18V6a1 1 0 0 0-1-1H5.5" />
      <path d="M16 13h.01" />
    </StrokeIcon>
  ),
}

export const CurateIcon = ({
  name,
  ...props
}: IconProps & { name: CurateIconName }) => {
  const IconComponent = icons[name]
  return <IconComponent {...props} />
}

export default CurateIcon
