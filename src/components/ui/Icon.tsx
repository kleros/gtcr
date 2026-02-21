import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import styled, { keyframes } from 'styled-components'

const spinAnimation = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`

const SpinWrapper = styled.span`
  display: inline-flex;
  animation: ${spinAnimation} 1s linear infinite;
`

const CircleOutline = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25em;
  height: 1.25em;
  border: 2px solid currentColor;
  border-radius: 50%;
`

const ICON_MAP: Record<string, any> = {
  'question-circle-o': ['far', 'question-circle'],
  'question-circle': 'question-circle',
  'loading': 'spinner',
  'plus': 'plus',
  'plus-circle': 'plus-circle',
  'fire': 'fire',
  'star': 'star',
  'check': 'check',
  'check-circle': ['far', 'check-circle'],
  'flag': 'flag',
  'file-pdf': 'file-pdf',
  'right-circle': 'arrow-circle-right',
  'left': 'arrow-left',
  'right': 'arrow-right',
  'file-text': 'file-alt',
  'paper-clip': 'paperclip',
  'warning': 'exclamation-triangle',
  'close': 'times',
  'file': 'file',
  'dollar': 'dollar-sign',
  'hourglass': 'hourglass-half',
  'info-circle': 'info-circle',
  'exclamation-circle': 'exclamation-circle',
  'search': 'search',
  'bell': 'bell',
  'copy': 'copy',
  'upload': 'upload',
  'chevron-down': 'chevron-down',
  'chevron-up': 'chevron-up'
}

interface IconProps {
  type: string
  style?: React.CSSProperties
  className?: string
  onClick?: (e: React.MouseEvent) => void
  spin?: boolean
  [key: string]: any
}

const Icon: React.FC<IconProps> = ({ type, style, className, onClick, spin: spinProp, ...rest }) => {
  const icon = ICON_MAP[type]
  if (!icon) return null

  if (type === 'plus-circle-outline') {
    return (
      <CircleOutline style={style} className={className} onClick={onClick}>
        <FontAwesomeIcon icon="plus" size="xs" {...rest} />
      </CircleOutline>
    )
  }

  if (type === 'loading' || spinProp) {
    return (
      <SpinWrapper style={style} className={className} onClick={onClick}>
        <FontAwesomeIcon icon={icon} {...rest} />
      </SpinWrapper>
    )
  }

  return (
    <FontAwesomeIcon
      icon={icon}
      style={style}
      className={className}
      onClick={onClick}
      {...rest}
    />
  )
}

export default Icon
